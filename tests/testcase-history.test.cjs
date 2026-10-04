const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const clone = value => structuredClone(value);
const source = { type: 'installed_package', packageName: 'com.example.app' };
const nativeSource = load('main/utils/native-source.ts');
const cases = load('main/utils/testcase-storage.ts', { './native-source': nativeSource });
function project() {
  return { id: 'proj-one', name: 'Example', platform: 'android', status: 'active', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', tasks: [], testCases: [], workspaceDir: '/unused' };
}
function course(p, goal = 'Verify login') {
  return cases.createTestCase(p, { projectId: p.id, name: 'Login course', goal, apkSource: source });
}
function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-courses-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function storageFixture(t) {
  const dir = temp(t);
  const runtime = { getKleverDir: () => dir };
  const records = load('main/utils/run-records.ts', { './app-paths': runtime });
  const storage = load('main/utils/project-storage.ts', { './app-paths': runtime, './run-records': records });
  return { dir, records, storage };
}

test('case revisions affect future runs while queued and completed run snapshots stay unchanged', () => {
  const p = project();
  const saved = course(p);
  const first = cases.createTestRun(p, saved.id, { buildLabel: 'Version 1', scheduledAt: '2030-01-01T00:00:00Z' });
  const snapshot = plain(first.caseSnapshot);
  cases.updateTestCase(p, saved.id, { goal: 'Verify login and logout', name: 'Account course' });
  assert.equal(saved.revision, 2);
  assert.deepEqual(plain(first.caseSnapshot), snapshot);
  assert.equal(first.goal, 'Verify login');
  assert.equal(first.buildLabel, 'Version 1');
  const second = cases.createTestRun(p, saved.id, { buildLabel: 'Version 2' });
  assert.equal(second.caseSnapshot.revision, 2);
  assert.equal(second.goal, 'Verify login and logout');
  assert.notEqual(first.id, second.id);
  cases.updateTestCase(p, saved.id, { goal: 'Verify login and logout' });
  assert.equal(saved.revision, 2, 'unchanged definitions do not create fake revisions');
  saved.apkSource.packageName = 'com.changed.app';
  assert.equal(first.apkSource.packageName, 'com.example.app');
  assert.equal(first.caseSnapshot.apkSource.packageName, 'com.example.app');
});

test('reference selection defaults to latest successful same-goal run and rejects another course', () => {
  const p = project();
  const saved = course(p);
  const first = cases.createTestRun(p, saved.id);
  first.status = 'completed'; first.completedAt = '2025-01-01T00:00:00Z';
  const second = cases.createTestRun(p, saved.id);
  second.status = 'completed'; second.completedAt = '2025-02-01T00:00:00Z';
  const failed = cases.createTestRun(p, saved.id);
  failed.status = 'failed'; failed.completedAt = '2025-03-01T00:00:00Z';
  assert.equal(cases.createTestRun(p, saved.id).referenceRunId, second.id);
  cases.updateTestCase(p, saved.id, { goal: 'Verify password reset' });
  assert.equal(cases.createTestRun(p, saved.id).referenceRunId, undefined);
  assert.equal(cases.createTestRun(p, saved.id, { referenceRunId: first.id }).referenceRunId, first.id);
  const different = course(p, 'Different goal');
  assert.throws(() => cases.createTestRun(p, different.id, { referenceRunId: first.id }), /completed run of this test course/);
  assert.throws(() => cases.createTestRun(p, saved.id, { referenceRunId: failed.id }), /completed run/);
});

test('per-run source override records the tested build without changing the saved course', () => {
  const p = project(); const saved = course(p);
  const apk = { type: 'installed_package', packageName: 'com.example.beta' };
  const run = cases.createTestRun(p, saved.id, { apkSource: apk, buildLabel: 'Beta 3' });
  assert.equal(saved.apkSource.packageName, 'com.example.app');
  assert.equal(run.caseSnapshot.apkSource.packageName, 'com.example.app');
  assert.equal(run.apkSource.packageName, 'com.example.beta');
  assert.equal(run.buildLabel, 'Beta 3');
});

test('legacy migration creates separate deterministic courses and preserves all existing run results', t => {
  const f = storageFixture(t);
  const p = project(); delete p.testCases;
  p.tasks = [
    { id: 'task-old-1', projectId: p.id, name: 'Same name', goal: 'Same goal', status: 'completed', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', output: 'saved full output', resultPath: path.join(f.dir, 'legacy-output'), modelName: 'historic-model', metrics: { rounds: 3, estimatedCost: 0.01 } },
    { id: 'task-old-2', projectId: p.id, name: 'Same name', goal: 'Same goal', status: 'failed', createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-02T00:00:00Z', error: 'old failure' },
  ];
  fs.mkdirSync(p.tasks[0].resultPath); fs.writeFileSync(path.join(p.tasks[0].resultPath, 'report.md'), 'old report');
  f.storage.saveProjects({ projects: [p] });
  const migrated = f.storage.loadProjects();
  const a = migrated.projects[0];
  assert.equal(a.testCases.length, 2);
  assert.equal(a.testCases[0].id, 'case_task-old-1');
  assert.equal(a.testCases[1].id, 'case_task-old-2');
  assert.equal(a.tasks[0].id, 'task-old-1');
  assert.equal(a.tasks[0].status, 'completed');
  assert.equal(a.tasks[0].output, 'saved full output');
  assert.equal(a.tasks[0].legacyMetadata.modelName, 'historic-model');
  assert.equal(a.tasks[0].legacyMetadata.metrics.estimatedCost, 0.01);
  assert.equal(a.tasks[1].error, 'old failure');
  assert.equal(a.tasks[0].app, undefined);
  assert.equal(a.tasks[0].device, undefined);
  assert.equal(fs.readFileSync(path.join(a.tasks[0].resultPath, 'report.md'), 'utf8'), 'old report');
  const manifest = f.records.readRunManifest('task-old-1');
  assert.equal(manifest.run.status, 'completed');
  assert.ok(manifest.finalizedAt);
  const before = fs.readFileSync(a.tasks[0].manifestPath, 'utf8');
  assert.deepEqual(plain(f.storage.loadProjects()), plain(migrated));
  assert.equal(fs.readFileSync(a.tasks[0].manifestPath, 'utf8'), before);
});

test('startup recovers an interrupted recording without inventing a successful result', t => {
  const f = storageFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const run = cases.createTestRun(p, saved.id);
  run.status = 'running'; run.startedAt = '2025-01-01T00:00:00Z'; run.resultPath = path.join(f.dir, 'evidence');
  fs.mkdirSync(run.resultPath);
  fs.writeFileSync(path.join(run.resultPath, 'recording.json'), JSON.stringify({ schemaVersion: 1, runId: run.id, testCaseId: saved.id, testCaseRevision: 1, goal: run.goal, status: 'running', startedAt: run.startedAt, context: { app: { packageName: 'com.example.app', versionName: '2.0' }, device: { serial: 'test-device' } }, steps: [] }));
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  f.storage.cleanupZombieTasks();
  const recovered = f.storage.loadProjects().projects[0].tasks[0];
  assert.equal(recovered.status, 'failed');
  assert.match(recovered.error, /interrupted/);
  assert.equal(recovered.finalVerification, undefined);
  assert.equal(recovered.app.versionName, '2.0');
  assert.equal(recovered.device.serial, 'test-device');
  assert.ok(f.records.readRunManifest(run.id).finalizedAt);
});

test('canonical finalized run repairs a stale index without changing its snapshot', t => {
  const f = storageFixture(t); const p = project(); const saved = course(p);
  const run = cases.createTestRun(p, saved.id); run.status = 'completed'; run.completedAt = '2025-01-01T00:00:00Z';
  f.records.persistRunRecord(p, run); const frozen = plain(run);
  f.storage.saveProjects({ projects: [p] });
  const stale = clone(p); stale.tasks[0].status = 'running'; stale.tasks[0].goal = 'later case edit';
  f.storage.saveProjects({ projects: [stale] });
  f.storage.cleanupZombieTasks();
  assert.deepEqual(plain(f.storage.loadProjects().projects[0].tasks[0]), frozen);
  assert.equal(f.records.readRunManifest(run.id).run.goal, 'Verify login');
});

function runtimeFixture(t) {
  const f = storageFixture(t);
  const jobs = [];
  const events = [];
  const taskModule = load('main/handlers/task.ts', {
    electron: {}, '../utils/project-storage': f.storage,
    '../utils/config-storage': { loadAppConfig: () => ({ execution: { maxRounds: 20 } }) },
    '../utils/native-source': nativeSource, '../utils/testcase-storage': cases, '../utils/run-records': f.records,
    '../utils/android-agent': { startAndroidTest: options => new Promise((resolve, reject) => { jobs.push({ options, resolve, reject }); }) },
    '../utils/schedule-queue-manager': { scheduleQueueManager: { triggerCheck: () => {} } },
  });
  const handlers = {};
  const window = { isDestroyed: () => false, webContents: { send: (channel, payload) => events.push({ channel, payload }) } };
  taskModule.registerTaskHandlers({ handle: (name, action) => { handlers[name] = action; } }, () => window);
  return { ...f, taskModule, handlers, jobs, events, getWindow: () => window };
}

function writeRecording(run, status = 'cancelled', version = '2.0') {
  fs.writeFileSync(path.join(run.resultPath, 'recording.json'), JSON.stringify({ schemaVersion: 1,
    runId: run.id, testCaseId: run.testCaseId, testCaseRevision: run.caseRevision,
    goal: run.goal, startedAt: run.startedAt, finishedAt: new Date().toISOString(), status,
    context: { app: { packageName: 'com.example.app', versionName: version, versionCode: '20' }, device: { serial: 'device-one', model: 'Test device', apiLevel: '35' } },
    steps: [{ index: 1, round: 1, startedAt: run.startedAt, action: { type: 'tap', intent: 'Open account' }, observationBefore: 'Home', result: status === 'completed' ? 'executed' : 'failed', evidence: { before: '' } }],
    finalVerification: { source: 'agent_visual', goal: run.goal, outcome: status === 'completed' ? 'passed' : 'unverified', detail: status === 'completed' ? 'The goal is visible.' : 'The command was interrupted.' },
  }));
}

test('native runtime records case identity and collects cancelled evidence only after the agent job settles', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const run = cases.createTestRun(p, saved.id, { buildLabel: 'Version 2', deviceSerial: 'device-one' });
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  const started = await f.taskModule.startTaskExecution(p.id, run.id, f.getWindow);
  assert.equal(started.success, true);
  const options = f.jobs[0].options;
  assert.equal(options.testCaseId, saved.id); assert.equal(options.testCaseRevision, 1); assert.equal(options.taskId, run.id);
  assert.equal(options.deviceSerial, 'device-one'); assert.equal(options.apkSource.packageName, 'com.example.app');
  assert.equal(f.storage.loadProjects().projects[0].tasks[0].deviceSerial, 'device-one');
  const current = f.storage.loadProjects().projects[0].tasks[0];
  writeRecording(current, 'running', '1.9');
  assert.equal(f.handlers['task:stop'](null, p.id, run.id).success, true);
  const provisional = f.records.readRunManifest(run.id);
  assert.equal(provisional.run.status, 'cancelled'); assert.equal(provisional.finalizedAt, undefined);
  assert.equal(provisional.run.app, undefined, 'cancellation must not collect a still-changing recording');
  writeRecording(current, 'cancelled', '2.0');
  assert.equal(f.jobs[0].options.signal.aborted, true);
  f.jobs[0].resolve(JSON.parse(fs.readFileSync(path.join(current.resultPath, 'recording.json'), 'utf8')));
  await new Promise(resolve => setImmediate(resolve));
  const final = f.records.readRunManifest(run.id);
  assert.ok(final.finalizedAt); assert.equal(final.run.app.versionName, '2.0');
  assert.equal(final.run.device.serial, 'device-one'); assert.equal(final.run.finalVerification.outcome, 'unverified');
  assert.equal(final.run.buildLabel, 'Version 2'); assert.equal(final.run.status, 'cancelled');
  assert.equal(f.taskModule.isTaskExecutionActive(), false);
  assert.ok(f.events.some(event => event.channel === 'task:started'));
  assert.ok(f.events.some(event => event.channel === 'task:recorded'));
  const read = f.handlers['task:recording:get'](null, p.id, run.id);
  assert.equal(read.success, true); assert.equal(read.recording.steps.length, 1);
  assert.equal(f.handlers['task:recording:get'](null, 'other-project', run.id).success, false);
  assert.equal(f.handlers['task:update'], undefined, 'run snapshots expose no editing endpoint');
  assert.equal(f.handlers['task:delete'](null, p.id, run.id).success, true);
  assert.equal(f.records.readRunManifest(run.id), undefined);
  assert.equal(fs.existsSync(current.resultPath), false);
});

test('new run reuses a validated prior recording of the same case without overwriting it', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const prior = cases.createTestRun(p, saved.id);
  prior.status = 'completed'; prior.startedAt = '2025-01-01T00:00:00Z'; prior.completedAt = '2025-01-01T00:01:00Z'; prior.resultPath = path.join(f.dir, 'prior');
  fs.mkdirSync(prior.resultPath); writeRecording(prior, 'completed', '1.0');
  f.records.collectRunRecording(prior); f.records.persistRunRecord(p, prior);
  const priorBefore = fs.readFileSync(prior.manifestPath, 'utf8');
  const run = cases.createTestRun(p, saved.id, { buildLabel: 'Version 2' });
  assert.equal(run.referenceRunId, prior.id);
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  assert.equal((await f.taskModule.startTaskExecution(p.id, run.id, f.getWindow)).success, true);
  const options = f.jobs[0].options;
  assert.equal(options.referenceRecording.runId, prior.id);
  assert.notEqual(options.resultPath, prior.resultPath);
  const current = f.storage.loadProjects().projects[0].tasks.find(item => item.id === run.id);
  writeRecording(current, 'completed', '2.0');
  f.jobs[0].resolve(JSON.parse(fs.readFileSync(path.join(current.resultPath, 'recording.json'), 'utf8')));
  await new Promise(resolve => setImmediate(resolve));
  const final = f.records.readRunManifest(run.id);
  assert.equal(final.run.status, 'completed'); assert.equal(final.run.finalVerification.outcome, 'passed');
  assert.equal(final.run.app.versionName, '2.0');
  assert.equal(fs.readFileSync(prior.manifestPath, 'utf8'), priorBefore);
});

test('shutdown waits for an aborted owned agent job before sealing its cancelled run', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const run = cases.createTestRun(p, saved.id);
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  await f.taskModule.startTaskExecution(p.id, run.id, f.getWindow);
  const current = f.storage.loadProjects().projects[0].tasks[0];
  const shutdown = f.taskModule.cleanupTaskProcesses();
  assert.equal(f.records.readRunManifest(run.id).finalizedAt, undefined);
  assert.equal(f.taskModule.isTaskExecutionActive(), true);
  writeRecording(current, 'cancelled', '2.1');
  assert.equal(f.jobs[0].options.signal.aborted, true);
  f.jobs[0].resolve(JSON.parse(fs.readFileSync(path.join(current.resultPath, 'recording.json'), 'utf8')));
  await shutdown;
  const final = f.records.readRunManifest(run.id);
  assert.ok(final.finalizedAt); assert.equal(final.run.app.versionName, '2.1');
  assert.equal(final.run.status, 'cancelled'); assert.equal(f.taskModule.isTaskExecutionActive(), false);
});

test('test course IPC creates revisioned definitions, independent queued runs, and preserves history on archive', t => {
  const f = storageFixture(t); const p = project(); f.storage.saveProjects({ projects: [p] });
  let checks = 0; const handlers = {};
  const { registerTestCaseHandlers } = load('main/handlers/testcase.ts', {
    '../utils/project-storage': f.storage, '../utils/testcase-storage': cases, '../utils/run-records': f.records,
    '../utils/schedule-queue-manager': { scheduleQueueManager: { triggerCheck: () => { checks++; } } },
  });
  registerTestCaseHandlers({ handle: (name, action) => { handlers[name] = action; } });
  const saved = handlers['testcase:create'](null, { projectId: p.id, name: 'Login', goal: 'Verify login', apkSource: source });
  assert.equal(saved.success, true);
  const queued = handlers['testcase:run'](null, p.id, saved.testCase.id, { scheduledAt: '2030-01-01T00:00:00Z', deviceSerial: 'emulator-5554', buildLabel: 'Version 1' });
  assert.equal(queued.success, true); assert.equal(queued.task.status, 'pending'); assert.equal(checks, 1);
  assert.equal(f.records.readRunManifest(queued.task.id).run.deviceSerial, 'emulator-5554');
  const edited = handlers['testcase:update'](null, p.id, saved.testCase.id, { goal: 'Verify login and logout' });
  assert.equal(edited.testCase.revision, 2);
  assert.equal(f.storage.loadProjects().projects[0].tasks[0].goal, 'Verify login');
  assert.equal(handlers['testcase:archive'](null, p.id, saved.testCase.id).success, true);
  const archived = f.storage.loadProjects().projects[0];
  assert.equal(archived.testCases[0].archived, true);
  assert.equal(archived.tasks[0].status, 'pending'); assert.equal(archived.tasks[0].scheduledAt, '2030-01-01T00:00:00.000Z');
  assert.equal(handlers['testcase:run'](null, p.id, saved.testCase.id).success, false);
  assert.equal(handlers['testcase:update'](null, p.id, saved.testCase.id, { goal: 'overwrite archived' }).success, false);
});

test('legacy task creation adapter saves a new course for every request instead of merging matching names', t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir; f.storage.saveProjects({ projects: [p] });
  const input = { projectId: p.id, name: 'Same course name', goal: 'Verify login', apkSource: source, buildLabel: 'V1', deviceSerial: 'device-one' };
  const first = f.handlers['task:create'](null, input); const second = f.handlers['task:create'](null, input);
  assert.equal(first.success, true); assert.equal(second.success, true);
  assert.notEqual(first.task.testCaseId, second.task.testCaseId);
  assert.equal(first.task.deviceSerial, 'device-one'); assert.equal(first.task.buildLabel, 'V1');
  const stored = f.storage.loadProjects().projects[0];
  assert.equal(stored.testCases.length, 2); assert.equal(stored.tasks.length, 2);
  assert.ok(f.records.readRunManifest(first.task.id));
  assert.throws(() => cases.createTestRun(stored, first.task.testCaseId, { deviceSerial: 'device; malicious' }), /valid Android device/);
});

test('Stop then Delete cannot remove a project while its owned agent job is still settling', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const run = cases.createTestRun(p, saved.id);
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  const projectHandlers = {};
  const { registerProjectHandlers } = load('main/handlers/project.ts', {
    './task': f.taskModule, '../utils/project-storage': f.storage,
  });
  registerProjectHandlers({ handle: (channel, action) => { projectHandlers[channel] = action; } });
  await f.taskModule.startTaskExecution(p.id, run.id, f.getWindow);
  const active = f.storage.loadProjects().projects[0].tasks[0];
  const evidence = path.join(active.resultPath, 'checkpoint.txt');
  fs.writeFileSync(evidence, 'still owned by the unsettled job');
  assert.equal(f.handlers['task:stop'](null, p.id, run.id).success, true);
  assert.equal(f.storage.loadProjects().projects[0].tasks[0].status, 'cancelled');
  assert.equal(f.taskModule.isProjectExecutionActive(p.id), true);
  assert.equal(f.taskModule.isProjectExecutionActive('another-project'), false);
  const blocked = await projectHandlers['project:delete'](null, p.id);
  assert.equal(blocked.success, false);
  assert.equal(fs.readFileSync(evidence, 'utf8'), 'still owned by the unsettled job');
  assert.equal(f.storage.loadProjects().projects.length, 1);
  assert.equal(f.records.readRunManifest(run.id).finalizedAt, undefined);
  // The test controls settlement only; no native action or visual verification is simulated.
  f.jobs[0].resolve({ status: 'cancelled' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.taskModule.isProjectExecutionActive(p.id), false);
  assert.ok(f.records.readRunManifest(run.id).finalizedAt);
  const deleted = await projectHandlers['project:delete'](null, p.id);
  assert.equal(deleted.success, true);
  assert.equal(f.storage.loadProjects().projects.length, 0);
  assert.equal(fs.existsSync(evidence), false);
  assert.equal(f.records.readRunManifest(run.id).run.status, 'cancelled');
});

test('explicit Delete purges settled run evidence and canonical records while preserving other runs and shared definitions', t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p);
  const runs = ['completed', 'failed', 'cancelled'].map((status, index) => {
    const run = cases.createTestRun(p, saved.id);
    run.status = status; run.completedAt = new Date().toISOString();
    run.resultPath = path.join(f.dir, 'evidence', `run-${index}`);
    fs.mkdirSync(run.resultPath, { recursive: true }); fs.writeFileSync(path.join(run.resultPath, 'report.md'), `run ${index}`);
    f.records.persistRunRecord(p, run);
    return run;
  });
  const other = project(); other.id = 'another-project'; other.tasks = []; other.testCases = [];
  f.storage.saveProjects({ projects: [p, other] });
  assert.equal(f.handlers['task:delete'](null, other.id, runs[0].id).success, false);
  assert.equal(fs.existsSync(runs[0].resultPath), true);
  const untouched = fs.readFileSync(runs[1].manifestPath, 'utf8');
  assert.equal(f.handlers['task:delete'](null, p.id, runs[0].id).success, true);
  let stored = f.storage.loadProjects().projects.find(item => item.id === p.id);
  assert.equal(stored.tasks.length, 2); assert.equal(stored.testCases.length, 1);
  assert.equal(fs.existsSync(runs[0].resultPath), false); assert.equal(f.records.readRunManifest(runs[0].id), undefined);
  assert.equal(fs.readFileSync(runs[1].manifestPath, 'utf8'), untouched);
  assert.equal(fs.readFileSync(path.join(runs[1].resultPath, 'report.md'), 'utf8'), 'run 1');
  for (const run of runs.slice(1)) assert.equal(f.handlers['task:delete'](null, p.id, run.id).success, true);
  stored = f.storage.loadProjects().projects.find(item => item.id === p.id);
  assert.equal(stored.tasks.length, 0); assert.equal(stored.testCases.length, 0);
  for (const run of runs) assert.equal(f.records.readRunManifest(run.id), undefined);
  assert.equal(f.storage.loadProjects().projects.find(item => item.id === other.id).tasks.length, 0);
});

test('Stop then task Delete is blocked until the owned job has finished its record flush', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir;
  const saved = course(p); const run = cases.createTestRun(p, saved.id);
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  await f.taskModule.startTaskExecution(p.id, run.id, f.getWindow);
  const current = f.storage.loadProjects().projects[0].tasks[0];
  const evidence = path.join(current.resultPath, 'checkpoint.txt'); fs.writeFileSync(evidence, 'unsettled evidence');
  assert.equal(f.handlers['task:stop'](null, p.id, run.id).success, true);
  assert.equal(f.storage.loadProjects().projects[0].tasks[0].status, 'cancelled');
  assert.equal(f.handlers['task:delete'](null, p.id, run.id).success, false);
  assert.equal(fs.readFileSync(evidence, 'utf8'), 'unsettled evidence');
  assert.equal(f.records.readRunManifest(run.id).finalizedAt, undefined);
  f.jobs[0].resolve({ status: 'cancelled' }); await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.records.readRunManifest(run.id).finalizedAt);
  assert.equal(f.handlers['task:delete'](null, p.id, run.id).success, true);
  assert.equal(fs.existsSync(current.resultPath), false); assert.equal(f.records.readRunManifest(run.id), undefined);
});

test('explicit Delete of a pending schedule leaves no cancelled manifest or orphan definition', t => {
  const f = runtimeFixture(t); const p = project(); const saved = course(p);
  const run = cases.createTestRun(p, saved.id, { scheduledAt: '2030-01-01T00:00:00Z' });
  f.records.persistRunRecord(p, run); f.storage.saveProjects({ projects: [p] });
  assert.equal(f.handlers['task:delete'](null, p.id, run.id).success, true);
  assert.equal(f.records.readRunManifest(run.id), undefined);
  const stored = f.storage.loadProjects().projects[0];
  assert.equal(stored.tasks.length, 0); assert.equal(stored.testCases.length, 0);
});

test('legacy shared result directories remain until the last referencing run is explicitly deleted', t => {
  const f = runtimeFixture(t); const p = project(); const saved = course(p);
  const shared = path.join(f.dir, 'shared-result'); fs.mkdirSync(shared); fs.writeFileSync(path.join(shared, 'report.md'), 'shared old report');
  const a = cases.createTestRun(p, saved.id); const b = cases.createTestRun(p, saved.id);
  for (const run of [a, b]) { run.status = 'completed'; run.resultPath = shared; f.records.persistRunRecord(p, run); }
  f.storage.saveProjects({ projects: [p] });
  assert.equal(f.handlers['task:delete'](null, p.id, a.id).success, true);
  assert.equal(fs.readFileSync(path.join(shared, 'report.md'), 'utf8'), 'shared old report');
  assert.ok(f.records.readRunManifest(b.id));
  assert.equal(f.handlers['task:delete'](null, p.id, b.id).success, true);
  assert.equal(fs.existsSync(shared), false);
});

test('a queued Repeat survives deletion of its old reference and does not claim unavailable guidance', async t => {
  const f = runtimeFixture(t); const p = project(); p.workspaceDir = f.dir; const saved = course(p);
  const previous = cases.createTestRun(p, saved.id); previous.status = 'completed'; previous.completedAt = '2025-01-01T00:00:00Z';
  previous.resultPath = path.join(f.dir, 'previous'); fs.mkdirSync(previous.resultPath); fs.writeFileSync(path.join(previous.resultPath, 'report.md'), 'old report');
  f.records.persistRunRecord(p, previous);
  const repeat = cases.createTestRun(p, saved.id, { scheduledAt: '2030-01-01T00:00:00Z' });
  assert.equal(repeat.referenceRunId, previous.id);
  f.records.persistRunRecord(p, repeat); f.storage.saveProjects({ projects: [p] });
  assert.equal(f.handlers['task:delete'](null, p.id, previous.id).success, true);
  assert.equal((await f.taskModule.startTaskExecution(p.id, repeat.id, f.getWindow)).success, true);
  assert.equal(f.jobs[0].options.goal, 'Verify login'); assert.equal(f.jobs[0].options.referenceRecording, undefined);
  const stored = f.storage.loadProjects().projects[0].tasks[0];
  assert.equal(stored.referenceRunId, undefined); assert.equal(f.records.readRunManifest(repeat.id).run.referenceRunId, undefined);
  assert.equal(stored.caseSnapshot.goal, 'Verify login');
  f.jobs[0].resolve({ status: 'cancelled' }); await new Promise(resolve => setImmediate(resolve));
});
