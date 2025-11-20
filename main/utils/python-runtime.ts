/**
 * Python Runtime Manager (Post-Install Download)
 *
 * Manages Python runtime downloaded to user data directory.
 * Python is downloaded during setup wizard, not bundled with the app.
 * This reduces app bundle size from ~1GB to ~200MB.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Get the directory where Python should be installed
 * Located in user data directory: ~/.klever-desktop/python/
 */
export function getPythonInstallDir(): string {
  const platform = os.platform();
  const arch = os.arch();
  const userDataPath = app.getPath('userData');

  return path.join(userDataPath, 'python', `${platform}-${arch}`, 'python');
}

/**
 * Get Python executable path
 * Now located in user data directory instead of app bundle
 */
export function getPythonPath(): string {
  const platform = os.platform();
  const pythonDir = getPythonInstallDir();

  let pythonExe: string;
  if (platform === 'win32') {
    pythonExe = path.join(pythonDir, 'python.exe');
  } else {
    pythonExe = path.join(pythonDir, 'bin', 'python3');
  }

  if (!fs.existsSync(pythonExe)) {
    throw new Error(
      `Python runtime not found at ${pythonExe}. ` +
      `Please install Python from the Setup Wizard.`
    );
  }

  console.log('[Python Runtime] Using Python:', pythonExe);
  return pythonExe;
}

/**
 * Check if Python is installed in user data directory
 */
export function isPythonInstalled(): boolean {
  try {
    const pythonExe = getPythonPath();
    return fs.existsSync(pythonExe);
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
    return path.join(__dirname, '..', '..', 'appagent');
  } else {
    // Production: appagent is an extraResource in Resources/
    // process.resourcesPath points to app/Contents/Resources/
    return path.join(process.resourcesPath, 'appagent');
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
    // Check if Python is installed first
    if (!isPythonInstalled()) {
      console.log('[Playwright Check] Python not installed yet');
      return false;
    }

    const pythonExe = getPythonPath();
    console.log('[Playwright Check] Using Python:', pythonExe);

    return new Promise((resolve) => {
      const proc = spawn(pythonExe, ['-m', 'playwright', '--version']);

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        console.log('[Playwright Check] Exit code:', code);
        console.log('[Playwright Check] stdout:', stdout.trim());
        if (stderr) console.log('[Playwright Check] stderr:', stderr.trim());

        // If playwright module is installed, check browsers
        if (code === 0) {
          // Now check if chromium is installed
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
            console.log('[Playwright Check] Browser check output:', output.trim());
            resolve(checkCode === 0 && output.includes('installed'));
          });

          checkBrowsers.on('error', (error) => {
            console.error('[Playwright Check] Browser check error:', error);
            resolve(false);
          });
        } else {
          resolve(false);
        }
      });

      proc.on('error', (error) => {
        console.error('[Playwright Check] Process error:', error);
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
