/**
 * Installation IPC handlers (Refactored)
 * Handles Playwright installation only
 * Python runtime and dependencies are pre-bundled
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import {
  checkPythonRuntime,
  checkPlaywrightBrowsers,
  installPlaywrightBrowsers
} from '../utils/python-runtime';

/**
 * Register all installation handlers
 */
export function registerInstallationHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // Environment check (simplified - Python is bundled)
  ipcMain.handle('env:check', async () => {
    try {
      console.log('[env:check] ========== Starting environment check ==========');

      // Check bundled Python runtime
      const pythonStatus = checkPythonRuntime();
      console.log('[env:check] Python status:', pythonStatus);

      if (!pythonStatus.available) {
        console.error('[env:check] Python runtime not available:', pythonStatus.error);
        return {
          success: false,
          error: pythonStatus.error,
          bundledPython: {
            exists: false,
            path: pythonStatus.pythonPath,
            version: null,
            isBundled: true,
          },
          playwright: {
            installed: false,
          }
        };
      }

      // Check Playwright browsers
      const playwrightInstalled = await checkPlaywrightBrowsers();
      console.log('[env:check] Playwright installed:', playwrightInstalled);

      const result = {
        success: true,
        bundledPython: {
          exists: true,
          path: pythonStatus.pythonPath,
          version: '3.11.9', // Bundled version
          isBundled: true,
        },
        playwright: {
          installed: playwrightInstalled,
        },
        appagent: {
          path: pythonStatus.appagentPath,
          exists: true,
        }
      };

      console.log('[env:check] Final result:', JSON.stringify(result, null, 2));
      console.log('[env:check] ========== Environment check complete ==========');

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[env:check] Error:', message);
      return { success: false, error: message };
    }
  });

  // Environment setup (simplified - only Playwright)
  ipcMain.handle('env:setup', async () => {
    try {
      console.log('[Environment Setup] Starting Playwright installation...');
      const mainWindow = getMainWindow();

      // Verify Python runtime is available
      const pythonStatus = checkPythonRuntime();
      if (!pythonStatus.available) {
        throw new Error(`Python runtime not available: ${pythonStatus.error}. Please run 'yarn python:build' first.`);
      }

      mainWindow?.webContents.send('env:progress', '✓ Python runtime verified\n');

      // Install Playwright browsers
      console.log('[Environment Setup] Installing Playwright browsers...');
      mainWindow?.webContents.send('env:progress', '\n🎭 Installing Playwright browsers...\n');

      const onProgress = (data: string) => mainWindow?.webContents.send('env:progress', data);
      const playwrightResult = await installPlaywrightBrowsers(onProgress);

      if (!playwrightResult.success) {
        throw new Error(`Failed to install Playwright: ${playwrightResult.error}`);
      }

      // Success!
      console.log('[Environment Setup] ✅ Setup complete!');
      mainWindow?.webContents.send('env:progress', '\n✅ Environment setup complete!\n');

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Environment Setup] ❌ Error:', message);
      getMainWindow()?.webContents.send('env:progress', `\n❌ Error: ${message}\n`);
      return { success: false, error: message };
    }
  });

  // Install Playwright browsers only
  ipcMain.handle('install:playwright', async () => {
    try {
      console.log('[Playwright] Starting installation...');
      const mainWindow = getMainWindow();

      const onProgress = (data: string) => {
        console.log('[Playwright]', data);
        mainWindow?.webContents.send('install:progress', data);
      };

      const result = await installPlaywrightBrowsers(onProgress);

      if (result.success) {
        console.log('[Playwright] ✓ Installation complete');
      } else {
        console.error('[Playwright] ✗ Installation failed:', result.error);
      }

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Playwright] Error:', message);
      return { success: false, error: message };
    }
  });

  // Install Android Studio (via Homebrew cask) - LEGACY
  ipcMain.handle('install:androidStudio', async () => {
    return new Promise((resolve) => {
      if (process.platform !== 'darwin') {
        resolve({ success: false, error: 'Android Studio installation via Homebrew is only supported on macOS' });
        return;
      }

      console.log('[Android Studio] Starting installation via Homebrew...');
      const install = spawn('brew', ['install', '--cask', 'android-studio']);

      let output = '';
      install.stdout?.on('data', (data) => {
        output += data.toString();
        console.log('[Android Studio] stdout:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.stderr?.on('data', (data) => {
        output += data.toString();
        console.log('[Android Studio] stderr:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.on('close', (code) => {
        console.log('[Android Studio] Installation finished with code:', code);
        resolve({ success: code === 0, output });
      });

      install.on('error', (error) => {
        console.error('[Android Studio] Error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  });

  // DEPRECATED: Python packages are pre-bundled
  ipcMain.handle('install:packages', async () => {
    console.warn('[install:packages] DEPRECATED: Python packages are pre-bundled in app');
    return {
      success: true,
      message: 'Python packages are pre-bundled. No installation needed.'
    };
  });

  // DEPRECATED: Python is bundled with app
  ipcMain.handle('install:python', async () => {
    console.warn('[install:python] DEPRECATED: Python is bundled with app');
    return {
      success: true,
      message: 'Python runtime is bundled with the app. No installation needed.'
    };
  });
}
