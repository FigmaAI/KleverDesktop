/**
 * Python Runtime Manager (Simplified)
 *
 * Manages bundled Python runtime for Klever Desktop.
 * No fallback - always uses bundled Python.
 * No venv creation - dependencies are pre-installed in site-packages.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Get bundled Python executable path
 * No fallback - always use bundled Python
 */
export function getPythonPath(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const platform = os.platform();
  const arch = os.arch();

  const basePath = isDev
    ? path.join(__dirname, '..', '..')
    : process.resourcesPath;

  const pythonDir = path.join(basePath, 'resources', 'python', `${platform}-${arch}`, 'python');

  let pythonExe: string;
  if (platform === 'win32') {
    pythonExe = path.join(pythonDir, 'python.exe');
  } else {
    pythonExe = path.join(pythonDir, 'bin', 'python3');
  }

  // ✨ Bundled Python must exist - no fallback
  if (!fs.existsSync(pythonExe)) {
    throw new Error(
      `Bundled Python not found at ${pythonExe}. ` +
      `Please run 'yarn python:build' to download Python runtime.`
    );
  }

  console.log('[Python Runtime] Using bundled Python:', pythonExe);
  return pythonExe;
}

/**
 * Get appagent directory path
 */
export function getAppagentPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    return path.join(__dirname, '..', '..', 'appagent');
  } else {
    // Production: appagent is in app.asar or unpacked
    return path.join(__dirname, '..', 'appagent');
  }
}

/**
 * Execute Python script with bundled runtime
 */
export function executePythonScript(
  scriptPath: string,
  args: string[] = [],
  options?: SpawnOptions
) {
  const pythonExe = getPythonPath();
  const appagentDir = getAppagentPath();
  const fullScriptPath = path.join(appagentDir, scriptPath);

  console.log('[Python Runtime] Executing:', fullScriptPath);
  console.log('[Python Runtime] Python:', pythonExe);
  console.log('[Python Runtime] Args:', args);

  const env = {
    ...process.env,
    PYTHONPATH: appagentDir,
    PYTHONUNBUFFERED: '1',
  };

  return spawn(pythonExe, ['-u', fullScriptPath, ...args], {
    ...options,
    env,
    cwd: appagentDir,
  });
}

/**
 * Check if Playwright browsers are installed
 */
export async function checkPlaywrightBrowsers(): Promise<boolean> {
  try {
    const pythonExe = getPythonPath();

    return new Promise((resolve) => {
      const proc = spawn(pythonExe, ['-m', 'playwright', 'list']);

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  } catch (error) {
    console.error('[Python Runtime] Error checking Playwright browsers:', error);
    return false;
  }
}

/**
 * Install Playwright browsers (runtime only)
 */
export async function installPlaywrightBrowsers(
  onProgress?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const pythonExe = getPythonPath();

    console.log('[Python Runtime] Installing Playwright browsers...');

    return new Promise((resolve) => {
      onProgress?.('Installing Playwright browsers (this may take a few minutes)...\n');

      const proc = spawn(pythonExe, ['-m', 'playwright', 'install', 'chromium']);

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        console.log('[Playwright]', text);
        onProgress?.(text);
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        console.log('[Playwright]', text);
        onProgress?.(text);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          console.log('[Python Runtime] ✓ Playwright browsers installed');
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Playwright installation failed with code ${code}`,
          });
        }
      });

      proc.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Get environment configuration for Python processes
 */
// eslint-disable-next-line no-undef
export function getPythonEnv(): NodeJS.ProcessEnv {
  const appagentDir = getAppagentPath();

  const env = { ...process.env };

  // Set PYTHONPATH to appagent directory
  env.PYTHONPATH = appagentDir;

  // Force unbuffered output for real-time logging
  env.PYTHONUNBUFFERED = '1';

  return env;
}

/**
 * Spawn bundled Python with arbitrary arguments
 * This is a low-level function for cases where executePythonScript is not suitable
 * (e.g., using -c flag for inline code execution)
 */
export function spawnBundledPython(
  args: string[],
  options?: SpawnOptions
) {
  const pythonExe = getPythonPath();
  const appagentDir = getAppagentPath();

  const env = {
    ...process.env,
    PYTHONPATH: appagentDir,
    PYTHONUNBUFFERED: '1',
    ...options?.env,
  };

  return spawn(pythonExe, args, {
    ...options,
    env,
  });
}

/**
 * Verify Python runtime is available
 * Returns detailed status information
 */
export function checkPythonRuntime(): {
  available: boolean;
  pythonPath?: string;
  appagentPath?: string;
  error?: string;
} {
  try {
    const pythonPath = getPythonPath();
    const appagentPath = getAppagentPath();

    // Verify appagent exists
    if (!fs.existsSync(appagentPath)) {
      return {
        available: false,
        error: `appagent directory not found at ${appagentPath}`,
      };
    }

    // Verify critical Python scripts exist
    const criticalScripts = [
      'scripts/self_explorer.py',
      'scripts/and_controller.py',
      'scripts/web_controller.py',
      'scripts/model.py',
    ];

    for (const script of criticalScripts) {
      const scriptPath = path.join(appagentPath, script);
      if (!fs.existsSync(scriptPath)) {
        return {
          available: false,
          pythonPath,
          appagentPath,
          error: `Critical script missing: ${script}`,
        };
      }
    }

    return {
      available: true,
      pythonPath,
      appagentPath,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      available: false,
      error: message,
    };
  }
}
