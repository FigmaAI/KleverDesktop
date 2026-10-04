import type { BrowserWindow, IpcMain } from 'electron';
import {
  cancelChatGPTLogin, getChatGPTStatus, logoutChatGPT, onChatGPTStatusChanged, startChatGPTLogin,
} from '../utils/chatgpt-auth';
import type { ChatGPTStatus } from '../types/chatgpt';

let unsubscribe: (() => void) | undefined;

export function registerChatGPTHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  unsubscribe?.();
  unsubscribe = onChatGPTStatusChanged(status => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) window.webContents.send('chatgpt:updated', status);
  });
  const handlers: Record<string, () => Promise<ChatGPTStatus>> = {
    'chatgpt:status': getChatGPTStatus,
    'chatgpt:cancel': cancelChatGPTLogin,
    'chatgpt:logout': logoutChatGPT,
  };
  ipcMain.handle('chatgpt:login', async (_event, options: { reconsent?: boolean } = {}) => {
    try { return { success: true, data: await startChatGPTLogin({ reconsent: options?.reconsent === true }) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'ChatGPT connection could not be completed.' }; }
  });
  for (const [channel, action] of Object.entries(handlers)) {
    ipcMain.handle(channel, async () => {
      try { return { success: true, data: await action() }; }
      catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'ChatGPT connection could not be completed.' };
      }
    });
  }
}
