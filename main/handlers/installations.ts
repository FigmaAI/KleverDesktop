/**
 * Installation IPC handlers
 * Handles installing required tools: Python packages, Playwright, Android Studio, Python
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn, exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  getBundledPythonPath,
  checkVenvStatus,
  createVirtualEnvironment,
  installRequirements,
  installPlaywrightBrowsers
} from '../utils/python-manager';

/**
 * Register all installation handlers
 */
export function registerInstallationHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // NEW: Unified environment check
  ipcMain.handle('env:check', async () => {
    try {
      console.log('[env:check] ========== Starting environment check ==========');
      const pythonPath = getBundledPythonPath();
      console.log('[env:check] Python path:', pythonPath);

      // Check if it's a bundled Python (absolute path) or system Python (command name)
      const isBundled = path.isAbsolute(pythonPath);
      console.log('[env:check] Is bundled:', isBundled);

      const pythonExists = isBundled ? fs.existsSync(pythonPath) : true; // Assume system Python exists
      console.log('[env:check] Python exists (initial check):', pythonExists);

      // Verify Python version and existence by running it
      let pythonVersion: string | null = null;
      let pythonValid = false;

      try {
        console.log('[env:check] Running:', `${pythonPath} --version`);
        const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
          exec(`${pythonPath} --version`, { timeout: 5000 }, (error, stdout, stderr) => {
            if (error) {
              console.error('[env:check] Python execution error:', error.message);
              reject(error);
            } else {
              console.log('[env:check] Python version output:', stdout || stderr);
              resolve({ stdout: stdout || stderr });
            }
          });
        });

        const match = stdout.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          pythonVersion = `${major}.${minor}.${match[3]}`;
          pythonValid = major === 3 && minor >= 11;
          console.log('[env:check] Parsed version:', pythonVersion);
          console.log('[env:check] Is valid (3.11+):', pythonValid);
        } else {
          console.warn('[env:check] Could not parse Python version from output');
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.warn('[env:check] Failed to verify Python:', message);
      }

      const venvStatus = checkVenvStatus();
      console.log('[env:check] Venv status:', venvStatus);

      const result = {
        success: true,
        bundledPython: {
          path: pythonPath,
          exists: pythonExists && pythonValid,
          version: pythonVersion,
          isBundled: isBundled,
        },
        venv: venvStatus,
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

  // NEW: Unified environment setup
  ipcMain.handle('env:setup', async () => {
    try {
      console.log('[Environment Setup] Starting unified setup...');
      const mainWindow = getMainWindow();

      // Step 1: Create virtual environment
      console.log('[Environment Setup] Step 1: Creating virtual environment...');
      mainWindow?.webContents.send('env:progress', '📦 Creating virtual environment...\n');

      const onOutput = (data: string) => mainWindow?.webContents.send('env:progress', data);
      const onError = (data: string) => mainWindow?.webContents.send('env:progress', data);

      const venvResult = await createVirtualEnvironment(onOutput, onError);

      if (!venvResult.success) {
        throw new Error(`Failed to create venv: ${venvResult.error}`);
      }

      // Step 2: Install packages from requirements.txt
      console.log('[Environment Setup] Step 2: Installing Python packages...');
      mainWindow?.webContents.send('env:progress', '\n📚 Installing Python packages...\n');

      const requirementsPath = path.join(process.cwd(), 'appagent', 'requirements.txt');
      const packagesResult = await installRequirements(requirementsPath, onOutput, onError);

      if (!packagesResult.success) {
        throw new Error(`Failed to install packages: ${packagesResult.error}`);
      }

      // Step 3: Install Playwright browsers
      console.log('[Environment Setup] Step 3: Installing Playwright browsers...');
      mainWindow?.webContents.send('env:progress', '\n🎭 Installing Playwright browsers...\n');

      const playwrightResult = await installPlaywrightBrowsers(onOutput, onError);

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

  // LEGACY: Install Python packages
  ipcMain.handle('install:packages', async () => {
    return new Promise((resolve) => {
      const requirementsPath = path.join(process.cwd(), 'appagent', 'requirements.txt');
      console.log('[Install Packages] Starting installation from:', requirementsPath);

      // Check if requirements.txt exists
      if (!fs.existsSync(requirementsPath)) {
        console.error('[Install Packages] requirements.txt not found at:', requirementsPath);
        resolve({ success: false, error: 'requirements.txt not found' });
        return;
      }

      const pip = spawn('python', ['-m', 'pip', 'install', '-r', requirementsPath]);

      let output = '';
      let errorOutput = '';

      pip.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log('[Install Packages] stdout:', text);
        getMainWindow()?.webContents.send('install:progress', text);
      });

      pip.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[Install Packages] stderr:', text);
        getMainWindow()?.webContents.send('install:progress', text);
      });

      pip.on('close', (code) => {
        console.log('[Install Packages] Process closed with code:', code);
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          resolve({ success: false, output: output || errorOutput, error: `pip install failed with code ${code}` });
        }
      });

      pip.on('error', (error) => {
        console.error('[Install Packages] Process error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  });

  // Install Playwright
  ipcMain.handle('install:playwright', async () => {
    return new Promise((resolve) => {
      console.log('[Playwright] Starting installation via pip...');
      // First install playwright package via pip
      const playwright = spawn('python', ['-m', 'pip', 'install', 'playwright']);

      let output = '';
      playwright.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[Playwright] stdout:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      playwright.stderr.on('data', (data) => {
        output += data.toString();
        console.log('[Playwright] stderr:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      playwright.on('close', (code) => {
        console.log('[Playwright] pip install finished with code:', code);
        if (code === 0) {
          // Then install browsers
          console.log('[Playwright] Installing browsers...');
          getMainWindow()?.webContents.send('install:progress', 'Installing Playwright browsers...\n');
          const browserInstall = spawn('python', ['-m', 'playwright', 'install', 'chromium']);

          let browserOutput = '';
          browserInstall.stdout.on('data', (data) => {
            browserOutput += data.toString();
            console.log('[Playwright] browser install stdout:', data.toString());
            getMainWindow()?.webContents.send('install:progress', data.toString());
          });

          browserInstall.stderr.on('data', (data) => {
            browserOutput += data.toString();
            console.log('[Playwright] browser install stderr:', data.toString());
            getMainWindow()?.webContents.send('install:progress', data.toString());
          });

          browserInstall.on('close', (browserCode) => {
            console.log('[Playwright] Browser installation finished with code:', browserCode);
            resolve({ success: browserCode === 0, output: output + '\n' + browserOutput });
          });

          browserInstall.on('error', (error) => {
            console.error('[Playwright] Browser install error:', error.message);
            resolve({ success: false, error: error.message });
          });
        } else {
          resolve({ success: false, error: 'Failed to install playwright package' });
        }
      });

      playwright.on('error', (error) => {
        console.error('[Playwright] Error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  });

  // Install Android Studio (via Homebrew cask)
  ipcMain.handle('install:androidStudio', async () => {
    return new Promise((resolve) => {
      console.log('[Android Studio] Starting installation via Homebrew...');
      const install = spawn('brew', ['install', '--cask', 'android-studio']);

      let output = '';
      install.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[Android Studio] stdout:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.stderr.on('data', (data) => {
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

  // Install Python (via Homebrew)
  ipcMain.handle('install:python', async () => {
    return new Promise((resolve) => {
      if (process.platform !== 'darwin') {
        resolve({ success: false, error: 'Python installation via Homebrew is only supported on macOS' });
        return;
      }

      console.log('[Python] Starting installation via Homebrew...');
      const install = spawn('brew', ['install', 'python@3.11']);

      let output = '';
      install.stdout.on('data', (data) => {
        output += data.toString();
        console.log('[Python] stdout:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.stderr.on('data', (data) => {
        output += data.toString();
        console.log('[Python] stderr:', data.toString());
        getMainWindow()?.webContents.send('install:progress', data.toString());
      });

      install.on('close', (code) => {
        console.log('[Python] Installation finished with code:', code);
        resolve({ success: code === 0, output });
      });

      install.on('error', (error) => {
        console.error('[Python] Error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  });
}
