/**
 * Integration test IPC handlers
 * Handles running and stopping integration tests
 *
 * IMPORTANT: Integration test now uses config.json and CLI parameters
 */

import { IpcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { ModelConfig, Task } from '../types';
import { spawnBundledPython, getPythonEnv } from '../utils/python-runtime';
import { ensureDirectoryExists, loadProjects, saveProjects } from '../utils/project-storage';
import { loadAppConfig } from '../utils/config-storage';
import { buildEnvFromConfig } from '../utils/config-env-builder';

let integrationTestProcess: ChildProcess | null = null;
let currentTask: Task | null = null;
let currentTaskDir: string | null = null;

/**
 * Register all integration test handlers
 */
export function registerIntegrationHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // Run integration test
  ipcMain.handle('integration:test', async (_event, config: ModelConfig) => {
    try {
      const mainWindow = getMainWindow();
      const selfExplorerScript = path.join(process.cwd(), 'appagent', 'scripts', 'self_explorer.py');

      if (!fs.existsSync(selfExplorerScript)) {
        mainWindow?.webContents.send('integration:output', 'Error: self_explorer.py not found\n');
        mainWindow?.webContents.send('integration:complete', false);
        return { success: false };
      }

      // Load global config from config.json
      const appConfig = loadAppConfig();

      // Build 23 environment variables from config.json
      const configEnvVars = buildEnvFromConfig(appConfig);

      // Override MAX_ROUNDS for integration test (only 2 rounds)
      configEnvVars.MAX_ROUNDS = '2';

      // Determine model provider for display
      let modelProvider = 'local';
      if (config.enableApi && config.enableLocal) {
        modelProvider = 'api';
      } else if (config.enableApi) {
        modelProvider = 'api';
      } else if (config.enableLocal) {
        modelProvider = 'local';
      }

      // Prepare environment variables (merge with venv environment)
      const venvEnv = getPythonEnv();
      const env = {
        ...venvEnv,
        ...configEnvVars  // Use config.json environment variables
      };

      mainWindow?.webContents.send('integration:output', '============================================================\n');
      mainWindow?.webContents.send('integration:output', 'Klever Desktop Integration Test\n');
      mainWindow?.webContents.send('integration:output', '============================================================\n\n');
      mainWindow?.webContents.send('integration:output', 'Model Provider: ' + modelProvider + '\n');

      if (modelProvider === 'local') {
        mainWindow?.webContents.send('integration:output', '\n');
        mainWindow?.webContents.send('integration:output', '⚠️  LOCAL MODEL PERFORMANCE NOTICE\n');
        mainWindow?.webContents.send('integration:output', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        mainWindow?.webContents.send('integration:output', 'You are using a local Ollama model for this test.\n');
        mainWindow?.webContents.send('integration:output', 'This test may take 3-5 minutes or longer, depending on:\n');
        mainWindow?.webContents.send('integration:output', '  • Your hardware (CPU/GPU performance)\n');
        mainWindow?.webContents.send('integration:output', '  • Model size (larger models = slower inference)\n');
        mainWindow?.webContents.send('integration:output', '  • System resources (RAM, other running processes)\n\n');
        mainWindow?.webContents.send('integration:output', 'Expected response times per round:\n');
        mainWindow?.webContents.send('integration:output', '  • Vision analysis: 60-120 seconds\n');
        mainWindow?.webContents.send('integration:output', '  • Reflection: 15-30 seconds\n');
        mainWindow?.webContents.send('integration:output', '  • Total for 2 rounds: ~3-5 minutes\n\n');
        mainWindow?.webContents.send('integration:output', 'For faster testing, consider using API models (OpenAI, etc.)\n');
        mainWindow?.webContents.send('integration:output', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
      }

      mainWindow?.webContents.send('integration:output', 'Testing with Google search...\n\n');

      // Kill existing test process if running
      if (integrationTestProcess) {
        integrationTestProcess.kill('SIGTERM');
        integrationTestProcess = null;
      }

      // Setup workspace directory for integration test
      const homeDir = os.homedir();
      const workspaceDir = path.join(homeDir, 'Documents');
      ensureDirectoryExists(workspaceDir);

      // Create or get project
      const data = loadProjects();
      let project = data.projects.find(p => p.name === 'Feeling_Lucky');
      
      if (!project) {
        project = {
          id: `proj_${Date.now()}`,
          name: 'Feeling_Lucky',
          platform: 'web',
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tasks: [],
          workspaceDir: workspaceDir,
        };
        data.projects.push(project);
        mainWindow?.webContents.send('integration:output', '📦 Creating project "Feeling_Lucky"...\n');
      } else {
        mainWindow?.webContents.send('integration:output', '📦 Using existing project "Feeling_Lucky"...\n');
      }

      // Create task for this test run
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      const taskName = `Integration_Test_${timestamp}`;
      currentTask = {
        id: `task_${Date.now()}`,
        projectId: project.id,
        name: taskName,
        description: 'Automated integration test for setup validation',
        goal: 'Find and click the "I\'m Feeling Lucky" button',
        status: 'running',
        url: 'https://www.google.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };

      project.tasks.push(currentTask);
      project.updatedAt = new Date().toISOString();
      saveProjects(data);

      // Create task directory structure
      const appsDir = path.join(workspaceDir, 'apps', 'Feeling_Lucky');
      const demosDir = path.join(appsDir, 'demos');
      currentTaskDir = path.join(demosDir, `self_explore_${timestamp.replace(/-/g, '_')}`);
      
      ensureDirectoryExists(appsDir);
      ensureDirectoryExists(demosDir);
      ensureDirectoryExists(currentTaskDir);

      mainWindow?.webContents.send('integration:output', `📝 Created task "${taskName}"\n`);
      mainWindow?.webContents.send('integration:output', `   Task directory: ${currentTaskDir}\n\n`);

      // Use bundled Python to run the integration test with --task_dir and --task_desc
      integrationTestProcess = spawnBundledPython(
        [
          '-u',
          selfExplorerScript,
          '--app',
          'Feeling_Lucky',
          '--platform',
          'web',
          '--root_dir',
          workspaceDir,
          '--task_dir',
          currentTaskDir,
          '--task_desc',
          'Find and click the "I\'m Feeling Lucky" button',
          '--url',
          'https://www.google.com',
        ],
        {
          cwd: path.join(process.cwd(), 'appagent'),
          env: env,
        }
      );

      if (!integrationTestProcess) {
        mainWindow?.webContents.send('integration:output', 'Error: Failed to start integration test process\n');
        mainWindow?.webContents.send('integration:complete', false);
        return { success: false };
      }

      console.log('[Integration Test] Process started with PID:', integrationTestProcess.pid);

      integrationTestProcess.stdout?.on('data', (data) => {
        mainWindow?.webContents.send('integration:output', data.toString());
      });

      integrationTestProcess.stderr?.on('data', (data) => {
        mainWindow?.webContents.send('integration:output', data.toString());
      });

      integrationTestProcess.on('close', (code) => {
        mainWindow?.webContents.send('integration:output', '\n============================================================\n');
        
        // Update task status based on result
        try {
          const data = loadProjects();
          const project = data.projects.find(p => p.name === 'Feeling_Lucky');
          
          if (project && currentTask && currentTaskDir) {
            const taskToUpdate = project.tasks.find(t => t.id === currentTask!.id);
            
            if (taskToUpdate) {
              taskToUpdate.status = code === 0 ? 'completed' : 'failed';
              taskToUpdate.completedAt = new Date().toISOString();
              taskToUpdate.updatedAt = new Date().toISOString();
              taskToUpdate.resultPath = currentTaskDir;
              
              // Check if log file exists and read it for output
              const reportPath = path.join(currentTaskDir, 'log_report.md');
              if (fs.existsSync(reportPath)) {
                const output = fs.readFileSync(reportPath, 'utf8');
                taskToUpdate.output = output.substring(0, 1000); // Store first 1000 chars
              }
              
              project.updatedAt = new Date().toISOString();
              saveProjects(data);
              
              console.log(`[Integration Test] Updated task status: ${taskToUpdate.status}`);
            }
          }
        } catch (error) {
          console.error('[Integration Test] Failed to update task status:', error);
        }
        
        if (code === 0) {
          mainWindow?.webContents.send('integration:output', '✅ Integration test PASSED - All 2 rounds completed successfully!\n');
          mainWindow?.webContents.send('integration:output', '============================================================\n');
          mainWindow?.webContents.send('integration:output', '\n✨ Project and task have been saved!\n');
          if (currentTaskDir) {
            mainWindow?.webContents.send('integration:output', `   View results in: ${currentTaskDir}\n`);
          }
          console.log('[Integration Test] ✅ Test completed successfully');
        } else {
          mainWindow?.webContents.send('integration:output', `❌ Integration test FAILED (exit code: ${code})\n`);
          mainWindow?.webContents.send('integration:output', '============================================================\n');
          console.log(`[Integration Test] ❌ Test failed with code: ${code}`);
        }
        
        mainWindow?.webContents.send('integration:complete', code === 0);
        integrationTestProcess = null;
        currentTask = null;
        currentTaskDir = null;
      });

      return { success: true };
    } catch (error: unknown) {
      const mainWindow = getMainWindow();
      const message = error instanceof Error ? error.message : 'Unknown error';
      mainWindow?.webContents.send('integration:output', 'Error: ' + message + '\n');
      mainWindow?.webContents.send('integration:complete', false);
      return { success: false };
    }
  });

  // Stop integration test
  ipcMain.handle('integration:stop', async () => {
    const mainWindow = getMainWindow();
    if (integrationTestProcess) {
      integrationTestProcess.kill('SIGTERM');
      integrationTestProcess = null;
      
      // Update task status to cancelled
      if (currentTask && currentTaskDir) {
        try {
          const data = loadProjects();
          const project = data.projects.find(p => p.name === 'Feeling_Lucky');
          
          if (project) {
            const taskToUpdate = project.tasks.find(t => t.id === currentTask!.id);
            if (taskToUpdate) {
              taskToUpdate.status = 'cancelled';
              taskToUpdate.updatedAt = new Date().toISOString();
              project.updatedAt = new Date().toISOString();
              saveProjects(data);
            }
          }
        } catch (error) {
          console.error('[Integration Test] Failed to update task status on stop:', error);
        }
      }
      
      currentTask = null;
      currentTaskDir = null;
      
      mainWindow?.webContents.send('integration:output', '\n[Test stopped by user]\n');
      mainWindow?.webContents.send('integration:complete', false);
      return { success: true };
    }
    return { success: false, error: 'No running test' };
  });
}
