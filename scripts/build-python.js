#!/usr/bin/env node

/**
 * Python Build Script
 *
 * Downloads Python Embedded distribution and pre-installs dependencies.
 * This script prepares the Python runtime for bundling with the Electron app.
 *
 * Usage:
 *   node scripts/build-python.js [--platform=darwin] [--arch=arm64] [--dry-run]
 *
 * Options:
 *   --platform=<name>   Target platform (darwin, win32, linux) - defaults to current
 *   --arch=<arch>       Target architecture (x64, arm64) - defaults to current
 *   --dry-run           Show what would be done without downloading
 *   --force             Re-download even if already exists
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const os = require('os');

// Parse arguments
const args = process.argv.slice(2);
const options = {
  platform: null,
  arch: null,
  dryRun: false,
  force: false
};

args.forEach(arg => {
  if (arg.startsWith('--platform=')) {
    options.platform = arg.split('=')[1];
  } else if (arg.startsWith('--arch=')) {
    options.arch = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg === '--force') {
    options.force = true;
  }
});

// Default to current platform/arch
options.platform = options.platform || os.platform();
options.arch = options.arch || os.arch();

const PYTHON_VERSION = '3.11.9';
const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'resources');
const PYTHON_BASE_DIR = path.join(RESOURCES_DIR, 'python');

// Python download URLs (platform-specific)
const PYTHON_URLS = {
  'darwin-x64': `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-macos11.pkg`,
  'darwin-arm64': `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-macos11.pkg`,
  'win32-x64': `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
  'linux-x64': `https://www.python.org/ftp/python/${PYTHON_VERSION}/Python-${PYTHON_VERSION}.tgz`
};

function exec(command, opts = {}) {
  try {
    return execSync(command, {
      stdio: opts.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...opts
    });
  } catch (error) {
    if (!opts.ignoreError) {
      throw error;
    }
    return null;
  }
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Node.js' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function getLatestReleaseTag() {
  console.log('🔎 Fetching latest release tag for Python 3.11 from GitHub...');
  const fallbackTag = '20240814';

  try {
    const releases = await fetchJSON('https://api.github.com/repos/astral-sh/python-build-standalone/releases');

    // Find a release that contains a CPython 3.11 build for macOS aarch64
    const arch = options.arch === 'arm64' ? 'aarch64' : 'x86_64';
    for (const release of releases) {
      if (release.assets && release.assets.some(asset =>
        asset.name.includes('cpython-3.11') &&
        asset.name.includes(`${arch}-apple-darwin`)
      )) {
        console.log(`✓ Found best release tag: ${release.tag_name}`);
        return release.tag_name;
      }
    }

    throw new Error('Could not find a release with Python 3.11 for the target architecture.');
  } catch (error) {
    console.error('❌ Failed to fetch latest release tag.', error.message);
    console.warn(`⚠️ Using fallback release tag: ${fallbackTag}`);
    return fallbackTag;
  }
}

function getPythonTargetDir() {
  const platformKey = `${options.platform}-${options.arch}`;
  return path.join(PYTHON_BASE_DIR, platformKey, 'python');
}

function checkIfExists() {
  const targetDir = getPythonTargetDir();
  const pythonExe = options.platform === 'win32'
    ? path.join(targetDir, 'python.exe')
    : path.join(targetDir, 'bin', 'python3');

  return fs.existsSync(pythonExe);
}

async function downloadPython() {
  const platformKey = `${options.platform}-${options.arch}`;
  const downloadUrl = PYTHON_URLS[platformKey];

  if (!downloadUrl) {
    throw new Error(`Unsupported platform: ${platformKey}`);
  }

  console.log(`\n📥 Downloading Python ${PYTHON_VERSION} for ${platformKey}...\n`);
  console.log(`URL: ${downloadUrl}`);

  if (options.dryRun) {
    console.log('[DRY RUN] Would download and extract Python');
    return;
  }

  const targetDir = getPythonTargetDir();
  const tempDir = path.join(ROOT_DIR, '.temp-python-download');

  // Create directories
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  try {
    const filename = path.basename(downloadUrl);
    const downloadPath = path.join(tempDir, filename);

    // Download
    console.log('Downloading...');
    exec(`curl -L -o "${downloadPath}" "${downloadUrl}"`);

    // Extract based on platform
    console.log('Extracting...');

    if (options.platform === 'darwin') {
      // macOS: Extract .pkg (requires special handling)
      console.log('Note: macOS .pkg extraction requires additional steps');
      console.log('For now, using standalone Python build approach...');

      // Alternative: Download standalone Python build
      let standalonePath;
      try {
        const releaseDate = await getLatestReleaseTag();
        standalonePath = path.join(tempDir, 'python-standalone.tar.gz');
        const standaloneUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${releaseDate}/cpython-${PYTHON_VERSION}+${releaseDate}-${options.arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin-install_only.tar.gz`;

        console.log(`URL: ${standaloneUrl}`);
        exec(`curl -L -f -o "${standalonePath}" "${standaloneUrl}"`);

        const stats = fs.statSync(standalonePath);
        if (stats.size < 1000000) {
          throw new Error('Downloaded file is too small. Download failed.');
        }
        console.log(`✓ Download successful (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

      } catch (e) {
        console.warn(`⚠️  Auto-detection failed: ${e.message}`);
        console.log('Retrying with a known good release...');
        const fallbackTag = '20240814';
        standalonePath = path.join(tempDir, 'python-standalone.tar.gz');
        const standaloneUrl = `https://github.com/astral-sh/python-build-standalone/releases/download/${fallbackTag}/cpython-${PYTHON_VERSION}+${fallbackTag}-${options.arch === 'arm64' ? 'aarch64' : 'x86_64'}-apple-darwin-install_only.tar.gz`;

        console.log(`Fallback URL: ${standaloneUrl}`);
        exec(`curl -L -f -o "${standalonePath}" "${standaloneUrl}"`);
      }

      exec(`mkdir -p "${targetDir}"`);
      exec(`tar -xzf "${standalonePath}" -C "${targetDir}" --strip-components=1`);

    } else if (options.platform === 'win32') {
      // Windows: Extract .zip
      exec(`unzip -q "${downloadPath}" -d "${targetDir}"`);

      // Create get-pip.py for pip installation
      const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
      const getPipPath = path.join(targetDir, 'get-pip.py');
      exec(`curl -L -o "${getPipPath}" "${getPipUrl}"`);

      // Install pip
      const pythonExe = path.join(targetDir, 'python.exe');
      exec(`"${pythonExe}" "${getPipPath}"`);

    } else if (options.platform === 'linux') {
      // Linux: Build from source (simplified)
      exec(`tar -xzf "${downloadPath}" -C "${tempDir}"`);

      const sourceDir = path.join(tempDir, `Python-${PYTHON_VERSION}`);
      exec(`./configure --prefix="${targetDir}" --enable-optimizations`, { cwd: sourceDir });
      exec(`make -j$(nproc)`, { cwd: sourceDir });
      exec(`make install`, { cwd: sourceDir });
    }

    console.log('✅ Python downloaded and extracted successfully!\n');

  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

function installDependencies() {
  console.log('\n📦 Installing Python dependencies...\n');

  const targetDir = getPythonTargetDir();
  const requirementsPath = path.join(ROOT_DIR, 'appagent', 'requirements.txt');

  if (!fs.existsSync(requirementsPath)) {
    console.warn('⚠️  requirements.txt not found at:', requirementsPath);
    console.warn('   Skipping dependency installation');
    return;
  }

  if (options.dryRun) {
    console.log('[DRY RUN] Would install dependencies from:', requirementsPath);
    return;
  }

  // Get Python executable path
  const pythonExe = options.platform === 'win32'
    ? path.join(targetDir, 'python.exe')
    : path.join(targetDir, 'bin', 'python3');

  if (!fs.existsSync(pythonExe)) {
    throw new Error(`Python executable not found at: ${pythonExe}`);
  }

  // Create site-packages directory
  const sitePackagesDir = options.platform === 'win32'
    ? path.join(targetDir, 'site-packages')
    : path.join(targetDir, 'lib', `python3.11`, 'site-packages');

  fs.mkdirSync(sitePackagesDir, { recursive: true });

  // Upgrade pip
  console.log('Upgrading pip...');
  exec(`"${pythonExe}" -m pip install --upgrade pip`);

  // Install requirements
  console.log('Installing packages from requirements.txt...');
  exec(`"${pythonExe}" -m pip install -r "${requirementsPath}" --target "${sitePackagesDir}"`);

  console.log('\n✅ Dependencies installed successfully!\n');

  // List installed packages
  console.log('📋 Installed packages:');
  const requirements = fs.readFileSync(requirementsPath, 'utf8');
  requirements.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      console.log('   ✓', line.trim());
    }
  });
  console.log();
}

function showSummary() {
  const targetDir = getPythonTargetDir();
  const platformKey = `${options.platform}-${options.arch}`;

  console.log('\n' + '='.repeat(60));
  console.log('📊 Build Summary');
  console.log('='.repeat(60));
  console.log();
  console.log('Platform:        ', platformKey);
  console.log('Python Version:  ', PYTHON_VERSION);
  console.log('Install Location:', targetDir);

  if (!options.dryRun && fs.existsSync(targetDir)) {
    // Calculate directory size
    const sizeBytes = execSync(`du -sh "${targetDir}"`, { encoding: 'utf8' })
      .trim()
      .split('\t')[0];
    console.log('Size:            ', sizeBytes);
  }

  console.log();
  console.log('✅ Python runtime is ready for bundling!');
  console.log();
  console.log('Next steps:');
  console.log('   1. Run: yarn build');
  console.log('   2. Run: yarn package');
  console.log('   3. Test: The packaged app should include bundled Python');
  console.log();
}

// Main execution
async function main() {
  console.log('🐍 Python Build Script');
  console.log('======================\n');
  console.log('Target:', `${options.platform}-${options.arch}`);
  console.log('Python:', PYTHON_VERSION);

  if (options.dryRun) {
    console.log('\n⚠️  DRY RUN MODE - No files will be downloaded\n');
  }

  // Check if already exists
  const alreadyExists = checkIfExists();

  if (alreadyExists && !options.force) {
    console.log('\n✓ Python runtime already exists');
    console.log('  Use --force to re-download\n');
    showSummary();
    return;
  }

  if (alreadyExists && options.force) {
    console.log('\n⚠️  Forcing re-download (--force flag set)\n');
    const targetDir = getPythonTargetDir();
    if (!options.dryRun) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  // Download Python
  await downloadPython();

  // Install dependencies
  if (!options.dryRun) {
    installDependencies();
  }

  // Show summary
  showSummary();
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error();
  console.error('Build failed. Please check the error message above.');
  process.exit(1);
});
