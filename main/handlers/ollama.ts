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
  // Check if Ollama is installed
  ipcMain.handle('ollama:check', async () => {
    return new Promise((resolve) => {
      exec('which ollama', {
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      }, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve({ installed: false, path: null });
          return;
        }
        const ollamaPath = stdout.trim();
        // Also verify it's executable by checking version
        exec('ollama --version', {
          env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
        }, (versionError, versionStdout) => {
          if (versionError) {
            resolve({ installed: false, path: ollamaPath, error: versionError.message });
          } else {
            resolve({ installed: true, path: ollamaPath, version: versionStdout.trim() });
          }
        });
      });
    });
  });

  // List Ollama models
  ipcMain.handle('ollama:list', async () => {
    return new Promise((resolve) => {
      exec('ollama list', {
        timeout: 5000,
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      }, (error, stdout) => {
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
      const ollama = spawn('ollama', ['pull', modelName], {
        shell: true,  // Use shell to inherit PATH properly (for Homebrew paths like /opt/homebrew/bin)
        env: { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` }
      });

      ollama.stdout.on('data', (data) => {
        getMainWindow()?.webContents.send('ollama:pull:progress', data.toString());
      });

      ollama.stderr.on('data', (data) => {
        getMainWindow()?.webContents.send('ollama:pull:progress', data.toString());
      });

      ollama.on('error', (err) => {
        console.error('[ollama:pull] Spawn error:', err);
        getMainWindow()?.webContents.send('ollama:pull:progress', `Error: ${err.message}`);
        resolve({ success: false, error: err.message });
      });

      ollama.on('close', (code) => {
        resolve({ success: code === 0 });
      });
    });
  });
}
