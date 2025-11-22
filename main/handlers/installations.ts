/**
 * Installation IPC handlers (Runtime Download)
 * Handles Python and Playwright installation during setup wizard
 * Python is downloaded post-install to reduce app bundle size
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import {
  checkPythonRuntime,
  checkPlaywrightBrowsers,
  installPlaywrightBrowsers,
  isPythonInstalled,
  getPythonInstallDir,
  getPythonPath
} from '../utils/python-runtime';

/**
 * Register all installation handlers
 */
export function registerInstallationHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // Environment check (simplified - Python is bundled)
  ipcMain.handle('env:check', async () => {
    try {
      // Check bundled Python runtime
      const pythonStatus = checkPythonRuntime();

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
      const mainWindow = getMainWindow();

      // Verify Python runtime is available
      const pythonStatus = checkPythonRuntime();
      if (!pythonStatus.available) {
        throw new Error(`Python runtime not available: ${pythonStatus.error}. Please run 'yarn python:build' first.`);
      }

      mainWindow?.webContents.send('env:progress', '✓ Python runtime verified\n');

      // Install Playwright browsers
      mainWindow?.webContents.send('env:progress', '\n🎭 Installing Playwright browsers...\n');

      const onProgress = (data: string) => mainWindow?.webContents.send('env:progress', data);
      const playwrightResult = await installPlaywrightBrowsers(onProgress);

      if (!playwrightResult.success) {
        throw new Error(`Failed to install Playwright: ${playwrightResult.error}`);
      }

      // Success!
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
      const mainWindow = getMainWindow();

      const onProgress = (data: string) => {
        mainWindow?.webContents.send('install:progress', data);
      };

      const result = await installPlaywrightBrowsers(onProgress);

      if (!result.success) {
        console.error('[Playwright] Installation failed:', result.error);
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

      const install = spawn('brew', ['install', '--cask', 'android-studio']);

      let output = '';
      install.stdout?.on('data', (data) => {
        output += data.toString();
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.stderr?.on('data', (data) => {
        output += data.toString();
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.on('close', (code) => {
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
    console.warn('[install:python] DEPRECATED: Use python:download instead');
    return {
      success: true,
      message: 'Use python:download handler instead.'
    };
  });

  // Check if Python is installed
  ipcMain.handle('python:checkInstalled', async () => {
    try {
      const installed = isPythonInstalled();
      const installPath = installed ? getPythonPath() : getPythonInstallDir();

      return {
        success: true,
        installed,
        path: installPath
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  // Get Python install directory
  ipcMain.handle('python:getInstallPath', async () => {
    try {
      return {
        success: true,
        path: getPythonInstallDir()
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  });

  // Download and install Python runtime - SIMPLIFIED: Just checks bundle status or throws error
  // Since we are now enforcing bundling, runtime download is not the primary path.
  // However, we keep a minimal implementation for dev fallback or manual setup if needed.
  ipcMain.handle('python:download', async () => {
    const mainWindow = getMainWindow();
    mainWindow?.webContents.send('python:progress', '⚠️  Python download is deprecated. Please use the bundled version.\n');
    
    // Re-run check
    if (isPythonInstalled()) {
       mainWindow?.webContents.send('python:progress', '✅ Bundled Python found.\n');
       return { success: true };
    }

    return { 
      success: false, 
      message: 'Bundled Python not found. Please rebuild the app with "yarn python:build" and "yarn package".' 
    };
  });
}
