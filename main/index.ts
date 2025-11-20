/**
 * Electron Main Process Entry Point
 * Handles application lifecycle and window management
 */

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./vite-env.d.ts" />

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { registerAllHandlers, cleanupAllProcesses } from './handlers';

let mainWindow: BrowserWindow | null = null;

/**
 * Create the browser window
 */
function createWindow(): void {
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
