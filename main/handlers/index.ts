/**
 * Central export and registration for all IPC handlers
 */

import { IpcMain, BrowserWindow } from 'electron';
import { registerSystemCheckHandlers } from './system-checks';
import { registerInstallationHandlers } from './installations';
import { registerOllamaHandlers } from './ollama';
import { registerConfigHandlers } from './config';
import { registerModelHandlers } from './model';
import { registerUtilityHandlers } from './utilities';
import { registerIntegrationHandlers } from './integration';
import { registerProjectHandlers, cleanupProjectProcesses } from './project';
import { registerTaskHandlers, cleanupTaskProcesses } from './task';
import { registerDialogHandlers } from './dialogs';
import { registerGitHubHandlers } from './github';
import { registerTranslatorHandlers } from './translator';

/**
 * Register all IPC handlers
 * @param ipcMain - Electron IPC main instance
 * @param getMainWindow - Function to get the main window
 */
export function registerAllHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  registerSystemCheckHandlers(ipcMain);
  registerInstallationHandlers(ipcMain, getMainWindow);
  registerOllamaHandlers(ipcMain, getMainWindow);
  registerConfigHandlers(ipcMain);
  registerModelHandlers(ipcMain);
  registerUtilityHandlers(ipcMain);
  registerIntegrationHandlers(ipcMain, getMainWindow);
  registerProjectHandlers(ipcMain, getMainWindow);
  registerTaskHandlers(ipcMain, getMainWindow);
  registerDialogHandlers(ipcMain, getMainWindow);
  registerGitHubHandlers(ipcMain);
  registerTranslatorHandlers(ipcMain);
}

/**
 * Cleanup all processes on app exit
 */
export async function cleanupAllProcesses(): Promise<void> {
  cleanupProjectProcesses();
  await cleanupTaskProcesses();
}
