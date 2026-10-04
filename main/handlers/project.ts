/** Native project storage. Every execution goes through the recorded task runner. */
import { IpcMain } from 'electron';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import {
  loadProjects,
  saveProjects,
  getProjectWorkspaceDir,
  ensureDirectoryExists,
  sanitizeAppName,
} from '../utils/project-storage';
import { Project, CreateProjectInput, UpdateProjectInput } from '../types';
import { isProjectExecutionActive } from './task';


/**
 * Register all project management handlers
 */
export function registerProjectHandlers(ipcMain: IpcMain): void {
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
      if (projectInput.platform !== 'android') return { success: false, error: 'Only Android projects are supported.' };
      if (typeof projectInput.name !== 'string' || !projectInput.name.trim() || /[\\/]/.test(projectInput.name) || ['.', '..'].includes(projectInput.name.trim())) {
        return { success: false, error: 'Enter a project name without path separators.' };
      }
      const data = loadProjects();

      const workspaceDir = projectInput.workspaceDir || getProjectWorkspaceDir(projectInput.name.trim());

      const newProject: Project = {
        id: `proj_${randomUUID()}`,
        name: projectInput.name.trim(),
        platform: projectInput.platform,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tasks: [],
        testCases: [],
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

      // Keep native test captures beneath the project workspace
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
        ...(typeof updates.name === 'string' && updates.name.trim() && !/[\\/]/.test(updates.name) && !['.', '..'].includes(updates.name.trim()) ? { name: updates.name.trim() } : {}),
        ...(updates.status === 'active' || updates.status === 'archived' ? { status: updates.status } : {}),
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
      if (isProjectExecutionActive(projectId) || project.tasks.some(task => task.status === 'running')) {
        return { success: false, error: 'Wait for the test to stop and finish saving before deleting its project.' };
      }

      // Delete work directory: {workspaceDir}/apps/{sanitized_app_name}
      try {
        const sanitizedAppName = sanitizeAppName(project.name);
        const appsDir = path.resolve(project.workspaceDir, 'apps');
        const workDir = path.resolve(appsDir, sanitizedAppName);
        const relative = path.relative(appsDir, workDir);
        if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
          return { success: false, error: 'The stored project directory is invalid.' };
        }

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

}
