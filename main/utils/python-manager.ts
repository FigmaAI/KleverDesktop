/**
 * Python Environment Manager
 *
 * @deprecated This module is DEPRECATED as of 2024-11-18.
 * Use `python-runtime.ts` instead for simplified bundled Python management.
 *
 * This file is kept for reference only. The venv-based approach has been
 * replaced with a simpler bundled Python solution that:
 * - Eliminates runtime venv creation
 * - Removes system Python fallback complexity
 * - Provides deterministic Python environment
 * - Offers clearer error messages
 *
 * DO NOT USE THIS MODULE IN NEW CODE.
 * See: main/utils/python-runtime.ts
 *
 * Legacy description:
 * Manages bundled Python runtime and virtual environments for Klever Desktop.
 * Provides complete isolation from system Python installation.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { spawn, SpawnOptions } from 'child_process';

/**
 * Get the path to the bundled Python executable
 * Handles both development and production modes
 */
export function getBundledPythonPath(): string {
  const isDev = process.env.NODE_ENV === 'development';
  const platform = os.platform();

  let pythonExecutable: string;
  if (platform === 'win32') {
    pythonExecutable = 'python.exe';
  } else {
    pythonExecutable = 'python3';
  }

  let pythonPath: string;

  if (isDev) {
    // Development mode: Python is in resources/python/<platform>/
    const rootDir = path.join(__dirname, '..', '..');
    pythonPath = path.join(rootDir, 'resources', 'python', platform, 'python', 'bin', pythonExecutable);
  } else {
    // Production mode: Python is in app.asar.unpacked or extraResources
    const resourcesPath = process.resourcesPath;
    pythonPath = path.join(resourcesPath, 'python', platform, 'python', 'bin', pythonExecutable);
  }

  // Fallback: Check if bundled Python exists, otherwise use system Python
  if (fs.existsSync(pythonPath)) {
    return pythonPath;
  } else {
    console.warn('[Python Manager] Bundled Python not found, falling back to system Python');
    return 'python'; // Fallback to system Python
  }
}

/**
 * Get the path to the virtual environment
 * Virtual environment is stored in app data directory
 */
export function getVenvPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'python-env');
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
 * Get the pip executable from the virtual environment
 */
export function getVenvPipPath(): string {
  const venvPath = getVenvPath();
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'pip.exe');
  } else {
    return path.join(venvPath, 'bin', 'pip');
  }
}

/**
 * Check if virtual environment exists and is valid
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
 * Create a virtual environment using bundled Python
 */
export async function createVirtualEnvironment(
  onOutput?: (data: string) => void,
  onError?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  const bundledPython = getBundledPythonPath();
  const venvPath = getVenvPath();

  console.log('[Python Manager] Creating virtual environment...');
  console.log('[Python Manager] Bundled Python:', bundledPython);
  console.log('[Python Manager] Venv Path:', venvPath);

  // Remove existing venv if invalid
  if (fs.existsSync(venvPath)) {
    console.log('[Python Manager] Removing existing virtual environment...');
    fs.rmSync(venvPath, { recursive: true, force: true });
  }

  // Create parent directory
  const parentDir = path.dirname(venvPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  return new Promise((resolve) => {
    const venvProcess = spawn(bundledPython, ['-m', 'venv', venvPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    venvProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      console.log('[Python Manager] stdout:', text);
      onOutput?.(text);
    });

    venvProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('[Python Manager] stderr:', text);
      onError?.(text);
    });

    venvProcess.on('close', (code) => {
      console.log('[Python Manager] venv creation finished with code:', code);

      if (code === 0) {
        // Verify venv was created successfully
        const status = checkVenvStatus();
        if (status.valid) {
          console.log('[Python Manager] ✅ Virtual environment created successfully!');
          resolve({ success: true });
        } else {
          console.error('[Python Manager] ❌ Virtual environment created but is invalid');
          resolve({
            success: false,
            error: 'Virtual environment created but validation failed',
          });
        }
      } else {
        console.error('[Python Manager] ❌ Failed to create virtual environment');
        resolve({
          success: false,
          error: errorOutput || `venv creation failed with code ${code}`,
        });
      }
    });

    venvProcess.on('error', (error) => {
      console.error('[Python Manager] Process error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Install packages from requirements.txt into the virtual environment
 */
export async function installRequirements(
  requirementsPath: string,
  onOutput?: (data: string) => void,
  _onError?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  const venvPip = getVenvPipPath();

  console.log('[Python Manager] Installing requirements...');
  console.log('[Python Manager] Pip:', venvPip);
  console.log('[Python Manager] Requirements:', requirementsPath);

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
    // First upgrade pip
    console.log('[Python Manager] Upgrading pip...');
    onOutput?.('Upgrading pip...\n');

    const upgradePip = spawn(venvPip, ['install', '--upgrade', 'pip'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    upgradePip.stdout?.on('data', (data) => {
      const text = data.toString();
      console.log('[Python Manager] pip upgrade stdout:', text);
      onOutput?.(text);
    });

    upgradePip.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('[Python Manager] pip upgrade stderr:', text);
      onOutput?.(text); // pip outputs progress to stderr
    });

    upgradePip.on('close', (code) => {
      if (code !== 0) {
        console.warn('[Python Manager] ⚠️  pip upgrade had non-zero exit code, continuing anyway...');
      }

      // Install requirements
      console.log('[Python Manager] Installing from requirements.txt...');
      onOutput?.('\nInstalling packages from requirements.txt...\n');

      const installProcess = spawn(venvPip, ['install', '-r', requirementsPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      installProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        console.log('[Python Manager] install stdout:', text);
        onOutput?.(text);
      });

      installProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        console.log('[Python Manager] install stderr:', text);
        onOutput?.(text); // pip outputs progress to stderr
      });

      installProcess.on('close', (code) => {
        console.log('[Python Manager] Package installation finished with code:', code);

        if (code === 0) {
          console.log('[Python Manager] ✅ Packages installed successfully!');
          resolve({ success: true });
        } else {
          console.error('[Python Manager] ❌ Package installation failed');
          resolve({
            success: false,
            error: errorOutput || `Package installation failed with code ${code}`,
          });
        }
      });

      installProcess.on('error', (error) => {
        console.error('[Python Manager] Install process error:', error.message);
        resolve({ success: false, error: error.message });
      });
    });

    upgradePip.on('error', (error) => {
      console.error('[Python Manager] Pip upgrade error:', error.message);
      resolve({ success: false, error: `Failed to upgrade pip: ${error.message}` });
    });
  });
}

/**
 * Install Playwright browsers using venv Python
 */
export async function installPlaywrightBrowsers(
  onOutput?: (data: string) => void,
  _onError?: (data: string) => void
): Promise<{ success: boolean; error?: string }> {
  const venvPython = getVenvPythonPath();

  console.log('[Python Manager] Installing Playwright browsers...');
  console.log('[Python Manager] Python:', venvPython);

  // Verify venv is valid
  const status = checkVenvStatus();
  if (!status.valid) {
    return { success: false, error: 'Virtual environment is not valid. Please create it first.' };
  }

  return new Promise((resolve) => {
    onOutput?.('Installing Playwright browsers (this may take a few minutes)...\n');

    const playwrightInstall = spawn(venvPython, ['-m', 'playwright', 'install', 'chromium'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    playwrightInstall.stdout?.on('data', (data) => {
      const text = data.toString();
      console.log('[Python Manager] playwright install stdout:', text);
      onOutput?.(text);
    });

    playwrightInstall.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      console.log('[Python Manager] playwright install stderr:', text);
      onOutput?.(text);
    });

    playwrightInstall.on('close', (code) => {
      console.log('[Python Manager] Playwright browser installation finished with code:', code);

      if (code === 0) {
        console.log('[Python Manager] ✅ Playwright browsers installed successfully!');
        resolve({ success: true });
      } else {
        console.error('[Python Manager] ❌ Playwright browser installation failed');
        resolve({
          success: false,
          error: errorOutput || `Playwright installation failed with code ${code}`,
        });
      }
    });

    playwrightInstall.on('error', (error) => {
      console.error('[Python Manager] Playwright install error:', error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

/**
 * Run a Python script using the venv Python
 */
export function spawnVenvPython(args: string[], options?: SpawnOptions) {
  const venvPython = getVenvPythonPath();

  console.log('[Python Manager] Spawning Python process:', venvPython, args);

  // Create a new process group for easier cleanup
  // This allows us to kill the entire process tree with -PID
  const spawnOptions: SpawnOptions = {
    ...options,
    detached: false, // Keep attached to parent so we can manage it
  };

  // On Unix-like systems, we want to create a new session
  // so all child processes (adb, emulator, etc.) can be killed together
  if (process.platform !== 'win32') {
    // We'll handle process group killing in the task handler
    // No special flags needed here
  }

  return spawn(venvPython, args, spawnOptions);
}

/**
 * Get environment configuration for Python processes
 */
// eslint-disable-next-line no-undef
export function getPythonEnv(): NodeJS.ProcessEnv {
  const venvPath = getVenvPath();
  const platform = os.platform();

  const env = { ...process.env };

  // Set virtual environment
  env.VIRTUAL_ENV = venvPath;

  // Update PATH to include venv binaries
  if (platform === 'win32') {
    env.PATH = `${path.join(venvPath, 'Scripts')};${env.PATH}`;
  } else {
    env.PATH = `${path.join(venvPath, 'bin')}:${env.PATH}`;
  }

  // Remove PYTHONHOME to avoid conflicts
  delete env.PYTHONHOME;

  // Force unbuffered output for real-time logging
  env.PYTHONUNBUFFERED = '1';

  return env;
}
