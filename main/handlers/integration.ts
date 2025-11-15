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
import { ModelConfig, Project } from '../types';
import { spawnVenvPython, getPythonEnv } from '../utils/python-manager';
import { ensureDirectoryExists, loadProjects, saveProjects } from '../utils/project-storage';
import { loadAppConfig } from '../utils/config-storage';
import { buildEnvFromConfig } from '../utils/config-env-builder';

let integrationTestProcess: ChildProcess | null = null;

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

      mainWindow?.webContents.send('integration:output', `Test results will be saved to: ${workspaceDir}/apps/Feeling_Lucky/\n\n`);

      // Use venv Python to run the integration test
      // Pass task info via CLI parameters (not environment variables)
      integrationTestProcess = spawnVenvPython(
        [
          '-u',
          selfExplorerScript,
          '--app',
          'Feeling_Lucky',
          '--platform',
          'web',
          '--root_dir',
          workspaceDir,
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
        if (code === 0) {
          mainWindow?.webContents.send('integration:output', '✅ Integration test PASSED - All 2 rounds completed successfully!\n');
          mainWindow?.webContents.send('integration:output', '============================================================\n');
          console.log('[Integration Test] ✅ Test completed successfully');

          // Auto-create project for the integration test
          try {
            const data = loadProjects();
            
            // Check if project already exists
            const existingProject = data.projects.find(p => p.name === 'Feeling_Lucky');
            
            if (!existingProject) {
              const newProject: Project = {
                id: `proj_${Date.now()}`,
                name: 'Feeling_Lucky',
                platform: 'web',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                tasks: [],
                workspaceDir: workspaceDir,
              };

              data.projects.push(newProject);
              saveProjects(data);
              
              mainWindow?.webContents.send('integration:output', '\n📦 Project "Feeling_Lucky" has been automatically created!\n');
              mainWindow?.webContents.send('integration:output', `   Location: ${workspaceDir}\n`);
              console.log('[Integration Test] Created project:', newProject.id);
            } else {
              console.log('[Integration Test] Project already exists, skipping creation');
            }
          } catch (error) {
            console.error('[Integration Test] Failed to create project:', error);
            // Don't fail the integration test if project creation fails
          }
        } else {
          mainWindow?.webContents.send('integration:output', `❌ Integration test FAILED (exit code: ${code})\n`);
          mainWindow?.webContents.send('integration:output', '============================================================\n');
          console.log(`[Integration Test] ❌ Test failed with code: ${code}`);
        }
        mainWindow?.webContents.send('integration:complete', code === 0);
        integrationTestProcess = null;
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
      mainWindow?.webContents.send('integration:output', '\n[Test stopped by user]\n');
      mainWindow?.webContents.send('integration:complete', false);
      return { success: true };
    }
    return { success: false, error: 'No running test' };
  });
}
