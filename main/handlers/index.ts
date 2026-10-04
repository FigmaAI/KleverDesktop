import { IpcMain, BrowserWindow } from 'electron';
import { registerAndroidHandlers, cleanupAndroidSetup } from './android';
import { registerConfigHandlers } from './config';
import { registerUtilityHandlers } from './utilities';
import { registerProjectHandlers } from './project';
import { registerTaskHandlers, cleanupTaskProcesses } from './task';
import { registerDialogHandlers } from './dialogs';
import { registerGitHubHandlers } from './github';
import { registerScheduleHandlers } from './schedule';
import { registerTestCaseHandlers } from './testcase';
import { registerChatGPTHandlers } from './chatgpt';
import { cleanupChatGPTAuth, isChatGPTCredentialRotationActive } from '../utils/chatgpt-auth';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

export function registerAllHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  registerAndroidHandlers(ipcMain, getMainWindow);
  registerConfigHandlers(ipcMain);
  registerUtilityHandlers(ipcMain);
  registerProjectHandlers(ipcMain);
  registerTaskHandlers(ipcMain, getMainWindow);
  registerTestCaseHandlers(ipcMain);
  registerDialogHandlers(ipcMain, getMainWindow);
  registerGitHubHandlers(ipcMain);
  registerChatGPTHandlers(ipcMain, getMainWindow);
  registerScheduleHandlers(ipcMain);
  scheduleQueueManager.initialize(getMainWindow);
}

export async function cleanupAllProcesses(graceMs = isChatGPTCredentialRotationActive() ? 90000 : 6000): Promise<void> {
  scheduleQueueManager.shutdown();
  cleanupAndroidSetup();
  // Abort both owners synchronously, then allow credential checkpoints and run evidence to settle together.
  const results = await Promise.allSettled([
    cleanupTaskProcesses(Math.max(1, graceMs - 250)),
    cleanupChatGPTAuth(),
  ]);
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}
