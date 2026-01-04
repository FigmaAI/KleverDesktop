/**
 * Vision Model Benchmark - Task Generator
 * 
 * Creates benchmark tasks in projects.json for testing vision models
 * with identical prompts to compare performance.
 * 
 * Usage:
 *   node scripts/benchmark-models.js --pilot              # 2 test tasks
 *   node scripts/benchmark-models.js --full               # 22 tasks (11 models x 2)
 *   node scripts/benchmark-models.js --pilot --dry-run    # Preview only
 *   node scripts/benchmark-models.js --full --interval 600  # 10 min interval
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const KLEVER_DIR = path.join(os.homedir(), '.klever-desktop');
const PROJECTS_PATH = path.join(KLEVER_DIR, 'projects.json');
const YOUTUBE_PROJECT_ID = 'proj_1766811180541';

// Benchmark Models (11 total)
const BENCHMARK_MODELS = [
  // OpenAI (OpenRouter)
  { id: 'openrouter/openai/gpt-5.2-pro', tier: 'high', provider: 'openrouter', vendor: 'OpenAI' },
  { id: 'openrouter/openai/gpt-5.2', tier: 'standard', provider: 'openrouter', vendor: 'OpenAI' },
  { id: 'openrouter/openai/gpt-4.1-mini', tier: 'efficient', provider: 'openrouter', vendor: 'OpenAI' },
  // Anthropic (OpenRouter)
  { id: 'openrouter/anthropic/claude-opus-4.5', tier: 'high', provider: 'openrouter', vendor: 'Anthropic' },
  { id: 'openrouter/anthropic/claude-sonnet-4.5', tier: 'standard', provider: 'openrouter', vendor: 'Anthropic' },
  { id: 'openrouter/anthropic/claude-haiku-4.5', tier: 'efficient', provider: 'openrouter', vendor: 'Anthropic' },
  // Google (OpenRouter)
  { id: 'openrouter/google/gemini-3-pro-preview', tier: 'high', provider: 'openrouter', vendor: 'Google' },
  { id: 'openrouter/google/gemini-2.5-pro', tier: 'standard', provider: 'openrouter', vendor: 'Google' },
  { id: 'openrouter/google/gemini-2.5-flash', tier: 'efficient', provider: 'openrouter', vendor: 'Google' },
  // xAI (Direct API)
  { id: 'xai/grok-4-1-fast', tier: 'high', provider: 'xai', vendor: 'xAI' },
  { id: 'xai/grok-4-1-fast-non-reasoning-latest', tier: 'standard', provider: 'xai', vendor: 'xAI' },
];

// Pilot models (cheap and fast for testing)
const PILOT_MODEL_IDS = [
  'openrouter/openai/gpt-4.1-mini',
  'openrouter/google/gemini-2.5-flash',
];

// Task configuration
const TASK_GOAL = 'Open Youtube app, search Mukbang videos, and play one YouTube clip';
const APK_SOURCE = {
  type: 'play_store_url',
  url: 'https://play.google.com/store/apps/details?id=com.google.android.youtube',
  packageName: 'com.google.android.youtube',
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    pilot: args.includes('--pilot'),
    full: args.includes('--full'),
    dryRun: args.includes('--dry-run'),
    interval: (() => {
      const idx = args.indexOf('--interval');
      return idx !== -1 && args[idx + 1] ? parseInt(args[idx + 1], 10) : 300;
    })(),
    runs: (() => {
      const idx = args.indexOf('--runs');
      return idx !== -1 && args[idx + 1] ? parseInt(args[idx + 1], 10) : 2;
    })(),
    help: args.includes('--help') || args.includes('-h'),
  };
}

// Show help
function showHelp() {
  console.log(`
Vision Model Benchmark - Task Generator

Usage:
  node scripts/benchmark-models.js [options]

Options:
  --pilot           Create pilot tasks (2 models, 1 run each)
  --full            Create full benchmark tasks (11 models x 2 runs)
  --dry-run         Preview tasks without creating them
  --interval <sec>  Interval between tasks in seconds (default: 300)
  --runs <n>        Number of runs per model for full test (default: 2)
  --help, -h        Show this help message

Examples:
  node scripts/benchmark-models.js --pilot              # Quick test
  node scripts/benchmark-models.js --pilot --dry-run    # Preview pilot
  node scripts/benchmark-models.js --full               # Full benchmark
  node scripts/benchmark-models.js --full --interval 600  # 10 min intervals
`);
}

// Get short model name for display
function getShortName(modelId) {
  const parts = modelId.split('/');
  return parts[parts.length - 1];
}

// Create a benchmark task
function createTask(model, runNumber, scheduledAt) {
  const now = new Date();
  const taskId = `task_benchmark_${Date.now()}_${runNumber}_${Math.random().toString(36).substr(2, 5)}`;
  
  return {
    id: taskId,
    projectId: YOUTUBE_PROJECT_ID,
    name: `Benchmark: ${getShortName(model.id)} #${runNumber}`,
    goal: TASK_GOAL,
    modelProvider: model.provider,
    modelName: model.id,
    status: 'pending',
    scheduledAt: scheduledAt.toISOString(),
    isScheduled: true,
    coldBoot: true, // Cold restart emulator for clean state (fair benchmarking)
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    apkSource: APK_SOURCE,
  };
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
  fs.writeFileSync(PROJECTS_PATH, JSON.stringify(data, null, 2));
}

// Main function
function main() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  if (!args.pilot && !args.full) {
    console.error('Error: Please specify --pilot or --full');
    showHelp();
    process.exit(1);
  }
  
  // Select models based on mode
  const models = args.pilot
    ? BENCHMARK_MODELS.filter(m => PILOT_MODEL_IDS.includes(m.id))
    : BENCHMARK_MODELS;
  
  const runs = args.pilot ? 1 : args.runs;
  const totalTasks = models.length * runs;
  
  console.log('\n🔬 Vision Model Benchmark Task Generator');
  console.log('==========================================');
  console.log(`Mode: ${args.pilot ? 'PILOT' : 'FULL'}`);
  console.log(`Models: ${models.length}`);
  console.log(`Runs per model: ${runs}`);
  console.log(`Total tasks: ${totalTasks}`);
  console.log(`Interval: ${args.interval} seconds (${(args.interval / 60).toFixed(1)} min)`);
  console.log(`Estimated duration: ${((totalTasks * args.interval) / 60).toFixed(0)} minutes`);
  console.log(`Dry run: ${args.dryRun ? 'YES' : 'NO'}`);
  console.log('');
  
  // Generate tasks
  const tasks = [];
  let scheduledAt = new Date();
  scheduledAt.setSeconds(scheduledAt.getSeconds() + 30); // Start in 30 seconds
  
  for (let run = 1; run <= runs; run++) {
    for (const model of models) {
      const task = createTask(model, run, scheduledAt);
      tasks.push(task);
      
      console.log(`  📋 ${task.name}`);
      console.log(`     Model: ${model.id}`);
      console.log(`     Scheduled: ${scheduledAt.toLocaleTimeString()}`);
      console.log('');
      
      // Next task scheduled after interval
      scheduledAt = new Date(scheduledAt.getTime() + args.interval * 1000);
    }
  }
  
  if (args.dryRun) {
    console.log('✅ Dry run complete. No tasks were created.');
    return;
  }
  
  // Load projects and add tasks
  const projectsData = loadProjects();
  const youtubeProject = projectsData.projects.find(p => p.id === YOUTUBE_PROJECT_ID);
  
  if (!youtubeProject) {
    console.error(`Error: Youtube project not found (${YOUTUBE_PROJECT_ID})`);
    process.exit(1);
  }
  
  // Add tasks to project
  youtubeProject.tasks.push(...tasks);
  youtubeProject.updatedAt = new Date().toISOString();
  
  // Save
  saveProjects(projectsData);
  
  console.log('==========================================');
  console.log(`✅ Created ${tasks.length} benchmark tasks!`);
  console.log(`📍 Project: ${youtubeProject.name}`);
  console.log(`⏰ First task starts at: ${tasks[0].scheduledAt}`);
  console.log(`⏰ Last task starts at: ${tasks[tasks.length - 1].scheduledAt}`);
  console.log('');
  console.log('💡 Tips:');
  console.log('   - Make sure Klever Desktop is running for scheduled execution');
  console.log('   - Check results: node scripts/benchmark-results.js');
  console.log('   - Reset failed: node scripts/benchmark-cleanup.js --reset-failed');
}

main();

