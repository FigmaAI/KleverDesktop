#!/usr/bin/env node

/**
 * Fetch latest appagent code from GitHub
 *
 * This script allows updating appagent even after migrating from git submodule to monorepo.
 *
 * Usage:
 *   node scripts/fetch-appagent.js [--branch=main] [--force]
 *
 * Options:
 *   --branch=<name>   Branch to fetch from (default: main)
 *   --force           Overwrite local changes without confirmation
 *   --dry-run         Show what would be done without making changes
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const APPAGENT_REPO = 'https://github.com/FigmaAI/appagent';
const APPAGENT_DIR = path.join(__dirname, '..', 'appagent');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  branch: 'main',
  force: false,
  dryRun: false
};

args.forEach(arg => {
  if (arg.startsWith('--branch=')) {
    options.branch = arg.split('=')[1];
  } else if (arg === '--force') {
    options.force = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
});

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

function checkLocalChanges() {
  if (!fs.existsSync(path.join(APPAGENT_DIR, '.git'))) {
    // Not a git repo (monorepo mode), check for modified files
    console.log('⚠️  appagent is not a git repository');
    console.log('   To update, this script will download fresh code from GitHub');
    return false;
  }

  const status = exec('git status --porcelain', {
    silent: true,
    cwd: APPAGENT_DIR
  });

  return status && status.trim().length > 0;
}

function downloadAppagent() {
  const tempDir = path.join(__dirname, '..', '.temp-appagent-download');
  const archiveUrl = `${APPAGENT_REPO}/archive/refs/heads/${options.branch}.tar.gz`;

  console.log(`\n📥 Downloading appagent from ${APPAGENT_REPO} (branch: ${options.branch})...\n`);

  if (options.dryRun) {
    console.log('[DRY RUN] Would download:', archiveUrl);
    console.log('[DRY RUN] Would extract to:', APPAGENT_DIR);
    return;
  }

  // Create temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Download using curl (cross-platform)
    const tarball = path.join(tempDir, 'appagent.tar.gz');
    console.log('Downloading archive...');
    exec(`curl -L -o "${tarball}" "${archiveUrl}"`);

    // Extract
    console.log('Extracting archive...');
    exec(`tar -xzf "${tarball}" -C "${tempDir}"`);

    // Find extracted directory (usually appagent-main or appagent-<branch>)
    const extractedDirs = fs.readdirSync(tempDir).filter(f =>
      f.startsWith('appagent-') && fs.statSync(path.join(tempDir, f)).isDirectory()
    );

    if (extractedDirs.length === 0) {
      throw new Error('Failed to find extracted appagent directory');
    }

    const extractedDir = path.join(tempDir, extractedDirs[0]);

    // Backup existing appagent if it exists
    if (fs.existsSync(APPAGENT_DIR)) {
      const backupDir = `${APPAGENT_DIR}.backup-${Date.now()}`;
      console.log(`Creating backup at ${backupDir}...`);
      fs.renameSync(APPAGENT_DIR, backupDir);
      console.log('✓ Backup created');
    }

    // Move new appagent
    console.log('Installing new appagent...');
    fs.renameSync(extractedDir, APPAGENT_DIR);

    // Remove .git directory (we're in monorepo mode)
    const gitDir = path.join(APPAGENT_DIR, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    console.log('\n✅ appagent updated successfully!\n');

    // Show what changed
    const requirementsPath = path.join(APPAGENT_DIR, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      console.log('📦 Dependencies (requirements.txt):');
      const requirements = fs.readFileSync(requirementsPath, 'utf8');
      requirements.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          console.log('   -', line.trim());
        }
      });
      console.log();
    }

    console.log('⚠️  Next steps:');
    console.log('   1. Review changes: git diff appagent/');
    console.log('   2. Test locally: yarn electron:dev');
    console.log('   3. Commit changes: git add appagent/ && git commit');
    console.log();

  } finally {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

function updateViaGit() {
  console.log('\n🔄 Updating appagent via git...\n');

  if (options.dryRun) {
    console.log('[DRY RUN] Would run: git fetch origin');
    console.log('[DRY RUN] Would run: git checkout', options.branch);
    console.log('[DRY RUN] Would run: git pull origin', options.branch);
    return;
  }

  const cwd = APPAGENT_DIR;

  exec('git fetch origin', { cwd });
  exec(`git checkout ${options.branch}`, { cwd });
  exec(`git pull origin ${options.branch}`, { cwd });

  console.log('\n✅ appagent updated successfully!\n');
}

// Main execution
console.log('🔧 appagent Fetch Script');
console.log('========================\n');

if (!fs.existsSync(APPAGENT_DIR)) {
  console.log('❌ appagent directory not found!');
  console.log('   Run: yarn submodule:init');
  process.exit(1);
}

// Check for local changes
const hasLocalChanges = checkLocalChanges();

if (hasLocalChanges && !options.force && !options.dryRun) {
  console.log('⚠️  Local changes detected in appagent/');
  console.log('   Use --force to overwrite, or commit your changes first.');
  process.exit(1);
}

// Determine update method
const isGitRepo = fs.existsSync(path.join(APPAGENT_DIR, '.git'));

if (isGitRepo) {
  console.log('📌 Detected: appagent is a git repository (submodule mode)');
  updateViaGit();
} else {
  console.log('📌 Detected: appagent is a regular directory (monorepo mode)');
  downloadAppagent();
}
