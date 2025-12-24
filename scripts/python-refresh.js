const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

const KLEVER_DIR = path.join(os.homedir(), '.klever-desktop');
const VENV_PATH = path.join(KLEVER_DIR, 'python-env');
const PLATFORM = os.platform();
const ARCH = os.arch();

// Base python path (downloaded runtime)
const BASE_PYTHON_DIR = path.join(KLEVER_DIR, 'python', `${PLATFORM}-${ARCH}`, 'python');
const isWin = PLATFORM === 'win32';
const basePythonExe = isWin
  ? path.join(BASE_PYTHON_DIR, 'python.exe')
  : path.join(BASE_PYTHON_DIR, 'bin', 'python3');

if (!fs.existsSync(basePythonExe)) {
  console.error(`Base Python not found at ${basePythonExe}. Please run the app to download it or ensure it is installed.`);
  process.exit(1);
}

// 1. Delete existing venv
if (fs.existsSync(VENV_PATH)) {
  console.log(`Removing existing virtual environment at ${VENV_PATH}...`);
  fs.rmSync(VENV_PATH, { recursive: true, force: true });
}

// 2. Create new venv
console.log(`Creating new virtual environment using ${basePythonExe}...`);
const venv = spawn(basePythonExe, ['-m', 'venv', VENV_PATH], {
  stdio: 'inherit'
});

venv.on('close', (code) => {
  if (code !== 0) {
    console.error('Failed to create virtual environment.');
    process.exit(code);
  }

  // 3. Install requirements
  console.log('Virtual environment created. Installing requirements...');
  const pythonExe = isWin
    ? path.join(VENV_PATH, 'Scripts', 'python.exe')
    : path.join(VENV_PATH, 'bin', 'python');

  // Phase C Migration: Requirements now centralized in core/
  const REQUIREMENTS_PATH = path.join(__dirname, '..', 'core', 'requirements.txt');

  const pip = spawn(pythonExe, ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH], {
    stdio: 'inherit'
  });

  pip.on('close', (code) => {
    if (code !== 0) {
      console.error('Failed to install requirements.');
      process.exit(code);
    }

    // 4. Install Playwright browsers
    console.log('Requirements installed. Installing Playwright browsers...');
    const playwright = spawn(pythonExe, ['-m', 'playwright', 'install', 'chromium'], {
      stdio: 'inherit'
    });

    playwright.on('close', (pwCode) => {
      if (pwCode === 0) {
        console.log('Python environment refreshed successfully!');
        console.log('✅ Virtual environment created');
        console.log('✅ Python packages installed');
        console.log('✅ Playwright Chromium installed');
      } else {
        console.error('Failed to install Playwright browsers.');
        process.exit(pwCode);
      }
    });
  });
});
