/**
 * Utility IPC handlers
 * Handles shell operations and system info
 */

import { IpcMain, shell } from 'electron';
import * as os from 'os';

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
      return { success: false, error: (error instanceof Error ? error.message : \'Unknown error\') };
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
}
