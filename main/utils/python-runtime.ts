/**
 * Python Runtime Manager (Bundled)
 *
 * Manages bundled Python runtime for Klever Desktop.
 * Assumes Python is pre-bundled in resources/python during build process.
 *
 * Structure:
 * - resources/python/<platform>/python (executable)
 * - resources/appagent (scripts)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Get the directory where Python is located
 * Prioritizes bundled Python in resources/python
 */
export function getPythonInstallDir(): string {
  const platform = os.platform();
  const arch = os.arch();
  
  // Check bundled path first (Production/Standard Build)
  // Resources/python/<platform>-<arch>/python
  const bundledPath = path.join(process.resourcesPath, 'python', `${platform}-${arch}`, 'python');
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // Fallback for development (if not bundled)
  // Use local .venv or similar if configured, otherwise system python
  return 'python'; 
}

/**
 * Get Python executable path
 */
export function getPythonPath(): string {
  const platform = os.platform();
  const pythonDir = getPythonInstallDir();

  // If pythonDir is just 'python' (fallback), return it
  if (pythonDir === 'python') return 'python';

  let pythonExe: string;
  if (platform === 'win32') {
    pythonExe = path.join(pythonDir, 'python.exe');
  } else {
    pythonExe = path.join(pythonDir, 'bin', 'python3');
  }

  // Verify existence if it's an absolute path
  if (path.isAbsolute(pythonExe) && !fs.existsSync(pythonExe)) {
    // In dev mode, we might fall back to system python
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Bundled Python not found at ${pythonExe}, falling back to system python`);
      return 'python3';
    }
    throw new Error(`Bundled Python runtime not found at ${pythonExe}`);
  }

  return pythonExe;
}

/**
 * Check if Python is installed (Bundled check)
 */
export function isPythonInstalled(): boolean {
  try {
    const pythonPath = getPythonPath();
    
    // If using system python fallback, check version
    if (pythonPath === 'python' || pythonPath === 'python3') {
      return true; // Assume system python exists for dev
    }

    return fs.existsSync(pythonPath);
  } catch {
    return false;
  }
}

/**
 * Get appagent directory path
 */
export function getAppagentPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In dev: ../../appagent
    return path.join(__dirname, '..', '..', 'appagent');
  } else {
    // Production: appagent is an extraResource in Resources/appagent
    // process.resourcesPath points to app/Contents/Resources/ (macOS) or resources/ (Windows)
    const appagentPath = path.join(process.resourcesPath, 'appagent');

    if (!fs.existsSync(appagentPath)) {
      console.error('[Python Runtime] Appagent directory not found at:', appagentPath);
    }

    return appagentPath;
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
      // Check if chromium is installed using python script
      const checkBrowsers = spawn(pythonExe, ['-c',
        'import playwright.sync_api; from pathlib import Path; ' +
        'pw = playwright.sync_api.sync_playwright().start(); ' +
        'browser_path = Path(pw.chromium.executable_path); ' +
        'print("installed" if browser_path.exists() else "not_installed"); ' +
        'pw.stop()'
      ]);

      let output = '';
      checkBrowsers.stdout?.on('data', (data) => {
        output += data.toString();
      });

      checkBrowsers.on('close', (checkCode) => {
        resolve(checkCode === 0 && output.includes('installed'));
      });

      checkBrowsers.on('error', (error) => {
        console.error('[Playwright Check] Browser check error:', error);
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

    return new Promise((resolve) => {
      onProgress?.('Installing Playwright browsers (this may take a few minutes)...\n');

      const proc = spawn(pythonExe, ['-m', 'playwright', 'install', 'chromium']);

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        onProgress?.(text);
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        onProgress?.(text);
      });

      proc.on('close', (code) => {
        if (code === 0) {
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
