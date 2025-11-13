/**
 * Ollama IPC handlers
 * Handles Ollama model listing and pulling
 */

import { IpcMain, BrowserWindow } from 'electron';
import { exec, spawn } from 'child_process';

/**
 * Register all Ollama handlers
 */
export function registerOllamaHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  // List Ollama models
  ipcMain.handle('ollama:list', async () => {
    return new Promise((resolve) => {
      exec('ollama list', { timeout: 5000 }, (error, stdout) => {
        if (error) {
          resolve({ success: false, error: error.message });
          return;
        }
        const lines = stdout.split('\n').slice(1); // Skip header
        const models = lines
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            return parts[0];
          })
          .filter(Boolean);
        resolve({ success: true, models });
      });
    });
  });

  // Pull Ollama model
  ipcMain.handle('ollama:pull', async (_event, modelName: string) => {
    return new Promise((resolve) => {
      const ollama = spawn('ollama', ['pull', modelName]);

      ollama.stdout.on('data', (data) => {
        getMainWindow()?.webContents.send('ollama:pull:progress', data.toString());
      });

      ollama.stderr.on('data', (data) => {
        getMainWindow()?.webContents.send('ollama:pull:progress', data.toString());
      });

      ollama.on('close', (code) => {
        resolve({ success: code === 0 });
      });
    });
  });
}
