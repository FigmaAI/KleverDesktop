/**
 * Electron Main Process Entry Point
 * Handles application lifecycle and window management
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vite-env.d.ts" />

import squirrelStartup from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (squirrelStartup) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('electron').app.quit();
}

import { app, BrowserWindow, ipcMain, crashReporter, session } from 'electron';
import * as path from 'path';
import { registerAllHandlers, cleanupAllProcesses } from './handlers';
import { cleanupZombieTasks } from './utils/project-storage';
import { createMenu } from './menu';
import { initializeUpdater } from './handlers/updater';
import { checkSyncNeeded } from './utils/python-sync';

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
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion,Fontations');
// Reduce DNS/network complexity to prevent ares_dns_rr crashes
app.commandLine.appendSwitch('disable-http-cache');

// Enable verbose logging in development
if (!app.isPackaged) {
  // app.commandLine.appendSwitch('enable-logging');
  // app.commandLine.appendSwitch('v', '1');
}

let mainWindow: BrowserWindow | null = null;

/**
 * Create the browser window
 */
function createWindow(): void {
  // Debug logging for startup
  console.log('=== Klever Desktop Starting ===');
  console.log('App Version:', app.getVersion());
  console.log('Electron Version:', process.versions.electron);
  console.log('Platform:', process.platform);
  console.log('Architecture:', process.arch);
  console.log('App Path:', app.getAppPath());
  console.log('Exe Path:', app.getPath('exe'));
  console.log('Resources Path:', process.resourcesPath);
  console.log('User Data:', app.getPath('userData'));
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

  // Create application menu
  createMenu(mainWindow);

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
  // Set Content Security Policy
  // In development mode, we need 'unsafe-eval' for Vite HMR
  // In production, we use a stricter policy
  // Note: GitHub API is called via IPC, not direct fetch, so no need to allow it in CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = !app.isPackaged;

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            ? // Development CSP - allows Vite HMR
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* ws://localhost:*; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*; " +
              "style-src 'self' 'unsafe-inline' http://localhost:*; " +
              "img-src 'self' data: http://localhost:*; " +
              "connect-src 'self' http://localhost:* ws://localhost:*;"
            : // Production CSP - stricter policy
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data:; " +
              "connect-src 'self';"
        ]
      }
    });
  });

  // Clean up any tasks that were 'running' when app was terminated
  cleanupZombieTasks();
  
  // Initialize auto-updater
  initializeUpdater();
  
  createWindow();
  registerAllHandlers(ipcMain, getMainWindow);
  
  // Check Python environment sync after window is ready
  // This runs asynchronously and notifies the renderer if sync is needed
  checkPythonSync();
});

/**
 * Check if Python environment needs synchronization after app update
 * Runs asynchronously after app startup
 */
async function checkPythonSync(): Promise<void> {
  try {
    const syncCheck = checkSyncNeeded();
    
    if (syncCheck.needsSync) {
      console.log('[Python Sync] Environment sync needed:', syncCheck.reason);
      console.log('[Python Sync] App version:', syncCheck.currentAppVersion, '/', syncCheck.manifestAppVersion);
      
      // Notify the renderer process that sync is needed
      // The renderer can then show a dialog or progress indicator
      const window = getMainWindow();
      if (window) {
        window.webContents.on('did-finish-load', () => {
          window.webContents.send('python:sync-needed', {
            reason: syncCheck.reason,
            currentVersion: syncCheck.currentAppVersion,
            previousVersion: syncCheck.manifestAppVersion,
          });
        });
      }
      
      // Auto-sync in background (optional - can be disabled for user control)
      // Uncomment the following lines to enable auto-sync:
      /*
      console.log('[Python Sync] Starting automatic sync...');
      const result = await syncPythonEnvironment((msg) => {
        console.log('[Python Sync]', msg);
      });
      if (result.success) {
        console.log('[Python Sync] Environment synchronized successfully');
      } else {
        console.error('[Python Sync] Failed to sync environment:', result.error);
      }
      */
    } else {
      console.log('[Python Sync] Environment is up to date');
    }
  } catch (error) {
    console.error('[Python Sync] Error checking sync status:', error);
  }
}

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
