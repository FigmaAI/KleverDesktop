import { IpcMain } from 'electron';
import { loadAppConfig, saveAppConfig } from '../utils/config-storage';
import { AppConfig } from '../types/config';

export function registerConfigHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('config:load', () => {
    try { return { success: true, config: loadAppConfig() }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to load settings' }; }
  });
  ipcMain.handle('config:save', (_event, config: AppConfig) => {
    try { saveAppConfig(config); return { success: true }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to save settings' }; }
  });
}
