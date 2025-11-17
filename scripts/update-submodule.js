/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SUBMODULE_PATH = 'appagent';

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      ...options
    });
  } catch (error) {
    if (!options.ignoreError) {
      console.error(`❌ Command failed: ${command}`);
      throw error;
    }
    return null;
  }
}

function getPythonVenvPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  if (platform === 'darwin' || platform === 'linux') {
    return path.join(homeDir, 'Library', 'Application Support', 'klever-desktop', 'python-env');
  } else if (platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Local', 'klever-desktop', 'python-env');
  }
  
  throw new Error('Unsupported platform: ' + platform);
}

function getPythonExecutable(venvPath) {
  const platform = os.platform();
  
  if (platform === 'darwin' || platform === 'linux') {
    return path.join(venvPath, 'bin', 'python');
  } else if (platform === 'win32') {
    return path.join(venvPath, 'Scripts', 'python.exe');
  }
  
  throw new Error('Unsupported platform: ' + platform);
}

console.log('🔄 Updating appagent submodule...\n');

// Step 1: Update git submodule
console.log('📥 Fetching latest changes from remote...');
exec('git submodule update --remote appagent');
console.log('✅ Submodule updated\n');

// Step 2: Stage changes
console.log('📝 Staging submodule changes...');
exec('git add appagent');
console.log('✅ Changes staged\n');

// Step 3: Check if venv exists
const venvPath = getPythonVenvPath();
const pythonExecutable = getPythonExecutable(venvPath);

if (!fs.existsSync(venvPath)) {
  console.log('⚠️  Python virtual environment not found at:');
  console.log(`   ${venvPath}`);
  console.log('   Run the app once to create the virtual environment.\n');
  process.exit(0);
}

if (!fs.existsSync(pythonExecutable)) {
  console.log('⚠️  Python executable not found at:');
  console.log(`   ${pythonExecutable}`);
  console.log('   Run the app once to create the virtual environment.\n');
  process.exit(0);
}

// Step 4: Check if requirements.txt exists
const requirementsPath = path.join(SUBMODULE_PATH, 'requirements.txt');

if (!fs.existsSync(requirementsPath)) {
  console.log('⚠️  requirements.txt not found at:');
  console.log(`   ${requirementsPath}`);
  console.log('   Skipping pip install.\n');
  process.exit(0);
}

// Step 5: Install/update Python dependencies
console.log('📦 Installing/updating Python dependencies...');
console.log(`   Virtual environment: ${venvPath}`);
console.log(`   Requirements file: ${requirementsPath}\n`);

try {
  exec(`"${pythonExecutable}" -m pip install --upgrade pip`, { silent: false });
  exec(`"${pythonExecutable}" -m pip install -r "${requirementsPath}"`, { silent: false });
  console.log('\n✅ Python dependencies updated successfully!\n');
} catch (error) {
  console.error('\n❌ Failed to install Python dependencies');
  console.error('   You may need to manually run:');
  console.error(`   "${pythonExecutable}" -m pip install -r "${requirementsPath}"\n`);
  process.exit(1);
}

console.log('✅ Submodule update complete!\n');

