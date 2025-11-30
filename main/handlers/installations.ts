/**
 * Installation IPC handlers (Runtime Download)
 * Handles Python and Playwright installation during setup wizard
 * Python is downloaded post-install to reduce app bundle size
 */

import { IpcMain, BrowserWindow, dialog } from 'electron';
import { spawn, exec, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ApkSource } from '../types/project';
import {
  checkPythonRuntime,
  checkPlaywrightBrowsers,
  installPlaywrightBrowsers,
  isPythonInstalled,
  getPythonInstallDir,
  getPythonPath,
  checkVenvStatus,
  createVirtualEnvironment,
  installRequirements,
  getAppagentPath,
  spawnBundledPython,
  getPythonEnv
} from '../utils/python-runtime';
import { downloadPython } from '../utils/python-download';

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
        // Normal state for initial setup, use log instead of error
        console.log('[env:check] Python runtime not found (needs installation)');
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

      // Check venv status
      const venvStatus = checkVenvStatus();

      const result = {
        success: true,
        bundledPython: {
          exists: true,
          path: pythonStatus.pythonPath,
          version: '3.11.9', // Bundled version
          isBundled: true,
        },
        venv: venvStatus,
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

  // Environment setup (venv + requirements + Playwright)
  ipcMain.handle('env:setup', async () => {
    try {
      const mainWindow = getMainWindow();

      // 1. Check if Python is downloaded
      // 1. Check if Python is downloaded
      if (!isPythonInstalled()) {
        mainWindow?.webContents.send('env:progress', '📦 Python runtime not found. Downloading...\n');
        
        const onProgress = (message: string) => {
          mainWindow?.webContents.send('env:progress', message);
        };

        const downloadResult = await downloadPython(onProgress);
        
        if (!downloadResult.success) {
          const errorMsg = `Failed to download Python: ${downloadResult.error}`;
          mainWindow?.webContents.send('env:progress', `❌ ${errorMsg}\n`);
          return { success: false, error: errorMsg };
        }
        
        mainWindow?.webContents.send('env:progress', '✓ Python runtime downloaded\n');
      }

      mainWindow?.webContents.send('env:progress', '✓ Python runtime found\n');

      // 2. Check virtual environment status
      const venvStatus = checkVenvStatus();
      
      if (!venvStatus.valid) {
        mainWindow?.webContents.send('env:progress', '\n📦 Creating virtual environment...\n');
        
        const venvResult = await createVirtualEnvironment(
          (data: string) => mainWindow?.webContents.send('env:progress', data),
          (data: string) => mainWindow?.webContents.send('env:progress', data)
        );

        if (!venvResult.success) {
          throw new Error(`Failed to create virtual environment: ${venvResult.error}`);
        }

        mainWindow?.webContents.send('env:progress', '✓ Virtual environment created\n');
      } else {
        mainWindow?.webContents.send('env:progress', '✓ Virtual environment already exists\n');
      }

      // 3. Install requirements.txt packages
      mainWindow?.webContents.send('env:progress', '\n📦 Installing Python packages from requirements.txt...\n');
      
      const appagentPath = getAppagentPath();
      const requirementsPath = path.join(appagentPath, 'requirements.txt');

      const requirementsResult = await installRequirements(
        requirementsPath,
        (data: string) => mainWindow?.webContents.send('env:progress', data),
        (data: string) => mainWindow?.webContents.send('env:progress', data)
      );

      if (!requirementsResult.success) {
        throw new Error(`Failed to install requirements: ${requirementsResult.error}`);
      }

      mainWindow?.webContents.send('env:progress', '✓ Python packages installed\n');

      // 4. Install Playwright browsers
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

  // Reset environment (delete .klever-desktop)
  ipcMain.handle('env:reset', async () => {
    try {
      const kleverDir = path.join(os.homedir(), '.klever-desktop');
      
      if (fs.existsSync(kleverDir)) {
        fs.rmSync(kleverDir, { recursive: true, force: true });
      }
      
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[env:reset] Error:', message);
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

  // Install Android SDK (ADB + Command Line Tools)
  ipcMain.handle('install:androidStudio', async () => {
    return new Promise((resolve) => {
      const platform = process.platform;

      // macOS: Use Homebrew to install android-platform-tools (ADB) and android-commandlinetools (SDK)
      if (platform === 'darwin') {
        // Check if Homebrew is available
        exec('brew --version', { timeout: 3000 }, (brewError) => {
          if (!brewError) {
            // Homebrew is available, use it
            console.log('[Android SDK Install] Installing android-platform-tools and android-commandlinetools via Homebrew...');

            const install = spawn('brew', ['install', '--cask', 'android-commandlinetools', 'android-platform-tools']);

            let output = '';
            install.stdout?.on('data', (data) => {
              output += data.toString();
              console.log('[Android SDK Install] stdout:', data.toString());
              getMainWindow()?.webContents.send('install:progress', data.toString());
            });

            install.stderr?.on('data', (data) => {
              output += data.toString();
              console.log('[Android SDK Install] stderr:', data.toString());
              getMainWindow()?.webContents.send('install:progress', data.toString());
            });

            install.on('close', (code) => {
              console.log('[Android SDK Install] Installation finished with code:', code);

              if (code === 0) {
                getMainWindow()?.webContents.send('install:progress', '\n✅ Android SDK Tools installed successfully!\n');
                resolve({ success: true, output });
              } else {
                resolve({ success: false, error: `Installation failed with code ${code}`, output });
              }
            });

            install.on('error', (error) => {
              console.error('[Android SDK Install] Error:', error.message);
              resolve({ success: false, error: error.message });
            });
          } else {
            // Homebrew not available
            console.log('[Android SDK Install] Homebrew is not installed');
            resolve({
              success: false,
              error: 'Homebrew is not installed. Please install Homebrew first (https://brew.sh) or download Android SDK manually from https://developer.android.com/studio',
              needsManualInstall: true
            });
          }
        });

      // Windows: Try Chocolatey
      } else if (platform === 'win32') {
        // Check if Chocolatey is available
        exec('choco --version', { timeout: 3000 }, (chocoError) => {
          if (!chocoError) {
            // Chocolatey is available, use it
            console.log('[Android SDK Install] Installing adb via Chocolatey...');
            const install = spawn('choco', ['install', 'adb', '-y']);

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
              if (code === 0) {
                getMainWindow()?.webContents.send('install:progress', '\n✅ ADB installed successfully!\n');
                resolve({ success: true, output });
              } else {
                resolve({ success: false, error: `Installation failed with code ${code}`, output });
              }
            });
          } else {
            // Chocolatey not available
            resolve({ 
              success: false, 
              error: 'Please install Chocolatey first or download Android SDK manually.',
              needsManualInstall: true
            });
          }
        });

      // Linux
      } else {
        resolve({ 
          success: false, 
          error: 'Please install Android SDK manually.',
          needsManualInstall: true
        });
      }
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
  // Download and install Python runtime
  ipcMain.handle('python:download', async () => {
    const mainWindow = getMainWindow();
    
    // Re-run check first
    if (isPythonInstalled()) {
       mainWindow?.webContents.send('python:progress', '✅ Python is already installed.\n');
       return { success: true };
    }

    mainWindow?.webContents.send('python:progress', '🚀 Starting Python download...\n');
    
    const onProgress = (message: string) => {
      mainWindow?.webContents.send('python:progress', message);
    };

    // Import dynamically to avoid circular dependencies if any, or just use the imported one
    // We need to import downloadPython at the top of the file first.
    // Assuming it's imported as `import { downloadPython } from '../utils/python-download';`
    
    const result = await downloadPython(onProgress);
    
    if (result.success) {
      mainWindow?.webContents.send('python:progress', '\n✅ Python installed successfully!\n');
    } else {
      mainWindow?.webContents.send('python:progress', `\n❌ Download failed: ${result.error}\n`);
    }

    return result;
  });

  // ============================================
  // APK Installation Handlers
  // ============================================

  // Select APK file via dialog
  ipcMain.handle('apk:selectFile', async () => {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return { success: false, error: 'No main window available' };
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Select APK File',
        filters: [
          { name: 'Android Package', extensions: ['apk'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const apkPath = result.filePaths[0];
      
      // Verify the file exists and has .apk extension
      if (!fs.existsSync(apkPath)) {
        return { success: false, error: 'Selected file does not exist' };
      }

      if (!apkPath.toLowerCase().endsWith('.apk')) {
        return { success: false, error: 'Selected file is not an APK file' };
      }

      return { success: true, path: apkPath };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[apk:selectFile] Error:', message);
      return { success: false, error: message };
    }
  });

  // Parse Play Store URL to extract package name
  ipcMain.handle('playstore:parseUrl', async (_event, url: string) => {
    try {
      if (!url) {
        return { success: false, error: 'No URL provided' };
      }

      // Check if it's a Play Store URL
      if (!url.includes('play.google.com')) {
        return { success: false, error: 'Not a valid Google Play Store URL' };
      }

      // Extract package name from URL
      // Format: https://play.google.com/store/apps/details?id=com.example.app
      const urlObj = new URL(url);
      const packageName = urlObj.searchParams.get('id');

      if (!packageName) {
        // Try alternative format: /store/apps/details/com.example.app
        const pathMatch = url.match(/\/details\/([a-zA-Z0-9._]+)/);
        if (pathMatch) {
          return { success: true, packageName: pathMatch[1] };
        }
        return { success: false, error: 'Could not extract package name from URL' };
      }

      return { success: true, packageName };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[playstore:parseUrl] Error:', message);
      return { success: false, error: message };
    }
  });

  // Pre-launch: Prepare device, install APK, and launch app
  ipcMain.handle('android:prelaunch', async (_event, apkSource: ApkSource, projectName?: string) => {
    try {
      const mainWindow = getMainWindow();
      
      // Check if Python environment is ready
      const venvStatus = checkVenvStatus();
      if (!venvStatus.valid) {
        return { success: false, error: 'Python environment not ready. Please run Setup Wizard.' };
      }

      const appagentDir = getAppagentPath();
      const pythonEnv = getPythonEnv();
      const scriptsDir = path.join(appagentDir, 'scripts');

      // Build Python code to run prelaunch_app function
      const apkSourceJson = JSON.stringify(apkSource);
      const prelaunchCode = `
import sys
import json
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from and_controller import prelaunch_app

apk_source = json.loads('${apkSourceJson.replace(/'/g, "\\'")}')
result = prelaunch_app(apk_source)
print('PRELAUNCH_RESULT:' + json.dumps(result))
`;

      return new Promise((resolve) => {
        const process = spawnBundledPython(['-u', '-c', prelaunchCode], {
          cwd: appagentDir,
          env: {
            ...pythonEnv,
            PYTHONPATH: scriptsDir,
            PYTHONUNBUFFERED: '1'
          }
        });

        let stdout = '';
        let stderr = '';

        process.stdout?.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          mainWindow?.webContents.send('android:prelaunch:progress', output);
        });

        process.stderr?.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          mainWindow?.webContents.send('android:prelaunch:progress', output);
        });

        process.on('close', (code) => {
          // Parse result from stdout
          const resultMatch = stdout.match(/PRELAUNCH_RESULT:(.+)/);
          if (resultMatch) {
            try {
              const result = JSON.parse(resultMatch[1]);
              resolve(result);
            } catch {
              resolve({ success: code === 0, error: stderr || 'Failed to parse result' });
            }
          } else {
            resolve({ success: code === 0, error: stderr || 'No result returned' });
          }
        });

        process.on('error', (error) => {
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[android:prelaunch] Error:', message);
      return { success: false, error: message };
    }
  });

  // Get Android device/emulator status
  ipcMain.handle('android:getStatus', async () => {
    try {
      const venvStatus = checkVenvStatus();
      if (!venvStatus.valid) {
        return { 
          success: false, 
          error: 'Python environment not ready',
          devices: [],
          emulators: []
        };
      }

      const appagentDir = getAppagentPath();
      const pythonEnv = getPythonEnv();
      const scriptsDir = path.join(appagentDir, 'scripts');

      const statusCode = `
import sys
import json
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from and_controller import list_all_devices, list_available_emulators

devices = list_all_devices()
emulators = list_available_emulators()
print('STATUS_RESULT:' + json.dumps({'devices': devices, 'emulators': emulators}))
`;

      return new Promise((resolve) => {
        const process = spawnBundledPython(['-u', '-c', statusCode], {
          cwd: appagentDir,
          env: {
            ...pythonEnv,
            PYTHONPATH: scriptsDir,
            PYTHONUNBUFFERED: '1'
          }
        });

        let stdout = '';

        process.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        process.on('close', (code) => {
          const resultMatch = stdout.match(/STATUS_RESULT:(.+)/);
          if (resultMatch) {
            try {
              const result = JSON.parse(resultMatch[1]);
              resolve({ success: true, ...result });
            } catch {
              resolve({ success: false, devices: [], emulators: [], error: 'Failed to parse result' });
            }
          } else {
            resolve({ success: false, devices: [], emulators: [], error: 'No result returned' });
          }
        });

        process.on('error', (error) => {
          resolve({ success: false, devices: [], emulators: [], error: error.message });
        });
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[android:getStatus] Error:', message);
      return { success: false, devices: [], emulators: [], error: message };
    }
  });
}
