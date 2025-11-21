/**
 * Installation IPC handlers (Runtime Download)
 * Handles Python and Playwright installation during setup wizard
 * Python is downloaded post-install to reduce app bundle size
 */

import { IpcMain, BrowserWindow, app } from 'electron';
import { spawn, exec } from 'child_process';
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

  // Download and install Python runtime
  ipcMain.handle('python:download', async () => {
    try {
      const mainWindow = getMainWindow();

      // Check if already installed
      if (isPythonInstalled()) {
        mainWindow?.webContents.send('python:progress', '✓ Python is already installed\n');
        return { success: true, message: 'Python is already installed' };
      }

      const platform = os.platform();
      const arch = os.arch();
      const platformKey = `${platform}-${arch}`;

      mainWindow?.webContents.send('python:progress', `📦 Downloading Python 3.11.9 for ${platformKey}...\n`);

      // Python download URLs
      const PYTHON_VERSION = '3.11.9';
      const RELEASE_DATE = '20240814'; // Fallback release date

      let downloadUrl: string;

      if (platform === 'darwin') {
        // Use standalone Python build for macOS
        const archStr = arch === 'arm64' ? 'aarch64' : 'x86_64';
        downloadUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_DATE}/cpython-${PYTHON_VERSION}+${RELEASE_DATE}-${archStr}-apple-darwin-install_only.tar.gz`;
      } else if (platform === 'win32') {
        downloadUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
      } else if (platform === 'linux') {
        downloadUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz`;
      } else {
        throw new Error(`Unsupported platform: ${platformKey}`);
      }

      const userDataPath = app.getPath('userData');
      const tempDir = path.join(userDataPath, '.temp-python-download');
      const targetDir = getPythonInstallDir();

      // Create directories
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempDir, { recursive: true });
      fs.mkdirSync(path.dirname(targetDir), { recursive: true });

      const filename = path.basename(downloadUrl);
      const downloadPath = path.join(tempDir, filename);

      // Download using curl
      mainWindow?.webContents.send('python:progress', '⬇️  Downloading...\n');

      await new Promise<void>((resolve, reject) => {
        exec(`curl -L -o "${downloadPath}" "${downloadUrl}"`, (error, _stdout, _stderr) => {
          if (error) {
            reject(new Error(`Download failed: ${error.message}`));
            return;
          }

          // Verify file exists and has size
          const stats = fs.statSync(downloadPath);
          if (stats.size < 1000000) { // Less than 1MB means error
            reject(new Error('Downloaded file is too small, may be corrupted'));
            return;
          }

          resolve();
        });
      });

      mainWindow?.webContents.send('python:progress', '✓ Download complete\n');
      mainWindow?.webContents.send('python:progress', '📦 Extracting Python...\n');

      // Extract based on platform
      await new Promise<void>((resolve, reject) => {
        let extractCmd: string;

        if (platform === 'darwin') {
          // macOS: Extract standalone Python build (tar.gz)
          extractCmd = `mkdir -p "${targetDir}" && tar -xzf "${downloadPath}" -C "${targetDir}" --strip-components=1`;
        } else if (platform === 'win32') {
          // Windows: Use PowerShell to expand zip archive
          const targetDirWin = targetDir.replace(/\//g, '\\');
          const downloadPathWin = downloadPath.replace(/\//g, '\\');
          extractCmd = `powershell -Command "Expand-Archive -Path '${downloadPathWin}' -DestinationPath '${targetDirWin}' -Force"`;
        } else {
          // Linux: Extract source and build
          extractCmd = `tar -xzf "${downloadPath}" -C "${tempDir}" && cd "${tempDir}/Python-${PYTHON_VERSION}" && ./configure --prefix="${targetDir}" && make && make install`;
        }

        exec(extractCmd, { maxBuffer: 10 * 1024 * 1024, shell: platform === 'win32' ? 'powershell.exe' : undefined }, (error, stdout, stderr) => {
          if (error) {
            mainWindow?.webContents.send('python:progress', `stderr: ${stderr}\n`);
            reject(new Error(`Extraction failed: ${error.message}`));
            return;
          }
          resolve();
        });
      });

      mainWindow?.webContents.send('python:progress', '✓ Extraction complete\n');

      // Get Python executable path and appagent directory
      const pythonExe = getPythonPath();
      const { getAppagentPath } = await import('../utils/python-runtime');
      const appagentPath = getAppagentPath();
      const requirementsPath = path.join(appagentPath, 'requirements.txt');

      // Windows embeddable Python: Enable pip and site-packages
      if (platform === 'win32') {
        mainWindow?.webContents.send('python:progress', '🔧 Configuring Windows embeddable Python...\n');

        // 1. Modify python311._pth to enable site-packages
        const pthFile = path.join(targetDir, 'python311._pth');
        if (fs.existsSync(pthFile)) {
          mainWindow?.webContents.send('python:progress', '📝 Modifying python311._pth...\n');

          // Build new .pth content with required paths
          const newContent = [
            'python311.zip',
            '.',
            'Lib',
            'Lib/site-packages',
            'import site'
          ].join('\n') + '\n';

          fs.writeFileSync(pthFile, newContent);
          mainWindow?.webContents.send('python:progress', '✓ python311._pth updated:\n');
          mainWindow?.webContents.send('python:progress', newContent);
        }

        // 2. Download and install get-pip.py
        mainWindow?.webContents.send('python:progress', '📦 Installing pip...\n');
        const getPipPath = path.join(tempDir, 'get-pip.py');
        const getPipPathWin = getPipPath.replace(/\//g, '\\');

        await new Promise<void>((resolve, reject) => {
          const downloadCmd = `powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile '${getPipPathWin}'"`;
          exec(downloadCmd, { shell: 'powershell.exe' }, (error) => {
            if (error) {
              reject(new Error(`Failed to download get-pip.py: ${error.message}`));
              return;
            }
            resolve();
          });
        });

        // Install pip
        await new Promise<void>((resolve, reject) => {
          exec(`"${pythonExe}" "${getPipPath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              mainWindow?.webContents.send('python:progress', `❌ pip installation failed\n`);
              mainWindow?.webContents.send('python:progress', `Error: ${error.message}\n`);
              mainWindow?.webContents.send('python:progress', `stderr: ${stderr}\n`);
              reject(new Error(`Failed to install pip: ${error.message}`));
              return;
            }
            if (stdout) mainWindow?.webContents.send('python:progress', stdout);
            if (stderr) mainWindow?.webContents.send('python:progress', stderr);
            mainWindow?.webContents.send('python:progress', '✓ pip installed\n');
            resolve();
          });
        });

        // Verify pip installation
        mainWindow?.webContents.send('python:progress', '🔍 Verifying pip installation...\n');
        await new Promise<void>((resolve, reject) => {
          exec(`"${pythonExe}" -m pip --version`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              mainWindow?.webContents.send('python:progress', `❌ pip verification failed\n`);
              mainWindow?.webContents.send('python:progress', `Error: ${error.message}\n`);
              mainWindow?.webContents.send('python:progress', `stdout: ${stdout}\n`);
              mainWindow?.webContents.send('python:progress', `stderr: ${stderr}\n`);
              reject(new Error(`pip verification failed: ${error.message}. Please try running 'python -m ensurepip' manually.`));
              return;
            }
            mainWindow?.webContents.send('python:progress', `✓ ${stdout.trim()}\n`);
            resolve();
          });
        });
      }

      mainWindow?.webContents.send('python:progress', '📦 Installing dependencies...\n');

      // 1. Upgrade pip (skip on Windows - already latest from get-pip.py)
      if (platform !== 'win32') {
        mainWindow?.webContents.send('python:progress', 'Upgrading pip...\n');
        await new Promise<void>((resolve) => {
          exec(`"${pythonExe}" -m pip install --no-warn-script-location --upgrade pip`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, _stderr) => {
            if (error) {
              mainWindow?.webContents.send('python:progress', `⚠️  Warning: ${error.message}\n`);
            }
            if (stdout) mainWindow?.webContents.send('python:progress', stdout);
            resolve();
          });
        });
      }

      // 2. Install requirements
      if (fs.existsSync(requirementsPath)) {
        mainWindow?.webContents.send('python:progress', 'Installing packages from requirements.txt...\n');
        await new Promise<void>((resolve, reject) => {
          exec(`"${pythonExe}" -m pip install --no-warn-script-location -r "${requirementsPath}"`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
              mainWindow?.webContents.send('python:progress', `❌ Package installation failed\n`);
              mainWindow?.webContents.send('python:progress', `Error: ${error.message}\n`);
              if (stdout) mainWindow?.webContents.send('python:progress', `stdout: ${stdout}\n`);
              if (stderr) mainWindow?.webContents.send('python:progress', `stderr: ${stderr}\n`);
              reject(new Error(`Failed to install packages: ${error.message}`));
              return;
            }
            if (stdout) mainWindow?.webContents.send('python:progress', stdout);
            if (stderr) mainWindow?.webContents.send('python:progress', stderr);
            mainWindow?.webContents.send('python:progress', '✓ Packages installed\n');
            resolve();
          });
        });
      }

      // 3. Install Playwright browsers
      mainWindow?.webContents.send('python:progress', 'Installing Playwright browsers...\n');
      await new Promise<void>((resolve) => {
        exec(`"${pythonExe}" -m playwright install chromium`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, _stderr) => {
          if (error) {
            mainWindow?.webContents.send('python:progress', `⚠️  Warning: ${error.message}\n`);
          }
          if (stdout) mainWindow?.webContents.send('python:progress', stdout);
          resolve();
        });
      });

      mainWindow?.webContents.send('python:progress', '✓ Dependencies installed\n');

      // Clean up temp directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      mainWindow?.webContents.send('python:progress', '✅ Python installation complete!\n');

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Python Download] ✗ Error:', message);
      getMainWindow()?.webContents.send('python:progress', `\n❌ Error: ${message}\n`);
      return { success: false, error: message };
    }
  });
}
