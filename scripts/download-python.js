#!/usr/bin/env node

/**
 * Downloads and extracts python-build-standalone for bundling
 * This script runs during postinstall to prepare Python runtime
 *
 * Sources:
 * - https://github.com/indygreg/python-build-standalone/releases
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Python version to download (LTS version with good compatibility)
const PYTHON_VERSION = '3.11.10';
const RELEASE_TAG = '20241016';

// Determine platform-specific download URL
function getPythonDownloadInfo() {
  const platform = os.platform();
  const arch = os.arch();

  let filename, extractCommand;

  if (platform === 'darwin') {
    // macOS
    if (arch === 'arm64') {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-apple-darwin-install_only.tar.gz`;
    } else {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-apple-darwin-install_only.tar.gz`;
    }
    extractCommand = 'tar -xzf';
  } else if (platform === 'win32') {
    // Windows
    if (arch === 'x64') {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-pc-windows-msvc-shared-install_only.tar.gz`;
    } else {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-i686-pc-windows-msvc-shared-install_only.tar.gz`;
    }
    extractCommand = 'tar -xzf';
  } else if (platform === 'linux') {
    // Linux
    if (arch === 'x64') {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-x86_64-unknown-linux-gnu-install_only.tar.gz`;
    } else if (arch === 'arm64') {
      filename = `cpython-${PYTHON_VERSION}+${RELEASE_TAG}-aarch64-unknown-linux-gnu-install_only.tar.gz`;
    } else {
      throw new Error(`Unsupported Linux architecture: ${arch}`);
    }
    extractCommand = 'tar -xzf';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const url = `https://github.com/indygreg/python-build-standalone/releases/download/${RELEASE_TAG}/${filename}`;

  return { url, filename, extractCommand, platform, arch };
}

// Download file with progress
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);

    const file = fs.createWriteStream(dest);
    let downloadedBytes = 0;

    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        console.log(`🔀 Redirecting to: ${redirectUrl}`);
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(redirectUrl, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
        process.stdout.write(`\r📦 Progress: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n✅ Download complete!');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// Extract archive
function extractArchive(archivePath, extractDir, extractCommand) {
  console.log(`📂 Extracting to: ${extractDir}`);

  try {
    // Create extract directory
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }

    // Extract based on platform
    if (os.platform() === 'win32') {
      // Windows: use tar (available in Windows 10+)
      execSync(`${extractCommand} "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
    } else {
      // Unix-like: use tar
      execSync(`${extractCommand} "${archivePath}" -C "${extractDir}"`, { stdio: 'inherit' });
    }

    console.log('✅ Extraction complete!');
  } catch (error) {
    throw new Error(`Failed to extract: ${error.message}`);
  }
}

// Main function
async function main() {
  console.log('🐍 Python Runtime Bundling for Klever Desktop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Get download info
    const { url, filename, extractCommand, platform, arch } = getPythonDownloadInfo();

    console.log(`Platform: ${platform}`);
    console.log(`Architecture: ${arch}`);
    console.log(`Python Version: ${PYTHON_VERSION}\n`);

    // Setup directories
    const rootDir = path.join(__dirname, '..');
    const resourcesDir = path.join(rootDir, 'resources');
    const pythonDir = path.join(resourcesDir, 'python');
    const platformDir = path.join(pythonDir, platform);
    const downloadPath = path.join(pythonDir, filename);

    // Create directories
    if (!fs.existsSync(pythonDir)) {
      fs.mkdirSync(pythonDir, { recursive: true });
    }

    // Check if Python is already downloaded
    if (fs.existsSync(platformDir) && fs.readdirSync(platformDir).length > 0) {
      console.log('✅ Python runtime already exists. Skipping download.\n');
      console.log('To re-download, delete the resources/python directory.\n');
      return;
    }

    // Download Python
    await downloadFile(url, downloadPath);

    // Extract Python
    extractArchive(downloadPath, platformDir, extractCommand);

    // Clean up archive
    console.log('🧹 Cleaning up...');
    fs.unlinkSync(downloadPath);

    console.log('\n✅ Python runtime bundled successfully!');
    console.log(`📁 Location: ${platformDir}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nIf the download fails, you can:');
    console.error('1. Check your internet connection');
    console.error('2. Download manually from: https://github.com/indygreg/python-build-standalone/releases');
    console.error('3. Extract to: resources/python/<platform>/\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, getPythonDownloadInfo };
