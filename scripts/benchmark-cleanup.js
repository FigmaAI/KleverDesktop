/**
 * Vision Model Benchmark - Cleanup Utility
 * 
 * Manages benchmark tasks: reset failed, delete, or retry specific models.
 * 
 * Usage:
 *   node scripts/benchmark-cleanup.js --reset-failed      # Reset failed tasks to pending
 *   node scripts/benchmark-cleanup.js --delete-all        # Delete all benchmark tasks
 *   node scripts/benchmark-cleanup.js --reset gpt-4.1-mini  # Reset specific model
 *   node scripts/benchmark-cleanup.js --list              # List all benchmark tasks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const KLEVER_DIR = path.join(os.homedir(), '.klever-desktop');
const PROJECTS_PATH = path.join(KLEVER_DIR, 'projects.json');
const YOUTUBE_PROJECT_ID = 'proj_1766811180541';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    resetFailed: args.includes('--reset-failed'),
    deleteAll: args.includes('--delete-all'),
    deleteCompleted: args.includes('--delete-completed'),
    list: args.includes('--list'),
    reset: (() => {
      const idx = args.indexOf('--reset');
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    })(),
    delete: (() => {
      const idx = args.indexOf('--delete');
      return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
    })(),
    cancelPending: args.includes('--cancel-pending'),
    dryRun: args.includes('--dry-run'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Show help
function showHelp() {
  console.log(`
Vision Model Benchmark - Cleanup Utility

Usage:
  node scripts/benchmark-cleanup.js [options]

Options:
  --list              List all benchmark tasks
  --reset-failed      Reset all failed tasks to pending (for retry)
  --reset <model>     Reset tasks for a specific model (partial match)
  --cancel-pending    Cancel all pending tasks
  --delete <model>    Delete tasks for a specific model
  --delete-completed  Delete completed tasks
  --delete-all        Delete ALL benchmark tasks
  --dry-run           Preview changes without applying
  --help, -h          Show this help message

Examples:
  node scripts/benchmark-cleanup.js --list
  node scripts/benchmark-cleanup.js --reset-failed
  node scripts/benchmark-cleanup.js --reset gpt-4.1-mini
  node scripts/benchmark-cleanup.js --delete-all --dry-run
`);
}

// Load projects.json
function loadProjects() {
  if (!fs.existsSync(PROJECTS_PATH)) {
    console.error(`Error: projects.json not found at ${PROJECTS_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(PROJECTS_PATH, 'utf8'));
}

// Save projects.json
function saveProjects(data) {
  // Backup first
  const backupPath = PROJECTS_PATH + '.backup';
  fs.copyFileSync(PROJECTS_PATH, backupPath);
  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2));
  console.log(`   💾 Backup saved: ${backupPath}`);
}

// Get benchmark tasks
function getBenchmarkTasks(projectsData) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  if (!youtubeProject) {
    console.error(`Error: Youtube project not found`);
    process.exit(1);
  }
  return youtubeProject.tasks.filter(t => t.name && t.name.startsWith('Benchmark:'));
}

// Get short model name
function getShortName(modelId) {
  if (!modelId) return 'unknown';
  const parts = modelId.split('/');
  return parts[parts.length - 1];
}

// List tasks
function listTasks(tasks) {
  console.log('\n📋 Benchmark Tasks:');
  console.log('─'.repeat(90));
  
  const statusEmoji = {
    'completed': '✅',
    'failed': '❌',
    'pending': '⏳',
    'running': '🔄',
    'cancelled': '🚫',
  };
  
  const byStatus = {
    running: [],
    pending: [],
    completed: [],
    failed: [],
    cancelled: [],
  };
  
  for (const task of tasks) {
    const status = task.status || 'unknown';
    if (byStatus[status]) {
      byStatus[status].push(task);
    }
  }
  
  for (const [status, statusTasks] of Object.entries(byStatus)) {
    if (statusTasks.length === 0) continue;
    
    console.log(`\n${statusEmoji[status] || '❓'} ${status.toUpperCase()} (${statusTasks.length})`);
    for (const task of statusTasks) {
      const scheduled = task.scheduledAt 
        ? new Date(task.scheduledAt).toLocaleTimeString() 
        : '-';
      console.log(`   ${getShortName(task.modelName).padEnd(35)} ${scheduled}`);
    }
  }
  
  console.log('\n' + '─'.repeat(90));
  console.log(`Total: ${tasks.length} tasks`);
}

// Reset failed tasks
function resetFailedTasks(projectsData, dryRun) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  const benchmarkTasks = youtubeProject.tasks.filter(t => 
    t.name && t.name.startsWith('Benchmark:') && t.status === 'failed'
  );
  
  if (benchmarkTasks.length === 0) {
    console.log('No failed benchmark tasks found.');
    return 0;
  }
  
  console.log(`\n🔄 Resetting ${benchmarkTasks.length} failed tasks:`);
  
  const now = new Date();
  let delay = 30; // Start in 30 seconds
  
  for (const task of benchmarkTasks) {
    console.log(`   ${getShortName(task.modelName)}`);
    
    if (!dryRun) {
      task.status = 'pending';
      task.error = undefined;
      task.output = undefined;
      task.metrics = undefined;
      task.startedAt = undefined;
      task.completedAt = undefined;
      task.updatedAt = now.toISOString();
      // Reschedule with 5-min intervals
      task.scheduledAt = new Date(now.getTime() + delay * 1000).toISOString();
      delay += 300; // 5 minutes between tasks
    }
  }
  
  if (!dryRun) {
    youtubeProject.updatedAt = now.toISOString();
    saveProjects(projectsData);
  }
  
  return benchmarkTasks.length;
}

// Reset specific model tasks
function resetModelTasks(projectsData, modelFilter, dryRun) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  const benchmarkTasks = youtubeProject.tasks.filter(t => 
    t.name && t.name.startsWith('Benchmark:') && 
    t.modelName && t.modelName.toLowerCase().includes(modelFilter.toLowerCase())
  );
  
  if (benchmarkTasks.length === 0) {
    console.log(`No benchmark tasks found matching "${modelFilter}"`);
    return 0;
  }
  
  console.log(`\n🔄 Resetting ${benchmarkTasks.length} tasks matching "${modelFilter}":`);
  
  const now = new Date();
  let delay = 30;
  
  for (const task of benchmarkTasks) {
    console.log(`   ${task.name} (${task.status})`);
    
    if (!dryRun) {
      task.status = 'pending';
      task.error = undefined;
      task.output = undefined;
      task.metrics = undefined;
      task.startedAt = undefined;
      task.completedAt = undefined;
      task.updatedAt = now.toISOString();
      task.scheduledAt = new Date(now.getTime() + delay * 1000).toISOString();
      delay += 300;
    }
  }
  
  if (!dryRun) {
    youtubeProject.updatedAt = now.toISOString();
    saveProjects(projectsData);
  }
  
  return benchmarkTasks.length;
}

// Cancel pending tasks
function cancelPendingTasks(projectsData, dryRun) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  const benchmarkTasks = youtubeProject.tasks.filter(t => 
    t.name && t.name.startsWith('Benchmark:') && t.status === 'pending'
  );
  
  if (benchmarkTasks.length === 0) {
    console.log('No pending benchmark tasks found.');
    return 0;
  }
  
  console.log(`\n🚫 Cancelling ${benchmarkTasks.length} pending tasks:`);
  
  for (const task of benchmarkTasks) {
    console.log(`   ${getShortName(task.modelName)}`);
    
    if (!dryRun) {
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
    }
  }
  
  if (!dryRun) {
    youtubeProject.updatedAt = new Date().toISOString();
    saveProjects(projectsData);
  }
  
  return benchmarkTasks.length;
}

// Delete tasks
function deleteTasks(projectsData, filter, dryRun) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  const originalCount = youtubeProject.tasks.length;
  
  let filterFn;
  let description;
  
  if (filter === 'all') {
    filterFn = t => t.name && t.name.startsWith('Benchmark:');
    description = 'all benchmark';
  } else if (filter === 'completed') {
    filterFn = t => t.name && t.name.startsWith('Benchmark:') && t.status === 'completed';
    description = 'completed benchmark';
  } else {
    filterFn = t => t.name && t.name.startsWith('Benchmark:') && 
      t.modelName && t.modelName.toLowerCase().includes(filter.toLowerCase());
    description = `benchmark tasks matching "${filter}"`;
  }
  
  const toDelete = youtubeProject.tasks.filter(filterFn);
  
  if (toDelete.length === 0) {
    console.log(`No ${description} tasks found.`);
    return 0;
  }
  
  console.log(`\n🗑️  Deleting ${toDelete.length} ${description} tasks:`);
  
  for (const task of toDelete) {
    console.log(`   ${task.name} (${task.status})`);
  }
  
  if (!dryRun) {
    youtubeProject.tasks = youtubeProject.tasks.filter(t => !filterFn(t));
    youtubeProject.updatedAt = new Date().toISOString();
    saveProjects(projectsData);
  }
  
  return toDelete.length;
}

// Main function
function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  const projectsData = loadProjects();
  const benchmarkTasks = getBenchmarkTasks(projectsData);
  
  console.log('\n🧹 Vision Model Benchmark - Cleanup Utility');
  console.log('============================================');
  
  if (args.dryRun) {
    console.log('⚠️  DRY RUN - No changes will be made\n');
  }
  
  // List tasks
  if (args.list || (!args.resetFailed && !args.reset && !args.delete && !args.deleteAll && !args.deleteCompleted && !args.cancelPending)) {
    listTasks(benchmarkTasks);
    return;
  }
  
  let count = 0;
  
  // Reset failed
  if (args.resetFailed) {
    count = resetFailedTasks(projectsData, args.dryRun);
  }
  
  // Reset specific model
  if (args.reset) {
    count = resetModelTasks(projectsData, args.reset, args.dryRun);
  }
  
  // Cancel pending
  if (args.cancelPending) {
    count = cancelPendingTasks(projectsData, args.dryRun);
  }
  
  // Delete specific model
  if (args.delete) {
    count = deleteTasks(projectsData, args.delete, args.dryRun);
  }
  
  // Delete completed
  if (args.deleteCompleted) {
    count = deleteTasks(projectsData, 'completed', args.dryRun);
  }
  
  // Delete all
  if (args.deleteAll) {
    count = deleteTasks(projectsData, 'all', args.dryRun);
  }
  
  console.log('\n============================================');
  if (args.dryRun) {
    console.log(`✅ Dry run complete. ${count} tasks would be affected.`);
  } else {
    console.log(`✅ Done. ${count} tasks affected.`);
  }
}

main();

