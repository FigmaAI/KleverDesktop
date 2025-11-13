/**
 * Integration test IPC handlers
 * Handles running and stopping integration tests
 */

import { IpcMain, BrowserWindow } from 'electron';
import { ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ModelConfig } from '../types';
import { spawnVenvPython, getPythonEnv } from '../utils/python-manager';

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

      // Determine model provider
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
        MODEL: modelProvider,
        ENABLE_LOCAL: config.enableLocal.toString(),
        ENABLE_API: config.enableApi.toString(),
        API_BASE_URL: config.apiBaseUrl || '',
        API_KEY: config.apiKey || '',
        API_MODEL: config.apiModel || '',
        LOCAL_BASE_URL: config.localBaseUrl || '',
        LOCAL_MODEL: config.localModel || '',
        MAX_ROUNDS: '2',
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

      // Use venv Python to run the integration test
      // Note: self_explorer.py only accepts --app, --root_dir, and --platform arguments
      integrationTestProcess = spawnVenvPython(
        [
          '-u',
          selfExplorerScript,
          '--app',
          'google_search_test',
          '--platform',
          'web',
          '--root_dir',
          '.',
        ],
        {
          cwd: path.join(process.cwd(), 'appagent'),
          env: env,
        }
      );

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
          mainWindow?.webContents.send('integration:output', 'Integration test PASSED ✓\n');
          mainWindow?.webContents.send('integration:output', '============================================================\n');
        } else {
          mainWindow?.webContents.send('integration:output', 'Integration test FAILED (exit code: ' + code + ')\n');
          mainWindow?.webContents.send('integration:output', '============================================================\n');
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
