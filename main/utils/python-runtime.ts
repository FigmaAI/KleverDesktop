/**
 * Python Runtime Manager
 *
 * Manages Python runtime for Klever Desktop.
 * Python is downloaded at runtime to user data directory.
 *
 * Structure:
 * - ~/.klever-desktop/python/<platform>-<arch>/python (downloaded)
 * - ~/.klever-desktop/python-env (venv for packages)
 * - resources/appagent (scripts)
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Get the path to the virtual environment in user data directory
 * This is where we install Python packages from requirements.txt
 */
/**
 * Get the base directory for Klever Desktop data
 * ~/.klever-desktop
 */
export function getKleverDir(): string {
  return path.join(os.homedir(), '.klever-desktop');
}

/**
 * Get the path to the virtual environment in user data directory
 * This is where we install Python packages from requirements.txt
 */
export function getVenvPath(): string {
  return path.join(getKleverDir(), 'python-env');
}

/**
 * Get the Python executable from the virtual environment
 */
export function getVenvPythonPath(): string {
  const venvPath = getVenvPath();
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'python.exe');
  } else {
    return path.join(venvPath, 'bin', 'python');
  }
}

/**
 * Check if virtual environment exists and is valid
 * Returns whether venv directory exists and has a valid Python executable
 */
export function checkVenvStatus(): {
  exists: boolean;
  valid: boolean;
  path: string;
  pythonExecutable: string;
} {
  const venvPath = getVenvPath();
  const venvPythonPath = getVenvPythonPath();

  const exists = fs.existsSync(venvPath);
  const valid = exists && fs.existsSync(venvPythonPath);

  return {
    exists,
    valid,
    path: venvPath,
    pythonExecutable: venvPythonPath,
  };
}

/**
 * Get the directory where Python is installed
 * Uses user data directory for runtime downloads
 */
export function getPythonInstallDir(): string {
  const platform = os.platform();
  const arch = os.arch();
  
  // Python is downloaded to ~/.klever-desktop/python/<platform>-<arch>/python
  return path.join(getKleverDir(), 'python', `${platform}-${arch}`, 'python');
}

/**
 * Get Python executable path
 */
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
    throw new Error(`Python runtime not found at ${pythonExe}. Please run Setup Wizard to download Python.`);
  }

  return pythonExe;
}

/**
 * Check if Python is installed (Bundled check)
 */
export function isPythonInstalled(): boolean {
  try {
    const pythonPath = getPythonPath();
    return fs.existsSync(pythonPath);
  } catch {
    return false;
  }
}

/**
 * Get legacy scripts directory path (appagent folder)
 *
 * NOTE: This points to the legacy appagent/scripts/ folder.
 * Pending migration to engines/ architecture.
 * For new code, use getEnginesPath() or getCorePath() instead.
 */
export function getLegacyScriptsPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In dev: ../../engines/appagent_legacy
    return path.join(__dirname, '..', '..', 'engines', 'appagent_legacy');
  } else {
    // Production: appagent_legacy is an extraResource in Resources/engines/appagent_legacy
    const legacyPath = path.join(process.resourcesPath, 'engines', 'appagent_legacy');

    if (!fs.existsSync(legacyPath)) {
      console.error('[Python Runtime] Legacy scripts directory not found at:', legacyPath);
    }

    return legacyPath;
  }
}

/**
 * Get engines directory path (new architecture)
 * Contains GELab, Browser-Use, and other agent engines
 */
export function getEnginesPath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In dev: ../../engines
    return path.join(__dirname, '..', '..', 'engines');
  } else {
    // Production: engines is an extraResource in Resources/engines
    const enginesPath = path.join(process.resourcesPath, 'engines');

    if (!fs.existsSync(enginesPath)) {
      console.error('[Python Runtime] Engines directory not found at:', enginesPath);
    }

    return enginesPath;
  }
}

/**
 * Get core layer directory path
 * Contains shared utilities like LLM adapter, config loader
 */
export function getCorePath(): string {
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // In dev: ../../core
    return path.join(__dirname, '..', '..', 'core');
  } else {
    // Production: core is an extraResource in Resources/core
    const corePath = path.join(process.resourcesPath, 'core');

    if (!fs.existsSync(corePath)) {
      console.error('[Python Runtime] Core layer not found at:', corePath);
    }

    return corePath;
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
  const legacyScriptsDir = getLegacyScriptsPath();
  const fullScriptPath = path.join(legacyScriptsDir, scriptPath);

  const env = {
    ...process.env,
    PYTHONPATH: legacyScriptsDir,
    PYTHONUNBUFFERED: '1',
  };

  return spawn(pythonExe, ['-u', fullScriptPath, ...args], {
    ...options,
    env,
    cwd: legacyScriptsDir,
  });
}

/**
 * Create a virtual environment using downloaded Python
 * For Windows embedded Python, uses virtualenv package instead of venv module
 */
export async function createVirtualEnvironment(
  onOutput?: (data: string) => void,
  onError?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  const bundledPython = getPythonPath();
  const venvPath = getVenvPath();
  const platform = os.platform();

  // Remove existing venv if invalid
  if (fs.existsSync(venvPath)) {
    fs.rmSync(venvPath, { recursive: true, force: true });
  }

  // Create parent directory
  const parentDir = path.dirname(venvPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Windows embedded Python doesn't include venv module, use virtualenv instead
  if (platform === 'win32') {
    return new Promise((resolve) => {
      // First install virtualenv
      onOutput?.('Installing virtualenv package...\n');

      const installVirtualenv = spawn(bundledPython, ['-m', 'pip', 'install', 'virtualenv'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let errorOutput = '';

      installVirtualenv.stdout?.on('data', (data) => {
        const text = data.toString();
        onOutput?.(text);
      });

      installVirtualenv.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        onOutput?.(text); // pip outputs progress to stderr
      });

      installVirtualenv.on('close', (code) => {
        if (code !== 0) {
          console.error('[Python Runtime] Failed to install virtualenv');
          resolve({
            success: false,
            error: errorOutput || `virtualenv installation failed with code ${code}`,
          });
          return;
        }

        // Now create venv using virtualenv
        onOutput?.('Creating virtual environment...\n');
        errorOutput = '';

        const venvProcess = spawn(bundledPython, ['-m', 'virtualenv', venvPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        venvProcess.stdout?.on('data', (data) => {
          const text = data.toString();
          onOutput?.(text);
        });

        venvProcess.stderr?.on('data', (data) => {
          const text = data.toString();
          errorOutput += text;
          onError?.(text);
        });

        venvProcess.on('close', (code) => {
          if (code === 0) {
            // Verify venv was created successfully
            const status = checkVenvStatus();
            if (status.valid) {
              resolve({ success: true });
            } else {
              console.error('[Python Runtime] Virtual environment created but is invalid');
              resolve({
                success: false,
                error: 'Virtual environment created but validation failed',
              });
            }
          } else {
            console.error('[Python Runtime] Failed to create virtual environment');
            resolve({
              success: false,
              error: errorOutput || `venv creation failed with code ${code}`,
            });
          }
        });

        venvProcess.on('error', (error) => {
          console.error('[Python Runtime] Process error:', error.message);
          resolve({ success: false, error: error.message });
        });
      });

      installVirtualenv.on('error', (error) => {
        console.error('[Python Runtime] virtualenv install error:', error.message);
        resolve({ success: false, error: `Failed to install virtualenv: ${error.message}` });
      });
    });
  } else {
    // macOS/Linux: use built-in venv module
    return new Promise((resolve) => {
      const venvProcess = spawn(bundledPython, ['-m', 'venv', venvPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let errorOutput = '';

      venvProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        onOutput?.(text);
      });

      venvProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        onError?.(text);
      });

      venvProcess.on('close', (code) => {
        if (code === 0) {
          // Verify venv was created successfully
          const status = checkVenvStatus();
          if (status.valid) {
            resolve({ success: true });
          } else {
            console.error('[Python Runtime] Virtual environment created but is invalid');
            resolve({
              success: false,
              error: 'Virtual environment created but validation failed',
            });
          }
        } else {
          console.error('[Python Runtime] Failed to create virtual environment');
          resolve({
            success: false,
            error: errorOutput || `venv creation failed with code ${code}`,
          });
        }
      });

      venvProcess.on('error', (error) => {
        console.error('[Python Runtime] Process error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });
  }
}

/**
 * Install packages from requirements.txt into the virtual environment
 */
export async function installRequirements(
  requirementsPath: string,
  onOutput?: (data: string) => void,
  _onError?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  const venvPythonPath = getVenvPythonPath();

  // Verify requirements.txt exists
  if (!fs.existsSync(requirementsPath)) {
    return { success: false, error: `requirements.txt not found at ${requirementsPath}` };
  }

  // Verify venv is valid
  const status = checkVenvStatus();
  if (!status.valid) {
    return { success: false, error: 'Virtual environment is not valid. Please create it first.' };
  }

  return new Promise((resolve) => {
    // Install requirements
    onOutput?.('Installing packages from requirements.txt...\n');

    const installProcess = spawn(venvPythonPath, ['-m', 'pip', 'install', '-r', requirementsPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    installProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      onOutput?.(text);
    });

    installProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      onOutput?.(text); // pip outputs progress to stderr
    });

    installProcess.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error('[Python Runtime] Package installation failed');
        resolve({
          success: false,
          error: errorOutput || `Package installation failed with code ${code}`,
        });
      }
    });

    installProcess.on('error', (error) => {
      console.error('[Python Runtime] Install process error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Check if Playwright browsers are installed
 */
export async function checkPlaywrightBrowsers(): Promise<boolean> {
  try {
    // Use venv python to check for installed packages
    const venvStatus = checkVenvStatus();
    console.log('[Playwright Check] Venv status:', venvStatus);
    
    if (!venvStatus.valid) {
      console.log('[Playwright Check] Venv invalid, returning false');
      return false;
    }
    const pythonExe = getVenvPythonPath();
    console.log('[Playwright Check] Using Python executable:', pythonExe);

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
      let errorOutput = '';

      checkBrowsers.stdout?.on('data', (data) => {
        output += data.toString();
      });

      checkBrowsers.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      checkBrowsers.on('close', (checkCode) => {
        console.log('[Playwright Check] Process closed with code:', checkCode);
        console.log('[Playwright Check] Output:', output.trim());
        if (errorOutput) console.error('[Playwright Check] Stderr:', errorOutput);
        
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
    // Use venv python to access installed packages
    const pythonExe = getVenvPythonPath();

    return new Promise((resolve) => {
      onProgress?.('Installing Playwright browsers (this may take a few minutes)...\n');

      let errorOutput = '';

      const proc = spawn(pythonExe, ['-m', 'playwright', 'install', 'chromium']);

      proc.stdout?.on('data', (data) => {
        const text = data.toString();
        onProgress?.(text);
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        onProgress?.(text);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Playwright installation failed with code ${code}. Details: ${errorOutput}`,
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
  const legacyScriptsDir = getLegacyScriptsPath();

  const env = { ...process.env };

  // Set PYTHONPATH to legacy scripts directory
  env.PYTHONPATH = legacyScriptsDir;

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
  const pythonExe = getVenvPythonPath();
  const legacyScriptsDir = getLegacyScriptsPath();

  const env = {
    ...process.env,
    PYTHONPATH: legacyScriptsDir,
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
  legacyScriptsPath?: string;
  error?: string;
} {
  try {
    const pythonPath = getPythonPath();
    const legacyScriptsPath = getLegacyScriptsPath();

    // Verify legacy scripts directory exists
    if (!fs.existsSync(legacyScriptsPath)) {
      return {
        available: false,
        error: `Legacy scripts directory not found at ${legacyScriptsPath}`,
      };
    }

    // Verify critical Python scripts exist
    const criticalScripts = [
      'scripts/self_explorer.py',
      'scripts/and_controller.py',
      'scripts/model.py',
    ];

    for (const script of criticalScripts) {
      const scriptPath = path.join(legacyScriptsPath, script);
      if (!fs.existsSync(scriptPath)) {
        return {
          available: false,
          pythonPath,
          legacyScriptsPath,
          error: `Critical script missing: ${script}`,
        };
      }
    }

    return {
      available: true,
      pythonPath,
      legacyScriptsPath,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      available: false,
      error: message,
    };
  }
}
