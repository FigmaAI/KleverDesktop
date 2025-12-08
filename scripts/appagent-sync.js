#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const os = require('os');
const readline = require('readline');

const REPO_URL = 'https://github.com/FigmaAI/AppAgent.git';
const APPAGENT_SOURCE = path.join(__dirname, '..', 'appagent');

// Files and directories to exclude from sync
const EXCLUDE_PATTERNS = [
  '.git',
  '__pycache__',
  '*.pyc',
  '.DS_Store',
  '.pytest_cache',
  '*.egg-info',
  'node_modules',
  '.venv',
  'venv'
];

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkGitInstalled() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    log('Error: git is not installed or not in PATH', 'red');
    log('Please install git: https://git-scm.com/downloads', 'yellow');
    return false;
  }
}

function shouldExclude(filename) {
  return EXCLUDE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filename);
    }
    return filename === pattern;
  });
}

function copyDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldExclude(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (options.silent) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    child.on('error', reject);
  });
}

async function promptCommitMessage() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter commit message: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  log('\n🔄 AppAgent Sync Script', 'bright');
  log('━'.repeat(50), 'cyan');

  // Check if git is installed
  if (!checkGitInstalled()) {
    process.exit(1);
  }

  // Check if appagent directory exists
  if (!fs.existsSync(APPAGENT_SOURCE)) {
    log(`Error: appagent directory not found at ${APPAGENT_SOURCE}`, 'red');
    process.exit(1);
  }

  // Get commit message from CLI args or prompt
  let commitMessage = '';
  const messageArg = process.argv.find(arg => arg.startsWith('--message='));

  if (messageArg) {
    commitMessage = messageArg.split('=')[1];
  } else if (process.argv.includes('--message') || process.argv.includes('-m')) {
    const index = Math.max(
      process.argv.indexOf('--message'),
      process.argv.indexOf('-m')
    );
    commitMessage = process.argv[index + 1] || '';
  }

  // Create temporary directory
  const tempDir = path.join(os.tmpdir(), `appagent-sync-${Date.now()}`);
  log(`\n📁 Creating temporary directory: ${tempDir}`, 'blue');
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Clone repository
    log('\n📥 Cloning AppAgent repository...', 'blue');
    await runCommand('git', ['clone', REPO_URL, tempDir]);

    // Copy appagent files to cloned repository
    log('\n📋 Copying appagent files...', 'blue');
    copyDirectory(APPAGENT_SOURCE, tempDir);

    // Check for changes
    log('\n🔍 Checking for changes...', 'blue');
    const { stdout: statusOutput } = await runCommand('git', ['status', '--porcelain'], {
      cwd: tempDir,
      silent: true
    });

    if (!statusOutput.trim()) {
      log('\n✅ No changes to sync', 'green');
      fs.rmSync(tempDir, { recursive: true, force: true });
      return;
    }

    // Display changes
    log('\n📝 Changes detected:', 'yellow');
    await runCommand('git', ['status'], { cwd: tempDir });

    // Get commit message if not provided
    if (!commitMessage) {
      log('', 'reset');
      commitMessage = await promptCommitMessage();

      if (!commitMessage) {
        log('\n❌ Commit message is required', 'red');
        fs.rmSync(tempDir, { recursive: true, force: true });
        process.exit(1);
      }
    }

    // Add all changes
    log('\n➕ Staging changes...', 'blue');
    await runCommand('git', ['add', '.'], { cwd: tempDir });

    // Commit changes
    log('\n💾 Creating commit...', 'blue');
    await runCommand('git', ['commit', '-m', commitMessage], { cwd: tempDir });

    // Push changes
    log('\n🚀 Pushing to remote repository...', 'blue');
    await runCommand('git', ['push', 'origin', 'main'], { cwd: tempDir });

    log('\n✅ Successfully synced appagent to AppAgent repository!', 'green');
    log(`   Commit message: "${commitMessage}"`, 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  } finally {
    // Clean up temporary directory
    log('\n🧹 Cleaning up temporary directory...', 'blue');
    fs.rmSync(tempDir, { recursive: true, force: true });
    log('━'.repeat(50), 'cyan');
  }
}

// Run the script
main().catch((error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
