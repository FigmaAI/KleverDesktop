const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');

const KLEVER_DIR = path.join(os.homedir(), '.klever-desktop');
const VENV_PATH = path.join(KLEVER_DIR, 'python-env');
// Phase C Migration: Requirements now centralized in core/
const REQUIREMENTS_PATH = path.join(__dirname, '..', 'core', 'requirements.txt');

const isWin = os.platform() === 'win32';
const pythonExe = isWin
  ? path.join(VENV_PATH, 'Scripts', 'python.exe')
  : path.join(VENV_PATH, 'bin', 'python');

if (!fs.existsSync(pythonExe)) {
  console.error('Virtual environment not found. Please run "npm run python:refresh" first.');
  process.exit(1);
}

console.log(`Using Python at: ${pythonExe}`);
console.log(`Installing requirements from: ${REQUIREMENTS_PATH}`);

const pip = spawn(pythonExe, ['-m', 'pip', 'install', '-r', REQUIREMENTS_PATH], {
  stdio: 'inherit'
});

pip.on('close', (code) => {
  if (code === 0) {
    console.log('Python environment synced successfully!');
  } else {
    console.error('Failed to sync Python environment.');
    process.exit(code);
  }
});
