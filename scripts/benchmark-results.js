/**
 * Vision Model Benchmark - Results Analyzer
 * 
 * Analyzes completed benchmark tasks and generates reports.
 * 
 * Usage:
 *   node scripts/benchmark-results.js                     # Show summary
 *   node scripts/benchmark-results.js --export csv        # Export to CSV
 *   node scripts/benchmark-results.js --export json       # Export to JSON
 *   node scripts/benchmark-results.js --verbose           # Show detailed output
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const KLEVER_DIR = path.join(os.homedir(), '.klever-desktop');
const PROJECTS_PATH = path.join(KLEVER_DIR, 'projects.json');
const YOUTUBE_PROJECT_ID = 'proj_1766811180541';
const EXPORTS_DIR = path.join(__dirname, '..', 'docs', 'benchmark-results');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    export: (() => {
      const idx = args.indexOf('--export');
      return idx !== -1 && args[idx + 1] ? args[idx + 1].toLowerCase() : null;
    })(),
    verbose: args.includes('--verbose') || args.includes('-v'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Show help
function showHelp() {
  console.log(`
Vision Model Benchmark - Results Analyzer

Usage:
  node scripts/benchmark-results.js [options]

Options:
  --export <format>  Export results (csv, json)
  --verbose, -v      Show detailed output for each task
  --help, -h         Show this help message

Examples:
  node scripts/benchmark-results.js                     # Summary
  node scripts/benchmark-results.js --export csv        # Export CSV
  node scripts/benchmark-results.js --verbose           # Detailed view
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

// Get benchmark tasks
function getBenchmarkTasks(projectsData) {
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  if (!youtubeProject) {
    console.error(`Error: Youtube project not found`);
    process.exit(1);
  }
  
  // Filter benchmark tasks (tasks with "Benchmark:" in name)
  return youtubeProject.tasks.filter(t => t.name && t.name.startsWith('Benchmark:'));
}

// Get short model name
function getShortName(modelId) {
  if (!modelId) return 'unknown';
  const parts = modelId.split('/');
  return parts[parts.length - 1];
}

// Analyze results by model
function analyzeByModel(tasks) {
  const models = {};
  
  for (const task of tasks) {
    const modelId = task.modelName || 'unknown';
    if (!models[modelId]) {
      models[modelId] = {
        modelId,
        shortName: getShortName(modelId),
        provider: task.modelProvider || 'unknown',
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        running: 0,
        totalRounds: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCost: 0,
        totalDuration: 0,
        tasks: [],
      };
    }
    
    const m = models[modelId];
    m.total++;
    m.tasks.push(task);
    
    switch (task.status) {
      case 'completed':
        m.completed++;
        if (task.metrics) {
          m.totalRounds += task.metrics.rounds || 0;
          m.totalTokens += task.metrics.tokens || 0;
          m.totalInputTokens += task.metrics.inputTokens || 0;
          m.totalOutputTokens += task.metrics.outputTokens || 0;
          m.totalCost += task.metrics.estimatedCost || 0;
          m.totalDuration += task.metrics.durationMs || 0;
        }
        break;
      case 'failed':
        m.failed++;
        break;
      case 'pending':
        m.pending++;
        break;
      case 'running':
        m.running++;
        break;
    }
  }
  
  // Calculate averages
  for (const model of Object.values(models)) {
    if (model.completed > 0) {
      model.avgRounds = (model.totalRounds / model.completed).toFixed(1);
      model.avgTokens = Math.round(model.totalTokens / model.completed);
      model.avgCost = (model.totalCost / model.completed).toFixed(4);
      model.avgDuration = Math.round(model.totalDuration / model.completed / 1000); // seconds
      model.successRate = ((model.completed / model.total) * 100).toFixed(1);
    } else {
      model.avgRounds = '-';
      model.avgTokens = '-';
      model.avgCost = '-';
      model.avgDuration = '-';
      model.successRate = '0.0';
    }
  }
  
  return Object.values(models).sort((a, b) => {
    // Sort by success rate (desc), then by avg cost (asc)
    const rateA = parseFloat(a.successRate) || 0;
    const rateB = parseFloat(b.successRate) || 0;
    if (rateB !== rateA) return rateB - rateA;
    const costA = parseFloat(a.avgCost) || Infinity;
    const costB = parseFloat(b.avgCost) || Infinity;
    return costA - costB;
  });
}

// Print summary table
function printSummary(models, tasks) {
  console.log('\n📊 Vision Model Benchmark Results');
  console.log('=====================================\n');
  
  // Overall stats
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed = tasks.filter(t => t.status === 'failed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const running = tasks.filter(t => t.status === 'running').length;
  
  console.log('📈 Overall Status:');
  console.log(`   Total Tasks: ${tasks.length}`);
  console.log(`   ✅ Completed: ${completed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏳ Pending: ${pending}`);
  console.log(`   🔄 Running: ${running}`);
  console.log('');
  
  if (models.length === 0) {
    console.log('No benchmark tasks found.');
    return;
  }
  
  // Model comparison table
  console.log('📊 Model Comparison:');
  console.log('─'.repeat(100));
  console.log(
    'Model'.padEnd(35) +
    'Success'.padStart(8) +
    'Runs'.padStart(6) +
    'Rounds'.padStart(8) +
    'Tokens'.padStart(10) +
    'Cost($)'.padStart(10) +
    'Time(s)'.padStart(10)
  );
  console.log('─'.repeat(100));
  
  for (const m of models) {
    const status = m.failed > 0 ? '⚠️' : m.completed > 0 ? '✅' : '⏳';
    console.log(
      `${status} ${m.shortName}`.padEnd(35) +
      `${m.successRate}%`.padStart(8) +
      `${m.completed}/${m.total}`.padStart(6) +
      `${m.avgRounds}`.padStart(8) +
      `${m.avgTokens}`.padStart(10) +
      `${m.avgCost}`.padStart(10) +
      `${m.avgDuration}`.padStart(10)
    );
  }
  console.log('─'.repeat(100));
  
  // Best performers
  const completedModels = models.filter(m => m.completed > 0);
  if (completedModels.length > 0) {
    console.log('\n🏆 Best Performers:');
    
    // Best success rate
    const bestSuccess = completedModels.reduce((a, b) => 
      parseFloat(a.successRate) > parseFloat(b.successRate) ? a : b
    );
    console.log(`   🎯 Highest Success Rate: ${bestSuccess.shortName} (${bestSuccess.successRate}%)`);
    
    // Fewest rounds
    const fewestRounds = completedModels.reduce((a, b) => 
      parseFloat(a.avgRounds) < parseFloat(b.avgRounds) ? a : b
    );
    console.log(`   ⚡ Fewest Rounds: ${fewestRounds.shortName} (${fewestRounds.avgRounds} avg)`);
    
    // Lowest cost
    const lowestCost = completedModels.reduce((a, b) => 
      parseFloat(a.avgCost) < parseFloat(b.avgCost) ? a : b
    );
    console.log(`   💰 Lowest Cost: ${lowestCost.shortName} ($${lowestCost.avgCost} avg)`);
    
    // Fastest
    const fastest = completedModels.reduce((a, b) => 
      parseFloat(a.avgDuration) < parseFloat(b.avgDuration) ? a : b
    );
    console.log(`   🚀 Fastest: ${fastest.shortName} (${fastest.avgDuration}s avg)`);
  }
  
  console.log('');
}

// Print verbose details
function printVerbose(tasks) {
  console.log('\n📝 Task Details:');
  console.log('─'.repeat(80));
  
  for (const task of tasks) {
    const status = {
      'completed': '✅',
      'failed': '❌',
      'pending': '⏳',
      'running': '🔄',
    }[task.status] || '❓';
    
    console.log(`\n${status} ${task.name}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Model: ${task.modelName}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Scheduled: ${task.scheduledAt || '-'}`);
    
    if (task.metrics) {
      console.log(`   Metrics:`);
      console.log(`     Rounds: ${task.metrics.rounds || '-'}`);
      console.log(`     Tokens: ${task.metrics.tokens || '-'}`);
      console.log(`     Cost: $${task.metrics.estimatedCost?.toFixed(4) || '-'}`);
      console.log(`     Duration: ${task.metrics.durationMs ? (task.metrics.durationMs / 1000).toFixed(1) + 's' : '-'}`);
    }
    
    if (task.error) {
      console.log(`   Error: ${task.error}`);
    }
  }
  console.log('');
}

// Export to CSV
function exportCSV(models, tasks) {
  // Ensure exports directory exists
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Summary CSV
  const summaryPath = path.join(EXPORTS_DIR, `benchmark-summary-${timestamp}.csv`);
  const summaryHeaders = 'Model,Provider,Success Rate,Total,Completed,Failed,Avg Rounds,Avg Tokens,Avg Cost,Avg Duration';
  const summaryRows = models.map(m => 
    `"${m.shortName}","${m.provider}",${m.successRate},${m.total},${m.completed},${m.failed},${m.avgRounds},${m.avgTokens},${m.avgCost},${m.avgDuration}`
  );
  fs.writeFileSync(summaryPath, [summaryHeaders, ...summaryRows].join('\n'));
  
  // Tasks CSV
  const tasksPath = path.join(EXPORTS_DIR, `benchmark-tasks-${timestamp}.csv`);
  const tasksHeaders = 'Task ID,Model,Status,Rounds,Tokens,Cost,Duration(ms),Scheduled At,Completed At,Error';
  const tasksRows = tasks.map(t => {
    const m = t.metrics || {};
    return `"${t.id}","${t.modelName || ''}","${t.status}",${m.rounds || ''},${m.tokens || ''},${m.estimatedCost || ''},${m.durationMs || ''},"${t.scheduledAt || ''}","${t.completedAt || ''}","${(t.error || '').replace(/"/g, '""')}"`;
  });
  fs.writeFileSync(tasksPath, [tasksHeaders, ...tasksRows].join('\n'));
  
  console.log(`\n📁 Exported to CSV:`);
  console.log(`   Summary: ${summaryPath}`);
  console.log(`   Tasks: ${tasksPath}`);
}

// Export to JSON
function exportJSON(models, tasks) {
  // Ensure exports directory exists
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const exportPath = path.join(EXPORTS_DIR, `benchmark-results-${timestamp}.json`);
  
  const data = {
    exportedAt: new Date().toISOString(),
    summary: {
      totalTasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      pending: tasks.filter(t => t.status === 'pending').length,
    },
    models: models.map(m => ({
      modelId: m.modelId,
      shortName: m.shortName,
      provider: m.provider,
      successRate: parseFloat(m.successRate),
      total: m.total,
      completed: m.completed,
      failed: m.failed,
      avgRounds: m.avgRounds === '-' ? null : parseFloat(m.avgRounds),
      avgTokens: m.avgTokens === '-' ? null : m.avgTokens,
      avgCost: m.avgCost === '-' ? null : parseFloat(m.avgCost),
      avgDuration: m.avgDuration === '-' ? null : m.avgDuration,
    })),
    tasks: tasks.map(t => ({
      id: t.id,
      name: t.name,
      modelName: t.modelName,
      status: t.status,
      metrics: t.metrics || null,
      scheduledAt: t.scheduledAt,
      completedAt: t.completedAt,
      error: t.error,
    })),
  };
  
  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
  
  console.log(`\n📁 Exported to JSON:`);
  console.log(`   ${exportPath}`);
}

// Main function
function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  const projectsData = loadProjects();
  const tasks = getBenchmarkTasks(projectsData);
  const models = analyzeByModel(tasks);
  
  printSummary(models, tasks);
  
  if (args.verbose) {
    printVerbose(tasks);
  }
  
  if (args.export === 'csv') {
    exportCSV(models, tasks);
  } else if (args.export === 'json') {
    exportJSON(models, tasks);
  }
}

main();

