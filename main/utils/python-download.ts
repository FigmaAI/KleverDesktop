/**
 * Python Standalone Download Utility
 * Downloads python-build-standalone from astral-sh
 * 
 * This module handles downloading Python at runtime to user data directory
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PYTHON_VERSION = '3.11.9';
const RELEASE_DATE = '20240814'; // Stable release

/**
 * Get the base directory for Klever Desktop data
 */
function getKleverDir(): string {
  return path.join(os.homedir(), '.klever-desktop');
}

/**
 * Get Python installation directory in user data
 */
export function getPythonDownloadDir(): string {
  const platform = os.platform();
  const arch = os.arch();
  
  return path.join(getKleverDir(), 'python', `${platform}-${arch}`, 'python');
}

/**
 * Download and install standalone Python
 */
export async function downloadPython(
  onProgress?: (message: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    const platform = os.platform();
    const arch = os.arch();
    const platformKey = `${platform}-${arch}`;

    onProgress?.(`📦 Downloading Python ${PYTHON_VERSION} for ${platformKey}...\n`);

    // Determine download URL
    let downloadUrl: string;

    if (platform === 'darwin') {
      // Use standalone Python build for macOS
      const archStr = arch === 'arm64' ? 'aarch64' : 'x86_64';
      downloadUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_DATE}/cpython-${PYTHON_VERSION}+${RELEASE_DATE}-${archStr}-apple-darwin-install_only.tar.gz`;
    } else if (platform === 'win32') {
      downloadUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
    } else if (platform === 'linux') {
      const archStr = arch === 'arm64' ? 'aarch64' : 'x86_64';
      downloadUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE_DATE}/cpython-${PYTHON_VERSION}+${RELEASE_DATE}-${archStr}-unknown-linux-gnu-install_only.tar.gz`;
    } else {
      return { success: false, error: `Unsupported platform: ${platformKey}` };
    }

    const kleverDir = getKleverDir();
    const tempDir = path.join(kleverDir, '.temp-python-download');
    const targetDir = getPythonDownloadDir();

    // Clean up previous temp and target directories
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Create directories
    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(targetDir, { recursive: true });

    const filename = path.basename(downloadUrl);
    const downloadPath = path.join(tempDir, filename);

    // Download
    onProgress?.('⬇️  Downloading... (this may take a few minutes)\n');
    onProgress?.(`URL: ${downloadUrl}\n`);

    await execAsync(`curl -L -f -o "${downloadPath}" "${downloadUrl}"`, {
      maxBuffer: 200 * 1024 * 1024 // 200MB buffer
    });

    // Verify download
    const stats = fs.statSync(downloadPath);
    if (stats.size < 1000000) {
      throw new Error('Downloaded file is too small (< 1MB), may be corrupted');
    }
    onProgress?.(`✓ Download complete (${(stats.size / 1024 / 1024).toFixed(1)} MB)\n`);

    // Extract
    onProgress?.('📦 Extracting Python...\n');

    if (platform === 'darwin' || platform === 'linux') {
      // Extract tar.gz
      await execAsync(`tar -xzf "${downloadPath}" -C "${targetDir}" --strip-components=1`, {
        maxBuffer: 200 * 1024 * 1024
      });
    } else if (platform === 'win32') {
      // Extract zip using PowerShell (built-in on Windows)
      const psCommand = `powershell -Command "Expand-Archive -Path '${downloadPath}' -DestinationPath '${targetDir}' -Force"`;
      await execAsync(psCommand, {
        maxBuffer: 200 * 1024 * 1024
      });

      // Configure Windows embedded Python for pip
      // 1. Uncomment import site in python311._pth file
      const pythonVersion = PYTHON_VERSION.split('.').slice(0, 2).join('');
      const pthFile = path.join(targetDir, `python${pythonVersion}._pth`);

      if (fs.existsSync(pthFile)) {
        onProgress?.('Configuring Python environment...\n');
        let pthContent = fs.readFileSync(pthFile, 'utf8');
        // Uncomment 'import site' line
        pthContent = pthContent.replace(/#\s*import\s+site/gi, 'import site');
        // Add Lib/site-packages to the path if not present
        if (!pthContent.includes('Lib\\site-packages')) {
          pthContent += '\nLib\\site-packages\n';
        }
        fs.writeFileSync(pthFile, pthContent);
      }

      // 2. Install pip for Windows embedded Python
      onProgress?.('Installing pip...\n');
      const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
      const getPipPath = path.join(targetDir, 'get-pip.py');
      await execAsync(`curl -L -o "${getPipPath}" "${getPipUrl}"`);

      const pythonExe = path.join(targetDir, 'python.exe');
      await execAsync(`"${pythonExe}" "${getPipPath}"`, {
        maxBuffer: 200 * 1024 * 1024
      });

      // Verify pip installation
      const pipExe = path.join(targetDir, 'Scripts', 'pip.exe');
      if (!fs.existsSync(pipExe)) {
        throw new Error('pip installation failed - pip.exe not found');
      }
      onProgress?.('✓ pip installed successfully\n');
    }

    onProgress?.('✓ Extraction complete\n');

    // Verify Python executable exists
    const pythonExe = platform === 'win32'
      ? path.join(targetDir, 'python.exe')
      : path.join(targetDir, 'bin', 'python3');

    if (!fs.existsSync(pythonExe)) {
      throw new Error(`Python executable not found at ${pythonExe} after extraction`);
    }

    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    onProgress?.('✅ Python installation complete!\n');
    return { success: true };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}
