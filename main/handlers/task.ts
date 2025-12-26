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
import { spawnBundledPython, getPythonEnv, getLegacyScriptsPath, getCorePath, checkVenvStatus, isPythonInstalled } from '../utils/python-runtime';
import { calculateEstimatedCost, isLocalModel, fetchLiteLLMModels } from '../utils/litellm-providers';
import { Task, CreateTaskInput, UpdateTaskInput } from '../types';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

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

      // Phase C Migration: Use core.android instead of legacy and_controller
      const corePath = getCorePath();
      const pythonEnv = getPythonEnv();
      const projectRoot = path.dirname(corePath);

      // Run cleanup script using Python -c with inline code
      const cleanupCode = `
import sys
sys.path.insert(0, '${projectRoot.replace(/\\/g, '/')}')
from core.android import stop_emulator
stop_emulator()
`;

      const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
        cwd: projectRoot,
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
 * Execute a task
 */
export async function startTaskExecution(
  projectId: string,
  taskId: string,
  getMainWindow: () => BrowserWindow | null
): Promise<{ success: boolean; pid?: number; error?: string }> {
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

    // Common Python environment variables (Phase C: use core path for Android utilities)
    const corePath = getCorePath();
    const legacyScriptsDir = getLegacyScriptsPath();
    const pythonEnv = getPythonEnv();
    const scriptsDir = path.join(legacyScriptsDir, 'scripts');
    const projectRoot = path.dirname(corePath);

    // Store prelaunch result to pass to GELab
    let androidSetupResult: { success: boolean; device?: string; package_name?: string; error?: string } | undefined;

    // Load global config from config.json BEFORE setup
    const appConfig = loadAppConfig();

    // Build environment variables from config.json with task-specific model selection and max rounds
    const taskModel = task.modelProvider && task.modelName
      ? { provider: task.modelProvider, model: task.modelName }
      : undefined;
    const configEnvVars = buildEnvFromConfig(appConfig, taskModel, task.maxRounds);

    // For Android platform with APK source, install/prepare app before running task
    if (project.platform === 'android' && task.apkSource) {
      mainWindow?.webContents.send('task:output', {
        projectId,
        taskId,
        output: '[Setup] Preparing Android device and app...\n'
      });

      // Phase C Migration: Use core.android for prelaunch_app
      const apkSourceJson = JSON.stringify(task.apkSource);
      const setupCode = `
import sys
import json
sys.path.insert(0, '${projectRoot.replace(/\\/g, '/')}')
from core.android import prelaunch_app

apk_source = json.loads('${apkSourceJson.replace(/'/g, "\\'")}')
result = prelaunch_app(apk_source)
print('SETUP_RESULT:' + json.dumps(result))
`;

      androidSetupResult = await new Promise<{ success: boolean; device?: string; package_name?: string; error?: string }>((resolve) => {
        const setupProcess = spawnBundledPython(['-u', '-c', setupCode], {
          cwd: projectRoot,
          env: {
            ...pythonEnv,
            ...configEnvVars,  // ← Add config env vars (includes ANDROID_SDK_PATH)
            PYTHONPATH: projectRoot,
            PYTHONUNBUFFERED: '1'
          }
        });

        let stdout = '';

        setupProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          mainWindow?.webContents.send('task:output', { projectId, taskId, output: `[Setup] ${output}` });
        });

        setupProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          mainWindow?.webContents.send('task:output', { projectId, taskId, output: `[Setup] ${output}` });
        });

        setupProcess.on('close', (code) => {
          const resultMatch = stdout.match(/SETUP_RESULT:(.+)/);
          if (resultMatch) {
            try {
              resolve(JSON.parse(resultMatch[1]));
            } catch {
              resolve({ success: code === 0, error: 'Failed to parse setup result' });
            }
          } else {
            resolve({ success: code === 0, error: code !== 0 ? 'App setup failed' : undefined });
          }
        });

        setupProcess.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
      });

      if (!androidSetupResult.success) {
        // Update task status to failed
        task.status = 'failed';
        task.output = `App setup failed: ${androidSetupResult.error}`;
        task.completedAt = new Date().toISOString();
        saveProjects(data);

        mainWindow?.webContents.send('task:error', {
          projectId,
          taskId,
          error: `App setup failed: ${androidSetupResult.error}`
        });

        return { success: false, error: `App setup failed: ${androidSetupResult.error}` };
      }

      mainWindow?.webContents.send('task:output', {
        projectId,
        taskId,
        output: `[Setup] Device ready: ${androidSetupResult.device}, Package: ${androidSetupResult.package_name}\n`
      });
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

    // Initialize metrics with start time
    task.metrics = {
      startTime: Date.now(),
      isLocalModel: task.modelName ? isLocalModel(task.modelName) : undefined,
    };

    saveProjects(data);

    // Note: appConfig and configEnvVars already loaded above before setup

    // Start Python process via Core Controller (corePath already declared above)
    const controllerPath = path.join(corePath, 'controller.py');

    // Build parameters for the new controller
    const taskParams = {
      platform: project.platform,
      app: sanitizedAppName,
      root_dir: project.workspaceDir,
      task_dir: taskDir,
      task_desc: task.goal || task.description,
      url: project.platform === 'web' ? task.url : undefined,
      model_name: task.modelName,
      max_rounds: task.maxRounds,
      // Pass device and package info from prelaunch_app for GELab to use
      device: androidSetupResult?.device,
      package_name: androidSetupResult?.package_name,
      // Add other necessary params here
    };

    // Select engine based on platform
    // - web: browser_use (independent web automation engine)
    // - android: appagent (legacy AppAgent engine)
    const engineName = project.platform === 'web' ? 'browser_use' : 'appagent';

    // Build CLI parameters for controller
    const args = [
      '-u',  // Unbuffered output
      controllerPath,
      '--engine', engineName,
      '--action', 'execute',
      '--task', task.goal || task.description || 'No description',
      '--params', JSON.stringify(taskParams)
    ];

    // Add Android SDK default paths to PATH for adb/emulator detection
    const androidSdkPath = path.join(os.homedir(), 'Library', 'Android', 'sdk');
    const androidPaths = `${path.join(androidSdkPath, 'platform-tools')}:${path.join(androidSdkPath, 'emulator')}`;
    const updatedPath = `${androidPaths}:${pythonEnv.PATH || process.env.PATH}`;

    console.log(`[task:${taskId}] Starting Python Controller with args:`, args);

    // Set PYTHONPATH to include project root so core and engines modules are resolvable
    // We assume the structure is:
    // root/
    //   core/
    //   engines/
    //   resources/engines/appagent_legacy/scripts/ (legacy)

    // In dev, corePath is .../core. In prod, it's resources/core.
    // We want the parent of corePath to be in PYTHONPATH.
    // projectRoot already declared at the top of this function

    const extendedPythonPath = [
      projectRoot,
      legacyScriptsDir,
      scriptsDir,
      pythonEnv.PYTHONPATH
    ].filter(Boolean).join(path.delimiter);

    const taskProcess = spawnBundledPython(args, {
      cwd: projectRoot,  // Run from project root
      env: {
        ...pythonEnv,         // Python bundled environment variables
        ...configEnvVars,     // 22 config settings from config.json
        PYTHONPATH: extendedPythonPath, // Extended PYTHONPATH
        PATH: updatedPath,    // Add Android SDK tools to PATH
        PYTHONUNBUFFERED: '1', // Force unbuffered output
        PYTHONIOENCODING: 'utf-8' // Fix Unicode encoding issues on Windows
      }
    });

    console.log(`[task:${taskId}] Process spawned with PID:`, taskProcess.pid);
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

        // Parse PROGRESS JSON from output and update task metrics
        const progressMatch = output.match(/PROGRESS:(\{.*\})/);
        if (progressMatch) {
          try {
            const progress = JSON.parse(progressMatch[1]);

            // Update metrics with new data
            currentTask.metrics = {
              ...currentTask.metrics,
              rounds: progress.round,
              maxRounds: progress.maxRounds,
              tokens: progress.totalTokens,
              inputTokens: progress.inputTokens || 0,
              outputTokens: progress.outputTokens || 0,
            };

            // Calculate cost if using paid API model
            if (currentTask.modelName && !isLocalModel(currentTask.modelName)) {
              // Fetch pricing data and calculate cost
              fetchLiteLLMModels().then((result) => {
                if (result.success && result.providers && currentTask.metrics) {
                  const cost = calculateEstimatedCost(
                    currentTask.modelName!,
                    currentTask.metrics.inputTokens || 0,
                    currentTask.metrics.outputTokens || 0,
                    result.providers
                  );
                  if (cost !== null && currentTask.metrics) {
                    currentTask.metrics.estimatedCost = cost;
                    // Re-send progress with updated cost
                    mainWindow?.webContents.send('task:progress', {
                      projectId,
                      taskId,
                      metrics: currentTask.metrics
                    });
                    // Save updated metrics
                    const latestData = loadProjects();
                    const latestProject = latestData.projects.find((p) => p.id === projectId);
                    const latestTask = latestProject?.tasks.find((t) => t.id === taskId);
                    if (latestTask) {
                      latestTask.metrics = currentTask.metrics;
                      saveProjects(latestData);
                    }
                  }
                }
              }).catch((error) => {
                console.warn('[task:progress] Failed to fetch pricing data:', error);
              });
            }

            // Send progress event to renderer
            mainWindow?.webContents.send('task:progress', {
              projectId,
              taskId,
              metrics: currentTask.metrics
            });
          } catch (parseError) {
            console.warn('[task:progress] Failed to parse progress JSON:', parseError);
          }
        }

        saveProjects(currentData);
      }
    });

    taskProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      // Log stderr to console for debugging
      console.error(`[task:${taskId}] stderr:`, error);

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
      console.log(`[task:${taskId}] Process closed with exit code:`, code);

      const currentData = loadProjects();
      const currentProject = currentData.projects.find((p) => p.id === projectId);
      const currentTask = currentProject?.tasks.find((t) => t.id === taskId);

      if (currentTask) {
        // Only update if still in 'running' status
        // Don't overwrite 'cancelled', 'completed', or 'failed' (may be set by stop or error handler)
        if (currentTask.status === 'running') {
          const newStatus = code === 0 ? 'completed' : 'failed';
          currentTask.status = newStatus;
          currentTask.completedAt = new Date().toISOString();
          currentTask.updatedAt = new Date().toISOString();

          // Calculate final execution metrics
          if (currentTask.metrics?.startTime) {
            currentTask.metrics.endTime = Date.now();
            currentTask.metrics.durationMs = currentTask.metrics.endTime - currentTask.metrics.startTime;

            // Calculate tokens per second for local models
            if (currentTask.metrics.isLocalModel &&
              currentTask.metrics.tokens &&
              currentTask.metrics.durationMs > 0) {
              currentTask.metrics.tokensPerSecond = Math.round(
                currentTask.metrics.tokens / (currentTask.metrics.durationMs / 1000)
              );
            }
          }

          saveProjects(currentData);

          // Send complete event
          console.log(`[task:${taskId}] Task completed with status: ${newStatus}, sending task:complete event`);
          mainWindow?.webContents.send('task:complete', { projectId, taskId, code, status: newStatus });

          // Trigger schedule queue to check for next pending scheduled task
          scheduleQueueManager.triggerCheck();
        }
      }

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

      // Update task status to failed on process error
      const currentData = loadProjects();
      const currentProject = currentData.projects.find((p) => p.id === projectId);
      const currentTask = currentProject?.tasks.find((t) => t.id === taskId);

      if (currentTask && currentTask.status === 'running') {
        currentTask.status = 'failed';
        currentTask.error = error.message;
        currentTask.completedAt = new Date().toISOString();
        currentTask.updatedAt = new Date().toISOString();
        saveProjects(currentData);

        mainWindow?.webContents.send('task:complete', { projectId, taskId, code: 1 });

        // Trigger schedule queue to check for next pending scheduled task
        scheduleQueueManager.triggerCheck();
      }

      taskProcesses.delete(taskId);
    });

    return { success: true, pid: taskProcess.pid };
  } catch (error: unknown) {
    return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
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
        maxRounds: taskInput.maxRounds,
        url: taskInput.url,
        apkSource: taskInput.apkSource,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        scheduledAt: taskInput.scheduledAt,
        isScheduled: taskInput.isScheduled,
      };

      project.tasks.push(newTask);
      project.updatedAt = new Date().toISOString();

      // Save last used APK source for this project (Android only)
      if (taskInput.apkSource) {
        project.lastApkSource = taskInput.apkSource;
      }

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
    return startTaskExecution(projectId, taskId, getMainWindow);
  });

  // Stop task execution
  ipcMain.handle('task:stop', async (_event, projectId: string, taskId: string) => {
    try {
      const mainWindow = getMainWindow();
      const taskProcess = taskProcesses.get(taskId);

      if (!taskProcess) {
        return { success: false, error: 'Task not running' };
      }

      taskProcess.kill('SIGTERM');
      taskProcesses.delete(taskId);

      // Cleanup browser processes spawned by Browser-Use
      // Browser-Use's internal signal handler uses os._exit(0) which bypasses our Python cleanup
      // So we need to kill Chromium processes from Electron side
      const { execSync } = require('child_process');
      try {
        // Kill Chrome for Testing processes (cross-platform)
        if (process.platform === 'darwin' || process.platform === 'linux') {
          execSync('pkill -f "Google Chrome for Testing" 2>/dev/null || true');
        } else if (process.platform === 'win32') {
          execSync('taskkill /F /IM "Google Chrome for Testing.exe" /T 2>nul || exit 0', { shell: true });
        }
        console.log(`[task:${taskId}] Browser processes cleaned up`);
      } catch (e) {
        // Ignore errors - browser may already be closed
      }

      // Update task status to 'cancelled' (user-initiated stop)
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);
      const task = project?.tasks.find((t) => t.id === taskId);

      if (task) {
        task.status = 'cancelled';
        task.completedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        saveProjects(data);
      }

      // Emit task:complete event to notify frontend immediately
      // Using special code -1 to indicate user-initiated cancellation
      mainWindow?.webContents.send('task:complete', { projectId, taskId, code: -1 });

      // Trigger schedule queue to check for next pending scheduled task
      scheduleQueueManager.triggerCheck();

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

    // Phase C Migration: Use core.android for cleanup_emulators
    const corePath = getCorePath();
    const pythonEnv = getPythonEnv();
    const projectRoot = path.dirname(corePath);

    const cleanupCode = `
import sys
sys.path.insert(0, '${projectRoot.replace(/\\/g, '/')}')
from core.android import cleanup_emulators
cleanup_emulators()
`;

    const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
      cwd: projectRoot,
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

