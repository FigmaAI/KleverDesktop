/**
 * Project management IPC handlers
 * Handles CRUD operations for projects and project execution
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import {
  loadProjects,
  saveProjects,
  getProjectWorkspaceDir,
  ensureDirectoryExists,
} from '../utils/project-storage';
import { CreateProjectInput, UpdateProjectInput } from '../types';

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

      const newProject = {
        id: `proj_${Date.now()}`,
        name: projectInput.name,
        platform: projectInput.platform,
        device: projectInput.device,
        url: projectInput.url,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        workspaceDir: getProjectWorkspaceDir(projectInput.name),
      };

      // Create workspace directory
      ensureDirectoryExists(newProject.workspaceDir);

      data.projects.push(newProject);
      saveProjects(data);

      return { success: true, project: newProject };
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

      data.projects.splice(projectIndex, 1);
      saveProjects(data);

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Start self_explorer for a project
  ipcMain.handle('project:start', async (_event, projectConfig: {
    platform: string;
    name: string;
    url?: string;
    device?: string;
  }) => {
    try {
      const mainWindow = getMainWindow();
      const scriptPath = path.join(process.cwd(), 'appagent', 'scripts', 'self_explorer.py');
      const args = [scriptPath, '--platform', projectConfig.platform, '--app', projectConfig.name];

      if (projectConfig.platform === 'web' && projectConfig.url) {
        args.push('--url', projectConfig.url);
      }

      if (projectConfig.device) {
        args.push('--device', projectConfig.device);
      }

      pythonProcess = spawn('python', args);

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

  // Stop self_explorer
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
