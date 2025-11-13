/**
 * Configuration IPC handlers
 * Handles loading and saving YAML config files
 */

import { IpcMain } from 'electron';
import { loadConfig, saveConfig } from '../utils/config-manager';

/**
 * Register all config handlers
 */
export function registerConfigHandlers(ipcMain: IpcMain): void {
  // Load config from YAML
  ipcMain.handle('config:load', async () => {
    try {
      const config = loadConfig();
      return { success: true, config };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Save config to YAML
  ipcMain.handle('config:save', async (_event, config: Record<string, any>) => {
    try {
      saveConfig(config);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
