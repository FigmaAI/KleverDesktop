/**
 * Electron Main Process Entry Point
 * Handles application lifecycle and window management
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vite-env.d.ts" />

import { app, BrowserWindow, ipcMain, crashReporter } from 'electron';
import * as path from 'path';
import { registerAllHandlers, cleanupAllProcesses } from './handlers';

/**
 * Enable crash reporting for debugging (Build 13+)
 * Crash reports stored locally, NOT uploaded
 */
crashReporter.start({
  productName: 'Klever Desktop',
  submitURL: '', // Empty = local-only crash reports
  uploadToServer: false,
  compress: true,
});

/**
 * V8 Crash Workarounds for macOS Sequoia (Build 13+)
 * Fixes DNS-related crash at ~6.6s after launch
 * See: CRASH_ANALYSIS.md
 */
// Disable V8 optimizations that trigger crashes on macOS Sequoia beta
app.commandLine.appendSwitch('js-flags', '--no-opt');
// Disable macOS-specific features causing crashes
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// Reduce DNS/network complexity to prevent ares_dns_rr crashes
app.commandLine.appendSwitch('disable-http-cache');

// Enable verbose logging in development
if (!app.isPackaged) {
  app.commandLine.appendSwitch('enable-logging');
  app.commandLine.appendSwitch('v', '1');
}

let mainWindow: BrowserWindow | null = null;

/**
 * Create the browser window
 */
function createWindow(): void {
  // Debug logging for troubleshooting MAS vs darwin builds
  console.log('=== Klever Desktop Starting ===');
  console.log('App Version:', app.getVersion());
  console.log('Electron Version:', process.versions.electron);
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('App Path:', app.getAppPath());
  console.log('Exe Path:', app.getPath('exe'));
  console.log('Resources Path:', process.resourcesPath);
  console.log('User Data:', app.getPath('userData'));
  console.log('Is MAS Build:', process.mas === true);
  console.log('Is Packaged:', app.isPackaged);
  console.log('================================');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load the app
  // Electron Forge provides these environment variables
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Development mode - load from Vite dev server
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load from extraResource dist/
    // Use process.resourcesPath which points to app/Contents/Resources/
    const distPath = path.join(process.resourcesPath, 'dist', 'index.html');
    console.log('Loading renderer from:', distPath);
    mainWindow.loadFile(distPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Cleanup processes on window close (async, but don't wait)
    cleanupAllProcesses().catch((err) => {
      console.error('Error during cleanup:', err);
    });
  });
}

/**
 * Get the main window instance
 */
function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * App lifecycle
 */
app.whenReady().then(() => {
  createWindow();
  registerAllHandlers(ipcMain, getMainWindow);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup on app quit
app.on('before-quit', async (event) => {
  event.preventDefault();
  await cleanupAllProcesses();
  app.exit(0);
});
