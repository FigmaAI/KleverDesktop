/**
 * Process management utilities
 * Handles spawning, monitoring, and cleanup of child processes
 */

import { spawn, ChildProcess } from 'child_process';
import { BrowserWindow } from 'electron';

export interface SpawnWithProgressOptions {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  progressChannel: string;
  mainWindow: BrowserWindow | null;
}

export interface SpawnResult {
  success: boolean;
  code: number | null;
  output: string;
  error: string;
}

/**
 * Spawn a process and stream progress to the renderer
 * @param options - Spawn configuration
 * @returns Promise that resolves with the result
 */
export function spawnWithProgress(options: SpawnWithProgressOptions): Promise<SpawnResult> {
  const { command, args, cwd, env, progressChannel, mainWindow } = options;

  return new Promise((resolve) => {
    const process = spawn(command, args, {
      cwd,
      env: env || process.env,
    });

    let output = '';
    let errorOutput = '';

    process.stdout?.on('data', (data) => {
      const message = data.toString();
      output += message;
      mainWindow?.webContents.send(progressChannel, message);
    });

    process.stderr?.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      mainWindow?.webContents.send(progressChannel, message);
    });

    process.on('close', (code) => {
      resolve({
        success: code === 0,
        code,
        output,
        error: errorOutput,
      });
    });

    process.on('error', (error) => {
      errorOutput = error.message;
      mainWindow?.webContents.send(progressChannel, `Error: ${error.message}`);
      resolve({
        success: false,
        code: null,
        output,
        error: errorOutput,
      });
    });
  });
}

/**
 * Safely kill a process with SIGTERM
 * @param process - The process to kill
 */
export function killProcess(process: ChildProcess | null): void {
  if (process && !process.killed) {
    try {
      process.kill('SIGTERM');
    } catch (error) {
      console.error('Error killing process:', error);
    }
  }
}

/**
 * Kill all processes in a map
 * @param processMap - Map of process identifiers to child processes
 */
export function killAllProcesses(processMap: Map<string, ChildProcess>): void {
  processMap.forEach((process) => {
    killProcess(process);
  });
  processMap.clear();
}
