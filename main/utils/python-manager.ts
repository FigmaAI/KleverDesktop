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

  // Remove existing venv if invalid
  if (fs.existsSync(venvPath)) {
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
          console.error('[Python Manager] Virtual environment created but is invalid');
          resolve({
            success: false,
            error: 'Virtual environment created but validation failed',
          });
        }
      } else {
        console.error('[Python Manager] Failed to create virtual environment');
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
    onOutput?.('Upgrading pip...\n');

    const upgradePip = spawn(venvPip, ['install', '--upgrade', 'pip'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let errorOutput = '';

    upgradePip.stdout?.on('data', (data) => {
      const text = data.toString();
      onOutput?.(text);
    });

    upgradePip.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      onOutput?.(text); // pip outputs progress to stderr
    });

    upgradePip.on('close', (_code) => {
      // Install requirements
      onOutput?.('\nInstalling packages from requirements.txt...\n');

      const installProcess = spawn(venvPip, ['install', '-r', requirementsPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

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
          console.error('[Python Manager] Package installation failed');
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
      onOutput?.(text);
    });

    playwrightInstall.stderr?.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      onOutput?.(text);
    });

    playwrightInstall.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        console.error('[Python Manager] Playwright browser installation failed');
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
