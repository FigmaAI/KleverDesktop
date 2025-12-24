/**
 * Project management IPC handlers
 * Handles CRUD operations for projects and project execution
 *
 * IMPORTANT: Project execution now uses config.json environment variables
 */

import { IpcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  loadProjects,
  saveProjects,
  getProjectWorkspaceDir,
  ensureDirectoryExists,
  sanitizeAppName,
} from '../utils/project-storage';
import { loadAppConfig } from '../utils/config-storage';
import { buildEnvFromConfig } from '../utils/config-env-builder';
import { spawnBundledPython, getPythonEnv, getCorePath, getLegacyScriptsPath } from '../utils/python-runtime';
import { Project, CreateProjectInput, UpdateProjectInput } from '../types';

let pythonProcess: ChildProcess | null = null;

/**
 * Register all project management handlers
 */
export function registerProjectHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // List all projects
  ipcMain.handle('project:list', async () => {
    try {
      const data = loadProjects();
      return { success: true, projects: data.projects };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Get single project
  ipcMain.handle('project:get', async (_event, projectId: string) => {
    try {
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      return { success: true, project };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Create new project
  ipcMain.handle('project:create', async (_event, projectInput: CreateProjectInput) => {
    try {
      const data = loadProjects();

      const workspaceDir = projectInput.workspaceDir || getProjectWorkspaceDir(projectInput.name);

      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: projectInput.name,
        platform: projectInput.platform,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        workspaceDir: workspaceDir,
      };

      // Create workspace directory and verify
      const dirCreated = ensureDirectoryExists(newProject.workspaceDir);
      if (!dirCreated) {
        return {
          success: false,
          error: `Failed to create workspace directory: ${newProject.workspaceDir}`
        };
      }

      // Create the work_dir structure that gelab engine expects
      // Structure: {workspaceDir}/apps/{sanitized_app_name}
      const appsDir = path.join(newProject.workspaceDir, 'apps');
      const appsDirCreated = ensureDirectoryExists(appsDir);
      if (!appsDirCreated) {
        return {
          success: false,
          error: `Failed to create apps directory: ${appsDir}`
        };
      }

      const sanitizedAppName = sanitizeAppName(newProject.name);
      const workDir = path.join(appsDir, sanitizedAppName);
      const workDirCreated = ensureDirectoryExists(workDir);
      if (!workDirCreated) {
        return {
          success: false,
          error: `Failed to create work directory: ${workDir}`
        };
      }

      data.projects.push(newProject);
      saveProjects(data);

      return {
        success: true,
        project: newProject,
        message: `Project created successfully at ${newProject.workspaceDir}\nWork directory: ${workDir}`
      };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Update project
  ipcMain.handle('project:update', async (_event, projectId: string, updates: UpdateProjectInput) => {
    try {
      const data = loadProjects();
      const projectIndex = data.projects.findIndex((p) => p.id === projectId);

      if (projectIndex === -1) {
        return { success: false, error: 'Project not found' };
      }

      data.projects[projectIndex] = {
        ...data.projects[projectIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      saveProjects(data);
      return { success: true, project: data.projects[projectIndex] };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Delete project
  ipcMain.handle('project:delete', async (_event, projectId: string) => {
    try {
      const data = loadProjects();
      const projectIndex = data.projects.findIndex((p) => p.id === projectId);

      if (projectIndex === -1) {
        return { success: false, error: 'Project not found' };
      }

      const project = data.projects[projectIndex];

      // Delete work directory: {workspaceDir}/apps/{sanitized_app_name}
      try {
        const sanitizedAppName = sanitizeAppName(project.name);
        const workDir = path.join(project.workspaceDir, 'apps', sanitizedAppName);

        if (fs.existsSync(workDir)) {
          fs.rmSync(workDir, { recursive: true, force: true });
        }
      } catch (fsError) {
        console.error('Error deleting work directory:', fsError);
        // Continue with project deletion even if directory deletion fails
        // Return warning but don't fail the entire operation
      }

      // Remove project from JSON
      data.projects.splice(projectIndex, 1);
      saveProjects(data);

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Start project execution via core/controller.py with gelab engine
  ipcMain.handle('project:start', async (_event, projectConfig: {
    platform: string;
    name: string;
    url?: string;
    device?: string;
    workspaceDir: string;
  }) => {
    try {
      const mainWindow = getMainWindow();

      // Load global config from config.json
      const appConfig = loadAppConfig();

      // Build 23 environment variables from config.json
      const configEnvVars = buildEnvFromConfig(appConfig);

      // Phase C Migration: Use core/controller.py with gelab engine
      const corePath = getCorePath();
      const controllerPath = path.join(corePath, 'controller.py');
      const projectRoot = path.dirname(corePath);

      // Sanitize app name (remove spaces) to match learn.py behavior
      const sanitizedAppName = sanitizeAppName(projectConfig.name);

      // Build parameters for the controller
      const taskParams = {
        platform: projectConfig.platform,
        app: sanitizedAppName,
        root_dir: projectConfig.workspaceDir,
        url: projectConfig.platform === 'web' ? projectConfig.url : undefined,
        device: projectConfig.device,
      };

      // Select engine based on platform
      // - web: browser_use (independent web automation engine)
      // - android: gelab (multi-platform engine)
      const engineName = projectConfig.platform === 'web' ? 'browser_use' : 'gelab';

      const args = [
        '-u',  // Unbuffered output for real-time logging
        controllerPath,
        '--engine', engineName,
        '--action', 'execute',
        '--task', `Explore ${projectConfig.name}`,
        '--params', JSON.stringify(taskParams),
      ];

      // Get Python environment and merge with config environment variables
      const pythonEnv = getPythonEnv();

      pythonProcess = spawnBundledPython(args, {
        cwd: projectRoot,  // Run from project root
        env: {
          ...pythonEnv,         // Python bundled environment variables
          ...configEnvVars,     // 23 config settings from config.json
          PYTHONPATH: projectRoot,
        }
      });

      pythonProcess.stdout?.on('data', (data) => {
        mainWindow?.webContents.send('project:output', data.toString());
      });

      pythonProcess.stderr?.on('data', (data) => {
        mainWindow?.webContents.send('project:error', data.toString());
      });

      pythonProcess.on('close', (code) => {
        mainWindow?.webContents.send('project:exit', code);
        pythonProcess = null;
      });

      return { success: true, pid: pythonProcess.pid };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Stop project execution
  ipcMain.handle('project:stop', async () => {
    if (pythonProcess) {
      pythonProcess.kill('SIGTERM');
      pythonProcess = null;
      return { success: true };
    }
    return { success: false, error: 'No running process' };
  });
}

/**
 * Cleanup function to kill python process on app exit
 */
export function cleanupProjectProcesses(): void {
  if (pythonProcess && !pythonProcess.killed) {
    pythonProcess.kill('SIGTERM');
    pythonProcess = null;
  }
}
