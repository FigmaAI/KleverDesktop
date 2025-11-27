#!/usr/bin/env node

/**
 * Bundle Verification Script
 *
 * Verifies that all required files are present before packaging the app.
 * This ensures the app will work correctly in production.
 *
 * Usage:
 *   node scripts/verify-bundle.js [--platform=darwin] [--arch=arm64] [--strict]
 *
 * Options:
 *   --platform=<name>   Target platform (darwin, win32, linux) - defaults to current
 *   --arch=<arch>       Target architecture (x64, arm64) - defaults to current
 *   --strict            Exit with error code 1 if any check fails
 *   --skip-python       Skip Python runtime verification (useful for testing)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Parse arguments
const args = process.argv.slice(2);
const options = {
  platform: os.platform(),
  arch: os.arch(),
  strict: false,
  skipPython: false
};

args.forEach(arg => {
  if (arg.startsWith('--platform=')) {
    options.platform = arg.split('=')[1];
  } else if (arg.startsWith('--arch=')) {
    options.arch = arg.split('=')[1];
  } else if (arg === '--strict') {
    options.strict = true;
  } else if (arg === '--skip-python') {
    options.skipPython = true;
  }
});

const ROOT_DIR = path.join(__dirname, '..');
const platformKey = `${options.platform}-${options.arch}`;

// Define required files
const REQUIRED_FILES = {
  'Electron Build': [
    '.vite/build/main.js',  // Electron Forge Vite plugin output
    'dist/index.html',       // Renderer build output
  ],
  'appagent': [
    'appagent/scripts/self_explorer.py',
    'appagent/scripts/and_controller.py',
    'appagent/scripts/web_controller.py',
    'appagent/scripts/model.py',
    'appagent/requirements.txt',
  ],
  'Python Runtime': options.skipPython ? [] : [
    `resources/python/${platformKey}/python/${options.platform === 'win32' ? 'python.exe' : 'bin/python3'}`,
  ],
  'Python Dependencies': options.skipPython ? [] : [
    `resources/python/${platformKey}/python/${options.platform === 'win32' ? 'site-packages' : 'lib/python3.11/site-packages'}/ollama`,
    `resources/python/${platformKey}/python/${options.platform === 'win32' ? 'site-packages' : 'lib/python3.11/site-packages'}/playwright`,
  ]
};

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function colorize(color, text) {
  if (process.stdout.isTTY) {
    return `${colors[color]}${text}${colors.reset}`;
  }
  return text;
}

function checkFile(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const exists = fs.existsSync(fullPath);

  let sizeInfo = '';
  if (exists) {
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        // Count files in directory
        const fileCount = countFilesRecursive(fullPath);
        sizeInfo = ` (${fileCount} files)`;
      } else {
        const sizeKB = (stats.size / 1024).toFixed(1);
        sizeInfo = ` (${sizeKB} KB)`;
      }
    } catch (e) {
      // Ignore stat errors
    }
  }

  return { exists, path: filePath, sizeInfo };
}

function countFilesRecursive(dirPath) {
  let count = 0;
  try {
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      if (stats.isDirectory()) {
        count += countFilesRecursive(itemPath);
      } else {
        count++;
      }
    }
  } catch (e) {
    // Ignore read errors
  }
  return count;
}

function verify() {
  console.log(colorize('bright', '\n🔍 Bundle Verification'));
  console.log(colorize('bright', '='.repeat(60)));
  console.log();
  console.log('Platform:', platformKey);
  console.log('Mode:    ', options.strict ? 'Strict' : 'Normal');
  console.log();

  let totalChecks = 0;
  let passedChecks = 0;
  let failedChecks = 0;
  const failedFiles = [];

  for (const [category, files] of Object.entries(REQUIRED_FILES)) {
    if (files.length === 0) continue;

    console.log(colorize('cyan', `\n${category}:`));
    console.log(colorize('cyan', '-'.repeat(category.length + 1)));

    for (const file of files) {
      totalChecks++;
      const result = checkFile(file);

      const status = result.exists
        ? colorize('green', '✓')
        : colorize('red', '✗');

      const fileName = result.path.length > 50
        ? '...' + result.path.slice(-47)
        : result.path;

      console.log(`${status} ${fileName}${result.sizeInfo}`);

      if (result.exists) {
        passedChecks++;
      } else {
        failedChecks++;
        failedFiles.push(result.path);
      }
    }
  }

  // Summary
  console.log();
  console.log(colorize('bright', '='.repeat(60)));
  console.log(colorize('bright', '📊 Verification Summary'));
  console.log(colorize('bright', '='.repeat(60)));
  console.log();
  console.log('Total checks:  ', totalChecks);
  console.log('Passed:        ', colorize('green', `${passedChecks} ✓`));
  console.log('Failed:        ', colorize('red', `${failedChecks} ✗`));
  console.log();

  if (failedChecks === 0) {
    console.log(colorize('green', '✅ All checks passed! Bundle is ready for packaging.'));
    console.log();
    return 0;
  } else {
    console.log(colorize('red', '❌ Verification failed!'));
    console.log();
    console.log(colorize('yellow', 'Missing files:'));
    failedFiles.forEach(file => {
      console.log('  -', file);
    });
    console.log();
    console.log(colorize('yellow', '💡 Troubleshooting:'));
    console.log();

    // Provide helpful suggestions based on what's missing
    if (failedFiles.some(f => f.startsWith('.vite/build') || f.startsWith('dist/'))) {
      console.log('   Build the app with Electron Forge:');
      console.log('   $ npm run start    # Development mode (auto-builds)');
      console.log('   $ npm run package  # Production build');
      console.log();
    }

    if (failedFiles.some(f => f.startsWith('appagent/'))) {
      console.log('   Initialize appagent submodule:');
      console.log('   $ git submodule update --init --recursive');
      console.log();
    }

    if (failedFiles.some(f => f.includes('python') || f.includes('site-packages'))) {
      console.log('   Missing Python runtime or dependencies in resources/python/');
      console.log('   Please ensure the Python runtime is correctly placed.');
      console.log();
      console.log('   Or skip Python verification for testing:');
      console.log('   $ node scripts/verify-bundle.js --skip-python');
      console.log();
    }

    return options.strict ? 1 : 0;
  }
}

// Run verification
const exitCode = verify();
process.exit(exitCode);
