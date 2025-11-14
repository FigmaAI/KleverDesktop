/**
 * Task management IPC handlers
 * Handles CRUD operations for tasks and task execution
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { loadProjects, saveProjects, sanitizeAppName } from '../utils/project-storage';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types';

const taskProcesses = new Map<string, ChildProcess>();

/**
 * Register all task management handlers
 */
export function registerTaskHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // Create new task
  ipcMain.handle('task:create', async (_event, taskInput: CreateTaskInput) => {
    try {
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === taskInput.projectId);

      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const newTask: Task = {
        id: `task_${Date.now()}`,
        projectId: taskInput.projectId,
        name: taskInput.name,
        description: taskInput.description,
        goal: taskInput.goal,
        model: taskInput.model,
        url: taskInput.url,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      project.tasks.push(newTask);
      project.updatedAt = new Date().toISOString();
      saveProjects(data);

      return { success: true, task: newTask };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Update task
  ipcMain.handle('task:update', async (_event, projectId: string, taskId: string, updates: UpdateTaskInput) => {
    try {
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);

      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const taskIndex = project.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) {
        return { success: false, error: 'Task not found' };
      }

      project.tasks[taskIndex] = {
        ...project.tasks[taskIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      project.updatedAt = new Date().toISOString();
      saveProjects(data);

      return { success: true, task: project.tasks[taskIndex] };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Delete task
  ipcMain.handle('task:delete', async (_event, projectId: string, taskId: string) => {
    try {
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);

      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const taskIndex = project.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) {
        return { success: false, error: 'Task not found' };
      }

      project.tasks.splice(taskIndex, 1);
      project.updatedAt = new Date().toISOString();
      saveProjects(data);

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Start task execution
  ipcMain.handle('task:start', async (_event, projectId: string, taskId: string) => {
    try {
      const mainWindow = getMainWindow();
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);

      if (!project) {
        return { success: false, error: 'Project not found' };
      }

      const task = project.tasks.find((t) => t.id === taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Update task status
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      task.output = '';
      saveProjects(data);

      // Start Python process
      const scriptPath = path.join(process.cwd(), 'appagent', 'scripts', 'self_explorer.py');

      // Sanitize app name (remove spaces) to match learn.py behavior
      const sanitizedAppName = sanitizeAppName(project.name);

      const args = [
        scriptPath,
        '--platform', project.platform,
        '--app', sanitizedAppName,
        '--root_dir', project.workspaceDir
      ];

      if (project.platform === 'web' && task.url) {
        args.push('--url', task.url);
      }

      // Set TASK_DESCRIPTION environment variable
      // Use task.goal if available, otherwise use task.description
      const taskDescription = task.goal || task.description;

      const taskProcess = spawn('python', args, {
        cwd: project.workspaceDir,
        env: {
          ...process.env,
          TASK_DESCRIPTION: taskDescription
        }
      });

      taskProcesses.set(taskId, taskProcess);

      taskProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        mainWindow?.webContents.send('task:output', { projectId, taskId, output });

        // Append to task output
        const currentData = loadProjects();
        const currentProject = currentData.projects.find((p) => p.id === projectId);
        const currentTask = currentProject?.tasks.find((t) => t.id === taskId);
        if (currentTask) {
          currentTask.output = (currentTask.output || '') + output;
          saveProjects(currentData);
        }
      });

      taskProcess.stderr?.on('data', (data) => {
        const error = data.toString();
        mainWindow?.webContents.send('task:error', { projectId, taskId, error });

        // Append to task output (stderr also goes to output)
        const currentData = loadProjects();
        const currentProject = currentData.projects.find((p) => p.id === projectId);
        const currentTask = currentProject?.tasks.find((t) => t.id === taskId);
        if (currentTask) {
          currentTask.output = (currentTask.output || '') + error;
          saveProjects(currentData);
        }
      });

      taskProcess.on('close', (code) => {
        const currentData = loadProjects();
        const currentProject = currentData.projects.find((p) => p.id === projectId);
        const currentTask = currentProject?.tasks.find((t) => t.id === taskId);

        if (currentTask) {
          currentTask.status = code === 0 ? 'completed' : 'failed';
          currentTask.completedAt = new Date().toISOString();
          currentTask.updatedAt = new Date().toISOString();
          saveProjects(currentData);
        }

        mainWindow?.webContents.send('task:complete', { projectId, taskId, code });
        taskProcesses.delete(taskId);
      });

      return { success: true, pid: taskProcess.pid };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Stop task execution
  ipcMain.handle('task:stop', async (_event, projectId: string, taskId: string) => {
    try {
      const taskProcess = taskProcesses.get(taskId);

      if (!taskProcess) {
        return { success: false, error: 'Task not running' };
      }

      taskProcess.kill('SIGTERM');
      taskProcesses.delete(taskId);

      // Update task status
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);
      const task = project?.tasks.find((t) => t.id === taskId);

      if (task) {
        task.status = 'failed';
        task.updatedAt = new Date().toISOString();
        saveProjects(data);
      }

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });
}

/**
 * Cleanup function to kill all task processes on app exit
 */
export function cleanupTaskProcesses(): void {
  taskProcesses.forEach((process) => {
    if (!process.killed) {
      process.kill('SIGTERM');
    }
  });
  taskProcesses.clear();
}
