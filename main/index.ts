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
import { isChatGPTCredentialRotationActive } from './utils/chatgpt-auth';

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

let mainWindow: BrowserWindow | null = null;
let windowCreationQueued = false;
let creatingWindow = false;
let quitCleanupStarted = false;

// A single process owns the shared run index, scheduler, and rotating account credentials.
if (!app.requestSingleInstanceLock()) app.exit(0);
app.on('second-instance', () => {
  void app.whenReady().then(() => {
    if (!mainWindow) createWindow();
    else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

/**
 * Create the browser window
 */
function createWindow(): void {
  if (quitCleanupStarted) return;
  if (!app.isReady()) {
    if (windowCreationQueued) return;
    windowCreationQueued = true;
    void app.whenReady().then(() => {
      windowCreationQueued = false;
      createWindow();
    });
    return;
  }
  if (creatingWindow || (mainWindow && !mainWindow.isDestroyed())) return;
  creatingWindow = true;
  try {
    // Debug logging for startup
    console.log('=== Klever Desktop Starting ===');
    console.log('App Version:', app.getVersion());
    console.log('Process:', process.pid);
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
      const distPath = path.join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'dist', 'index.html');
      console.log('Loading renderer from:', distPath);
      mainWindow.loadFile(distPath);
    }

    const ownedWindow = mainWindow;
    ownedWindow.on('closed', () => {
      if (mainWindow === ownedWindow) mainWindow = null;
      // Keep scheduled tests active while the application remains running.
      // Process cleanup belongs to before-quit, including on macOS window close.
    });
  } finally { creatingWindow = false; }
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
  if (quitCleanupStarted) return;
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

// Keep normal exits fast; a received token rotation must reach its durable checkpoint first.
app.on('before-quit', (event) => {
  event.preventDefault();
  if (quitCleanupStarted) return;
  quitCleanupStarted = true;
  // No async boundary separates this snapshot from aborting the owned jobs. SDK
  // queued refreshes check cancellation before beginning a protected rotation.
  const graceMs = isChatGPTCredentialRotationActive() ? 90000 : 6000;
  let exited = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const exit = () => {
    if (exited) return;
    exited = true;
    if (deadline) clearTimeout(deadline);
    app.exit(0);
  };
  deadline = setTimeout(exit, graceMs);
  void cleanupAllProcesses(graceMs).catch((error) => {
    console.error('Unable to finish shutdown cleanup:', error);
  }).finally(exit);
});
