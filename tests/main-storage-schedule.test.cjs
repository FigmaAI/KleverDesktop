const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const clone = value => structuredClone(value);
const runRecords = { persistRunRecord: () => {}, readRunManifest: () => ({ run: {} }), collectRunRecording: () => undefined };

function project(tasks = [], extra = {}) {
  return { id: 'native', name: 'Native App', platform: 'android', status: 'active', workspaceDir: '/tmp/native', tasks, ...extra };
}
function task(id, extra = {}) {
  return { id, projectId: 'native', name: id, goal: 'Verify login', status: 'pending', scheduledAt: '2000-01-01T00:00:00.000Z', ...extra };
}
function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-storage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('config migration strips every provider credential and removed option while retaining native preferences', () => {
  const { normalizeAppConfig } = load('main/types/config.ts');
  const inputs = [
    { model: { enableLocal: true, enableApi: true, api: { key: 'old-secret' }, local: { model: 'local' } } },
    { model: { provider: 'openrouter', apiKey: 'old-secret', model: 'old-model' } },
    { model: { providers: [{ id: 'ollama' }, { id: 'openai', apiKey: 'old-secret' }], lastUsed: { provider: 'openai', model: 'old-model' } } },
  ];
  for (const input of inputs) {
    const migrated = normalizeAppConfig({ ...input, web: { headless: true }, googleLogin: { web: { profilePath: '/old' } },
      execution: { maxRounds: 12, maxTokens: 9999 }, android: { sdkPath: '/my/sdk' }, preferences: { systemLanguage: 'ko', darkMode: true } });
    assert.deepEqual(plain(migrated), { version: '4.0', execution: { maxRounds: 12 }, android: { sdkPath: '/my/sdk' }, preferences: { systemLanguage: 'ko', darkMode: true } });
    assert.equal(JSON.stringify(migrated).includes('old-secret'), false);
    assert.deepEqual(plain(normalizeAppConfig(migrated)), plain(migrated));
  }
  assert.equal(normalizeAppConfig({ execution: { maxRounds: -1 } }).execution.maxRounds, 20);
});

test('config storage persists sanitized migration and prevents removed credentials returning on save', t => {
  const dir = tempDir(t);
  const types = load('main/types/config.ts');
  const storage = load('main/utils/config-storage.ts', { '../types/config': types, './app-paths': { getKleverDir: () => dir } });
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify({ model: { apiKey: 'old-secret' }, preferences: { systemLanguage: 'ko' } }));
  const current = storage.loadAppConfig();
  assert.equal(current.preferences.systemLanguage, 'ko');
  assert.equal(fs.readFileSync(file, 'utf8').includes('old-secret'), false);
  storage.saveAppConfig({ ...current, model: { apiKey: 'injected-secret' }, web: {} });
  assert.equal(fs.readFileSync(file, 'utf8').includes('injected-secret'), false);
});

test('retired browser records and result paths stay recoverable without entering active native projects', t => {
  const dir = tempDir(t);
  const storage = load('main/utils/project-storage.ts', { './app-paths': { getKleverDir: () => dir }, './run-records': runRecords });
  const result = path.join(dir, 'old-result');
  fs.mkdirSync(result);
  fs.writeFileSync(path.join(result, 'report.md'), 'historical report');
  const oldWeb = project([task('completed', { status: 'completed', resultPath: result, output: 'saved output' }), task('due')], { id: 'web', platform: 'web' });
  const native = project([task('native-task', { modelName: 'old-model', modelProvider: 'old-provider', metrics: { rounds: 3, estimatedCost: 3, isLocalModel: true } })]);
  const migrated = storage.normalizeProjectsData({ projects: [native, oldWeb] });
  assert.equal(migrated.projects.length, 1);
  assert.equal(migrated.projects[0].platform, 'android');
  assert.equal(migrated.projects[0].tasks[0].modelName, undefined);
  assert.deepEqual(plain(migrated.projects[0].tasks[0].metrics), { rounds: 3 });
  assert.equal(migrated.legacyProjects[0].tasks[0].resultPath, result);
  assert.equal(migrated.legacyProjects[0].tasks[0].output, 'saved output');
  assert.equal(migrated.legacyProjects[0].tasks[1].status, 'cancelled');
  assert.deepEqual(plain(storage.normalizeProjectsData(migrated)), plain(migrated));
  storage.saveProjects(migrated);
  assert.deepEqual(plain(storage.loadProjects()), plain(migrated));
  assert.equal(fs.readFileSync(path.join(result, 'report.md'), 'utf8'), 'historical report');
  fs.writeFileSync(storage.getProjectsStoragePath(), '{broken');
  assert.throws(() => storage.loadProjects());
  assert.equal(fs.readFileSync(storage.getProjectsStoragePath(), 'utf8'), '{broken');
});

function schedulerFixture(initial, startTaskExecution, active = () => false) {
  let data = clone(initial);
  let interval;
  const { ScheduleQueueManager } = load('main/utils/schedule-queue-manager.ts', {
    electron: {}, './project-storage': { loadProjects: () => clone(data), saveProjects: next => { data = clone(next); } },
    './run-records': runRecords,
    '../handlers/task': { startTaskExecution: (...args) => startTaskExecution(...args, () => data), isTaskExecutionActive: active },
  }, { setInterval: callback => { interval = callback; return 1; }, clearInterval: () => {} });
  const manager = new ScheduleQueueManager();
  return { manager, get: () => data, initialize: () => manager.initialize(() => null), poll: () => interval() };
}

test('scheduled failure is recorded and the next native task executes with no renderer window', async () => {
  const calls = [];
  const f = schedulerFixture({ projects: [project([task('first'), task('second')])], legacyProjects: [{ platform: 'web', tasks: [task('legacy')] }] },
    async (projectId, taskId, getWindow, getData) => {
      assert.equal(getWindow(), null);
      calls.push(taskId);
      if (taskId === 'first') return { success: false, error: 'Sign in first' };
      getData().projects[0].tasks.find(task => task.id === taskId).status = 'running';
      return { success: true };
    });
  f.initialize();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.get().projects[0].tasks[0].status, 'failed');
  assert.equal(f.get().projects[0].tasks[0].error, 'Sign in first');
  f.poll();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(f.get().projects[0].tasks[1].status, 'running');
  f.manager.shutdown();
});

test('scheduler respects native execution ownership, archived projects, and terminal task recordings', async () => {
  let active = true;
  const calls = [];
  const f = schedulerFixture({ projects: [project([task('due')]), project([task('archived')], { id: 'archive', status: 'archived' })] },
    async (_projectId, taskId) => { calls.push(taskId); return { success: true }; }, () => active);
  f.initialize();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, []);
  active = false;
  f.poll();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['due']);
  assert.equal(f.manager.scheduleTask('native', 'due', 'bad-date').success, false);
  const source = f.get().projects[0].tasks[0];
  source.status = 'completed';
  assert.equal(f.manager.scheduleTask('native', 'due', new Date().toISOString()).success, false);
  assert.equal(f.manager.cancelSchedule('native', 'due').success, false);
  assert.equal(source.status, 'completed');
  f.manager.shutdown();
});

test('manual starts reserve ownership before the direct agent settles and cancellation waits for settlement', async t => {
  const dir = tempDir(t);
  let data = { projects: [project([task('one', { scheduledAt: undefined }), task('two', { scheduledAt: undefined })], { workspaceDir: dir })] };
  let completeJob;
  let jobOptions;
  const job = new Promise(resolve => { completeJob = resolve; });
  const taskModule = load('main/handlers/task.ts', {
    electron: {},
    '../utils/project-storage': { loadProjects: () => clone(data), saveProjects: next => { data = clone(next); }, sanitizeAppName: name => name.replace(/ /g, '') },
    '../utils/config-storage': { loadAppConfig: () => ({ execution: { maxRounds: 20 } }) },
    '../utils/native-source': { validateApkSource: () => undefined },
    '../utils/testcase-storage': {}, '../utils/run-records': runRecords,
    '../utils/android-agent': { startAndroidTest: options => { jobOptions = options; return job; } },
    '../utils/schedule-queue-manager': { scheduleQueueManager: { triggerCheck: () => {} } },
  });
  const handlers = {};
  taskModule.registerTaskHandlers({ handle: (name, action) => { handlers[name] = action; } }, () => null);
  assert.equal((await taskModule.startTaskExecution('native', 'one', () => null)).success, true);
  assert.equal(data.projects[0].tasks[0].status, 'running');
  assert.equal(taskModule.isTaskExecutionActive(), true);
  assert.equal((await taskModule.startTaskExecution('native', 'two', () => null)).success, false);
  assert.equal(jobOptions.maxSteps, 20);
  jobOptions.onProgress({ rounds: 2, tokens: 120 });
  assert.equal(data.projects[0].tasks[0].metrics.rounds, 2);
  assert.equal(handlers['task:stop'](null, 'native', 'one').success, true);
  assert.equal(jobOptions.signal.aborted, true);
  assert.equal(data.projects[0].tasks[0].status, 'cancelled');
  assert.equal(taskModule.isTaskExecutionActive(), true);
  assert.equal((await taskModule.startTaskExecution('native', 'two', () => null)).success, false);
  completeJob({ status: 'cancelled' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(taskModule.isTaskExecutionActive(), false);
  assert.equal(data.projects[0].tasks[0].status, 'cancelled');
});

test('a rejected aborted agent job releases ownership and retains cancelled status', async t => {
  const dir = tempDir(t);
  let data = { projects: [project([task('one', { scheduledAt: undefined })], { workspaceDir: dir })] };
  let rejectJob;
  const job = new Promise((_resolve, reject) => { rejectJob = reject; });
  const taskModule = load('main/handlers/task.ts', {
    electron: {},
    '../utils/project-storage': { loadProjects: () => clone(data), saveProjects: next => { data = clone(next); }, sanitizeAppName: name => name },
    '../utils/config-storage': { loadAppConfig: () => ({ execution: { maxRounds: 20 } }) },
    '../utils/native-source': { validateApkSource: () => undefined }, '../utils/testcase-storage': {}, '../utils/run-records': runRecords,
    '../utils/android-agent': { startAndroidTest: () => job },
    '../utils/schedule-queue-manager': { scheduleQueueManager: { triggerCheck: () => {} } },
  });
  const handlers = {};
  taskModule.registerTaskHandlers({ handle: (name, action) => { handlers[name] = action; } }, () => null);
  await taskModule.startTaskExecution('native', 'one', () => null);
  handlers['task:stop'](null, 'native', 'one');
  assert.equal(taskModule.isTaskExecutionActive(), true);
  rejectJob(new Error('Operation aborted'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(taskModule.isTaskExecutionActive(), false);
  assert.equal(data.projects[0].tasks[0].status, 'cancelled');
});
