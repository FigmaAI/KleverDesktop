/**
 * Task management IPC handlers
 * Handles CRUD operations for tasks and task execution
 *
 * IMPORTANT: Task execution now passes data via:
 * - CLI parameters: Project info (app, platform, root_dir) + Task info (task_desc, url, model, model_name)
 * - Environment variables: 22 config settings from config.json
 */

import { IpcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadProjects, saveProjects, sanitizeAppName } from '../utils/project-storage';
import { loadAppConfig } from '../utils/config-storage';
import { buildEnvFromConfig } from '../utils/config-env-builder';
import { spawnBundledPython, getPythonEnv, getAppagentPath, checkVenvStatus, isPythonInstalled } from '../utils/python-runtime';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types';

const taskProcesses = new Map<string, ChildProcess>();

/**
 * Check if there are any pending or running Android tasks across all projects
 * If not, stop the emulator to save resources
 */
async function cleanupEmulatorIfIdle(projectsData: ReturnType<typeof loadProjects>): Promise<void> {
  // Check all projects for pending/running Android tasks
  const hasActiveAndroidTasks = projectsData.projects.some((project) => {
    if (project.platform !== 'android') return false;
    return project.tasks.some((task) => task.status === 'pending' || task.status === 'running');
  });

  if (!hasActiveAndroidTasks) {
    try {
      // Check if python environment is valid before trying to run cleanup
      const status = checkVenvStatus();
      if (!status.valid) {
        return;
      }

      // Call Python script to stop emulator
      const appagentDir = getAppagentPath();
      const pythonEnv = getPythonEnv();

      // Run cleanup script using Python -c with inline code
      const scriptsDir = path.join(appagentDir, 'scripts');
      const cleanupCode = `
import sys
sys.path.insert(0, '${appagentDir.replace(/\\/g, '/')}')
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from scripts.and_controller import stop_emulator
stop_emulator()
`;
      
      const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
        cwd: appagentDir,
        env: pythonEnv,
      });

      cleanupProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('[emulator-cleanup] Failed to stop emulator (exit code:', code, ')');
        }
      });
    } catch (error) {
      console.error('[emulator-cleanup] Error stopping emulator:', error);
    }
  }
}

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
        modelProvider: taskInput.modelProvider,
        modelName: taskInput.modelName,
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

      const task = project.tasks[taskIndex];

      // Delete task result folder if it exists
      if (task.resultPath) {
        try {
          if (fs.existsSync(task.resultPath)) {
            fs.rmSync(task.resultPath, { recursive: true, force: true });
          }
        } catch (fsError) {
          console.warn(`[task:delete] Failed to delete result folder: ${fsError}`);
          // Continue with task deletion even if folder deletion fails
        }
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

      // Check if Python environment is valid
      if (!isPythonInstalled()) {
        return { success: false, error: 'Python runtime not found. Please run the Setup Wizard.' };
      }

      const venvStatus = checkVenvStatus();
      if (!venvStatus.valid) {
        return { success: false, error: 'Python virtual environment is invalid. Please run the Setup Wizard.' };
      }

      // Sanitize app name (remove spaces) to match learn.py behavior
      const sanitizedAppName = sanitizeAppName(project.name);

      // Calculate task directory path (matches Python script's logic)
      // {workspaceDir}/apps/{sanitizedAppName}/demos/self_explore_{timestamp}
      const appsDir = path.join(project.workspaceDir, 'apps', sanitizedAppName, 'demos');
      const timestamp = new Date().toISOString().replace(/[-:]/g, '-').replace(/\..+/, '').replace('T', '_');
      const taskDirName = `self_explore_${timestamp}`;
      const taskDir = path.join(appsDir, taskDirName);

      // Update task status
      task.status = 'running';
      task.startedAt = new Date().toISOString();
      task.output = '';
      task.resultPath = taskDir;  // Store task directory path

      saveProjects(data);

      // Load global config from config.json
      const appConfig = loadAppConfig();

      // Build 24 environment variables from config.json
      const configEnvVars = buildEnvFromConfig(appConfig);

      // Start Python process
      const appagentDir = getAppagentPath();
      const scriptPath = path.join('scripts', 'self_explorer.py'); // Relative path from appagent dir

      // Build CLI parameters
      // Project info (always required)
      const args = [
        '-u',  // Unbuffered output for real-time logging
        scriptPath,
        '--platform', project.platform,
        '--app', sanitizedAppName,
        '--root_dir', project.workspaceDir,
        '--task_dir', taskDir,
      ];

      // Task description (required) - passed as CLI parameter
      const taskDescription = task.goal || task.description;
      if (taskDescription) {
        args.push('--task_desc', taskDescription);
      }

      // Web URL (required for web platform) - passed as CLI parameter
      if (project.platform === 'web' && task.url) {
        args.push('--url', task.url);
      }

      // Model override (optional) - passed as CLI parameters
      if (task.modelProvider) {
        args.push('--model', task.modelProvider);
      }
      if (task.modelName) {
        args.push('--model_name', task.modelName);
      }

      // Get Python environment and merge with config environment variables
      const pythonEnv = getPythonEnv();

      // Add appagent/scripts to PYTHONPATH so imports work
      const scriptsDir = path.join(appagentDir, 'scripts');
      const existingPythonPath = pythonEnv.PYTHONPATH || '';
      const pythonPath = existingPythonPath
        ? `${scriptsDir}${path.delimiter}${existingPythonPath}`
        : scriptsDir;

      // Add Android SDK default paths to PATH for adb/emulator detection
      const androidSdkPath = path.join(os.homedir(), 'Library', 'Android', 'sdk');
      const androidPaths = `${path.join(androidSdkPath, 'platform-tools')}:${path.join(androidSdkPath, 'emulator')}`;
      const updatedPath = `${androidPaths}:${pythonEnv.PATH || process.env.PATH}`;

      // NO WRAPPER: Run self_explorer.py directly
      // This simplifies execution and avoids path/import issues
      const taskProcess = spawnBundledPython(args, {
        cwd: appagentDir,  // Run from appagent directory to ensure relative imports work
        env: {
          ...pythonEnv,         // Python bundled environment variables
          ...configEnvVars,     // 22 config settings from config.json
          PYTHONPATH: pythonPath, // Add scripts directory to PYTHONPATH
          PATH: updatedPath,    // Add Android SDK tools to PATH
          PYTHONUNBUFFERED: '1', // Force unbuffered output
          PYTHONIOENCODING: 'utf-8' // Fix Unicode encoding issues on Windows
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

      taskProcess.on('close', async (code) => {
        const currentData = loadProjects();
        const currentProject = currentData.projects.find((p) => p.id === projectId);
        const currentTask = currentProject?.tasks.find((t) => t.id === taskId);

        if (currentTask) {
          const newStatus = code === 0 ? 'completed' : 'failed';
          currentTask.status = newStatus;
          currentTask.completedAt = new Date().toISOString();
          currentTask.updatedAt = new Date().toISOString();
          saveProjects(currentData);
        }

        mainWindow?.webContents.send('task:complete', { projectId, taskId, code });
        taskProcesses.delete(taskId);

        // Auto-cleanup emulator if no more pending Android tasks
        if (currentProject?.platform === 'android') {
          await cleanupEmulatorIfIdle(currentData);
        }
      });

      taskProcess.on('error', (error) => {
        console.error(`[task:${taskId}] Process error:`, error);
        mainWindow?.webContents.send('task:error', { 
          projectId, 
          taskId, 
          error: `Process error: ${error.message}` 
        });
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

      // Auto-cleanup emulator if no more pending Android tasks
      if (project?.platform === 'android') {
        await cleanupEmulatorIfIdle(data);
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
export async function cleanupTaskProcesses(): Promise<void> {
  taskProcesses.forEach((process) => {
    if (!process.killed) {
      process.kill('SIGTERM');
    }
  });
  taskProcesses.clear();

  // Always cleanup emulators on app exit
  try {
    // Check if python environment is valid before trying to run cleanup
    const status = checkVenvStatus();
    if (!status.valid) {
      console.log('[app-exit] Python environment not valid, skipping emulator cleanup');
      return;
    }

    const appagentDir = getAppagentPath();
    const pythonEnv = getPythonEnv();

    const cleanupCode = `
import sys
sys.path.insert(0, '${appagentDir.replace(/\\/g, '/')}')
from scripts.and_controller import cleanup_emulators
cleanup_emulators()
`;

    const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
      cwd: appagentDir,
      env: pythonEnv,
    });

    // Wait for cleanup to complete
    await new Promise<void>((resolve) => {
      cleanupProcess.on('close', () => resolve());

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!cleanupProcess.killed) {
          cleanupProcess.kill('SIGTERM');
        }
        resolve();
      }, 5000);
    });
  } catch (error) {
    console.error('[app-exit] Error cleaning up emulators:', error);
  }
}
