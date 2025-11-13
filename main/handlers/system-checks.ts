/**
 * System checks IPC handlers
 * Handles checking for required tools: Python, packages, Ollama, ADB, Playwright, Homebrew
 */

import { IpcMain } from 'electron';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

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
      const requirementsPath = path.join(process.cwd(), 'appagent', 'requirements.txt');
      console.log('[Check Packages] Checking packages from:', requirementsPath);

      // Try to install with --dry-run to see if all packages can be installed
      exec(`python -m pip install --dry-run -r "${requirementsPath}"`, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          console.log('[Check Packages] Error:', stderr || error.message);
          resolve({ success: false, error: 'Some packages are missing or cannot be installed' });
          return;
        }

        // Check if it says "would install" (meaning packages are missing)
        if (stdout.includes('would install') || stderr.includes('would install')) {
          console.log('[Check Packages] Packages need to be installed');
          resolve({ success: false, error: 'Some packages are not installed' });
          return;
        }

        console.log('[Check Packages] All packages are satisfied');
        resolve({ success: true, output: stdout });
      });
    });
  });

  // Check Ollama
  ipcMain.handle('check:ollama', async () => {
    return new Promise((resolve) => {
      exec('curl -s http://localhost:11434/api/tags', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, running: false, error: 'Ollama not running' });
          return;
        }
        try {
          const data = JSON.parse(stdout);
          resolve({ success: true, running: true, models: data.models || [] });
        } catch {
          resolve({ success: false, running: false, error: 'Failed to parse Ollama response' });
        }
      });
    });
  });

  // Check ADB/Android SDK
  ipcMain.handle('check:androidStudio', async () => {
    return new Promise((resolve) => {
      console.log('[Android SDK Check] Starting check...');

      // Method 1: Check if adb command is available (most reliable)
      exec('adb --version', { timeout: 5000 }, (error, stdout, stderr) => {
        if (!error) {
          // adb is available in PATH
          const output = stdout || stderr;
          const versionMatch = output.match(/Android Debug Bridge version ([\d.]+)/);
          const version = versionMatch ? versionMatch[1] : 'unknown';
          console.log('[Android SDK Check] adb found via PATH:', version);
          resolve({ success: true, version: version, method: 'adb_command' });
          return;
        }

        console.log('[Android SDK Check] adb command not found in PATH');

        // Method 2: Check environment variables
        const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
        if (androidHome) {
          const adbPath = path.join(androidHome, 'platform-tools', 'adb');
          const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

          if (fs.existsSync(adbPathExe)) {
            console.log('[Android SDK Check] Found via ANDROID_HOME/ANDROID_SDK_ROOT:', androidHome);
            resolve({ success: true, version: 'installed', method: 'env_variable', path: androidHome });
            return;
          }
        }

        console.log('[Android SDK Check] Environment variables not set or invalid');

        // Method 3: Check common SDK locations
        const commonPaths = [
          path.join(process.env.HOME || '/root', 'Library', 'Android', 'sdk'), // macOS
          path.join(process.env.HOME || '/root', 'Android', 'Sdk'), // Linux
          '/Volumes/Backup/Android-SDK', // External volume (user's case)
          'C:\\Users\\' + (process.env.USERNAME || 'user') + '\\AppData\\Local\\Android\\Sdk', // Windows
        ];

        for (const sdkPath of commonPaths) {
          console.log('[Android SDK Check] Checking path:', sdkPath);
          const adbPath = path.join(sdkPath, 'platform-tools', 'adb');
          const adbPathExe = adbPath + (process.platform === 'win32' ? '.exe' : '');

          if (fs.existsSync(adbPathExe)) {
            console.log('[Android SDK Check] Found at:', sdkPath);
            resolve({ success: true, version: 'installed', method: 'common_path', path: sdkPath });
            return;
          }
        }

        // Method 4: Search in /Volumes for external drives (macOS)
        if (process.platform === 'darwin') {
          try {
            const volumes = fs.readdirSync('/Volumes');
            for (const volume of volumes) {
              const possiblePaths = [
                path.join('/Volumes', volume, 'Android-SDK'),
                path.join('/Volumes', volume, 'AndroidSDK'),
                path.join('/Volumes', volume, 'Android', 'Sdk'),
              ];

              for (const sdkPath of possiblePaths) {
                const adbPath = path.join(sdkPath, 'platform-tools', 'adb');
                if (fs.existsSync(adbPath)) {
                  console.log('[Android SDK Check] Found on external volume:', sdkPath);
                  resolve({ success: true, version: 'installed', method: 'external_volume', path: sdkPath });
                  return;
                }
              }
            }
          } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            console.log('[Android SDK Check] Could not search volumes:', message);
          }
        }

        console.log('[Android SDK Check] Result: NOT FOUND');
        resolve({
          success: false,
          error: 'Android SDK not found. Please install Android Studio or set ANDROID_HOME environment variable.',
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

      exec('brew --version', { timeout: 5000 }, (error, stdout) => {
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
}
