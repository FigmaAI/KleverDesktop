/**
 * Translation IPC handlers
 * Handles translation requests from renderer process
 */

import { IpcMain } from 'electron';
import { translateText, translateMarkdown } from '../utils/translator';

/**
 * Register translation handlers
 */
export function registerTranslatorHandlers(ipcMain: IpcMain): void {
  // Translate text
  ipcMain.handle('translator:translateText', async (_event, text: string, targetLang: string) => {
    return await translateText(text, targetLang);
  });

  // Translate markdown
  ipcMain.handle('translator:translateMarkdown', async (_event, markdown: string, targetLang: string) => {
    return await translateMarkdown(markdown, targetLang);
  });
}
