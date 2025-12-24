/**
 * System checks IPC handlers
 * Handles checking for required tools: Python, packages, Ollama, ADB, Playwright, Homebrew
 */

import { IpcMain } from 'electron';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getCorePath } from '../utils/python-runtime';

/**
 * Register all system check handlers
 */
export function registerSystemCheckHandlers(ipcMain: IpcMain): void {
  // Check Python version
  ipcMain.handle('check:python', async () => {
    return new Promise((resolve) => {
      exec('python --version', { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message });
          return;
        }
        const output = stdout || stderr;
        const match = output.match(/Python (\d+)\.(\d+)\.(\d+)/);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);
          resolve({
            success: true,
            version: `${major}.${minor}.${match[3]}`,
            isValid: major === 3 && minor >= 11,
          });
        } else {
          resolve({ success: false, error: 'Failed to parse Python version' });
        }
      });
    });
  });

  // Check Python packages
  ipcMain.handle('check:packages', async () => {
    return new Promise((resolve) => {
      // Phase C Migration: Use core/requirements.txt
      const corePath = getCorePath();
      const requirementsPath = path.join(corePath, 'requirements.txt');

      // Try to install with --dry-run to see if all packages can be installed
      exec(`python -m pip install --dry-run -r "${requirementsPath}"`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: 'Some packages are missing or cannot be installed' });
          return;
        }

        // Check if it says "would install" (meaning packages are missing)
        if (stdout.includes('would install') || stderr.includes('would install')) {
          resolve({ success: false, error: 'Some packages are not installed' });
          return;
        }

        resolve({ success: true, output: stdout });
      });
    });
  });

  // Check Ollama (CLI installation + server running status)
  ipcMain.handle('check:ollama', async () => {
    return new Promise((resolve) => {
      // Fix PATH for macOS to include Homebrew locations
      const env = { ...process.env };
      if (process.platform === 'darwin') {
        env.PATH = `${env.PATH}:/usr/local/bin:/opt/homebrew/bin`;
      }

      // First check if Ollama CLI is installed
      exec('ollama --version', { timeout: 5000, env }, (versionError, versionStdout) => {
        if (versionError) {
          // Ollama CLI not installed
          resolve({ success: false, installed: false, running: false, error: 'Ollama not installed' });
          return;
        }

        // Parse version from output (e.g., "ollama version is 0.1.32")
        const versionMatch = versionStdout.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';

        // CLI is installed, now check if server is running
        exec('curl -s http://localhost:11434/api/tags', { timeout: 5000 }, (serverError, serverStdout) => {
          if (serverError) {
            // Installed but server not running
            resolve({ success: true, installed: true, running: false, version, error: 'Ollama server not running' });
            return;
          }
          try {
            const data = JSON.parse(serverStdout);
            resolve({ success: true, installed: true, running: true, version, models: data.models || [] });
          } catch {
            resolve({ success: true, installed: true, running: false, version, error: 'Failed to parse Ollama response' });
          }
        });
      });
    });
  });

  // Check ADB (Android Debug Bridge)
  ipcMain.handle('check:androidStudio', async () => {
    return new Promise((resolve) => {
      // Fix PATH for macOS to include Homebrew locations
      const env = { ...process.env };
      if (process.platform === 'darwin') {
        env.PATH = `${env.PATH}:/usr/local/bin:/opt/homebrew/bin`;
      }

      // Method 1: Check if adb command is available in PATH
      exec('adb --version', { timeout: 5000, env }, (error, stdout, stderr) => {
        if (!error) {
          // adb is available
          const output = stdout || stderr;
          const versionMatch = output.match(/Android Debug Bridge version ([\d.]+)/);
          const version = versionMatch ? versionMatch[1] : 'unknown';

          // Try to find SDK path from adb location
          exec('which adb', { timeout: 2000, env }, (whichError, whichStdout) => {
            let sdkPath = '';
            if (!whichError && whichStdout) {
              const adbFullPath = whichStdout.trim();
              const platformToolsIndex = adbFullPath.indexOf('/platform-tools/');
              if (platformToolsIndex !== -1) {
                sdkPath = adbFullPath.substring(0, platformToolsIndex);
              }
            }

            resolve({
              success: true,
              version: version,
              method: 'adb_command',
              path: sdkPath
            });
          });
          return;
        }

        // Method 2: Check environment variables
        const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
        if (androidHome) {
          const adbPath = path.join(androidHome, 'platform-tools', 'adb');
          const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

          if (fs.existsSync(adbPathExe)) {
            resolve({
              success: true,
              version: 'installed',
              method: 'env_variable',
              path: androidHome
            });
            return;
          }
        }

        // Method 3: Check common SDK locations
        const commonPaths = [
          path.join(process.env.HOME || '/root', 'Library', 'Android', 'sdk'), // macOS
          path.join(process.env.HOME || '/root', 'Android', 'Sdk'), // Linux
          'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Android\\Sdk', // Windows
        ];

        for (const checkSdkPath of commonPaths) {
          const adbPath = path.join(checkSdkPath, 'platform-tools', 'adb');
          const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

          if (fs.existsSync(adbPathExe)) {
            resolve({
              success: true,
              version: 'installed',
              method: 'common_path',
              path: checkSdkPath
            });
            return;
          }
        }

        resolve({
          success: false,
          error: 'Android Debug Bridge is not found.',
        });
      });
    });
  });

  // Check Playwright
  ipcMain.handle('check:playwright', async () => {
    return new Promise((resolve) => {
      exec('python -m playwright install --dry-run chromium', { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
          return;
        }
        resolve({ success: true, output: stdout });
      });
    });
  });

  // Check Homebrew (macOS only)
  ipcMain.handle('check:homebrew', async () => {
    return new Promise((resolve) => {
      if (process.platform !== 'darwin') {
        resolve({ success: false, error: 'Homebrew is only available on macOS' });
        return;
      }

      // Fix PATH for macOS to include Homebrew locations
      const env = { ...process.env };
      env.PATH = `${env.PATH}:/usr/local/bin:/opt/homebrew/bin`;

      exec('brew --version', { timeout: 5000, env }, (error, stdout) => {
        if (error) {
          resolve({ success: false, error: 'Homebrew not installed' });
          return;
        }

        const versionMatch = stdout.match(/Homebrew ([\d.]+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        resolve({ success: true, version });
      });
    });
  });

  // Check Chocolatey (Windows only)
  ipcMain.handle('check:chocolatey', async () => {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        resolve({ success: false, error: 'Chocolatey is only available on Windows' });
        return;
      }

      exec('choco --version', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, error: 'Chocolatey not installed' });
          return;
        }

        // choco --version outputs just the version number (e.g. "2.3.0")
        const versionMatch = stdout.match(/(\d+\.\d+\.\d+)/);
        const version = versionMatch ? versionMatch[1] : (stdout.trim() || 'unknown');
        resolve({ success: true, version });
      });
    });
  });
}
