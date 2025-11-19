/**
 * Utility IPC handlers
 * Handles shell operations and system info
 */

import { IpcMain, shell } from 'electron';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Register all utility handlers
 */
export function registerUtilityHandlers(ipcMain: IpcMain): void {
  // Open external URLs
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Get system information
  ipcMain.handle('system:info', async () => {
    return {
      success: true,
      info: {
        platform: process.platform,
        arch: process.arch,
        cpuCount: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
      },
    };
  });

  // Open folder in file explorer
  ipcMain.handle('shell:openPath', async (_event, folderPath: string) => {
    try {
      const result = await shell.openPath(folderPath);
      if (result) {
        // openPath returns an error string if it fails, empty string if successful
        return { success: false, error: result };
      }
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Read file contents
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });

  // Check if file exists
  ipcMain.handle('file:exists', async (_event, filePath: string) => {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return { success: true, exists: true };
    } catch {
      return { success: true, exists: false };
    }
  });

  // Read image file as base64
  ipcMain.handle('file:readImage', async (_event, filePath: string) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      const base64 = buffer.toString('base64');
      const ext = filePath.toLowerCase().split('.').pop() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                       ext === 'gif' ? 'image/gif' :
                       ext === 'webp' ? 'image/webp' :
                       ext === 'svg' ? 'image/svg+xml' : 'image/png';
      return { success: true, dataUrl: `data:${mimeType};base64,${base64}` };
    } catch (error: unknown) {
      return { success: false, error: (error instanceof Error ? error.message : 'Unknown error') };
    }
  });
}
