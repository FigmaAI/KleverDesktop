/**
 * Installation IPC handlers
 * Handles installing required tools: Python packages, Playwright, Android Studio, Python
 */

import { IpcMain, BrowserWindow } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Register all installation handlers
 */
export function registerInstallationHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // Install Python packages
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
