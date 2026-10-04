const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
const stamp = '2026-10-04T00:00:00.000Z';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-runs-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const storage = load('main/utils/run-records.ts', { './app-paths': { getKleverDir: () => dir } });
  const runDir = path.join(dir, 'results', 'task_test');
  fs.mkdirSync(runDir, { recursive: true });
  const task = { id: 'task_test', projectId: 'proj_test', name: 'Verify account', goal: 'Sign in and verify account',
    status: 'running', createdAt: stamp, updatedAt: stamp, resultPath: runDir };
  const project = { id: task.projectId, name: 'Example', platform: 'android', status: 'active',
    createdAt: stamp, updatedAt: stamp, workspaceDir: path.join(dir, 'workspace'), tasks: [task] };
  const recording = { schemaVersion: 1, runId: task.id, goal: task.goal, startedAt: stamp, status: 'running',
    context: { app: { packageName: 'com.example.app', versionName: '2.1', versionCode: '21' },
      device: { serial: 'emulator-5554', manufacturer: 'Google', model: 'Pixel', androidVersion: '16', apiLevel: '36' } },
    steps: [{ index: 0, round: 1, startedAt: stamp, finishedAt: stamp,
      action: { type: 'tap', intent: 'Open account', target: { resourceId: 'account' } },
      observationBefore: 'Account button visible', observationAfter: 'Account screen visible', result: 'executed',
      evidence: { before: 'screenshots/before.png', after: 'screenshots/after.png', xml: 'screenshots/before.xml' },
      verification: { source: 'agent_visual', decision: 'CONTINUE', detail: 'Account screen visible' } }] };
  fs.mkdirSync(path.join(runDir, 'screenshots'));
  for (const file of ['before.png', 'after.png', 'before.xml']) fs.writeFileSync(path.join(runDir, 'screenshots', file), 'evidence');
  const recordingPath = path.join(runDir, 'recording.json');
  const write = value => fs.writeFileSync(recordingPath, JSON.stringify(value));
  return { dir, storage, task, project, recording, recordingPath, runDir, write };
}

test('manifest is independent of the project index, atomic, private, and a task snapshot', t => {
  const f = fixture(t);
  const manifest = f.storage.persistRunRecord(f.project, f.task);
  const expected = path.join(f.dir, 'runs', `${f.task.id}.json`);
  assert.equal(f.task.manifestPath, expected);
  assert.equal(manifest.finalizedAt, undefined);
  assert.deepEqual(plain(f.storage.readRunManifest(f.task.id)), plain(manifest));
  assert.equal(fs.existsSync(path.join(f.dir, 'projects.json')), false);
  if (process.platform !== 'win32') assert.equal(fs.statSync(expected).mode & 0o777, 0o600);
  assert.deepEqual(fs.readdirSync(path.dirname(expected)), [`${f.task.id}.json`]);
  f.task.goal = 'edited after snapshot';
  assert.equal(manifest.run.goal, 'Sign in and verify account');
  assert.equal(f.storage.readRunManifest(f.task.id).run.goal, 'Sign in and verify account');
});

test('finalized manifests reject changes and preserve exact logical idempotence', t => {
  const f = fixture(t);
  f.task.status = 'completed';
  const manifest = f.storage.persistRunRecord(f.project, f.task);
  assert.ok(manifest.finalizedAt);
  const bytes = fs.readFileSync(f.task.manifestPath, 'utf8');
  const repeated = f.storage.persistRunRecord(f.project, { ...f.task });
  assert.deepEqual(plain(repeated), plain(manifest));
  assert.equal(fs.readFileSync(f.task.manifestPath, 'utf8'), bytes);
  assert.throws(() => f.storage.persistRunRecord(f.project, { ...f.task, output: 'changed' }), /Finalized/);
  assert.throws(() => f.storage.persistRunRecord({ ...f.project, name: 'Renamed' }, f.task), /Finalized/);
  assert.equal(fs.readFileSync(f.task.manifestPath, 'utf8'), bytes);
  // Updating the project index cannot erase the frozen independent record.
  fs.writeFileSync(path.join(f.dir, 'projects.json'), JSON.stringify({ projects: [] }));
  assert.equal(f.storage.readRunManifest(f.task.id).run.status, 'completed');
});

test('UI cancellation stays mutable until the child stops and actual recording metadata is collected', t => {
  const f = fixture(t);
  f.write(f.recording);
  f.task.status = 'cancelled';
  const pending = f.storage.persistRunRecord(f.project, f.task, { finalize: false });
  assert.equal(pending.finalizedAt, undefined);
  assert.equal(pending.run.recordingPath, undefined, 'persist alone must not collect an unfinished child recording');
  f.recording.status = 'cancelled';
  f.recording.finishedAt = stamp;
  f.recording.reason = 'User cancelled';
  f.recording.finalVerification = { source: 'agent_visual', goal: f.task.goal, outcome: 'unverified',
    evidence: 'screenshots/after.png', detail: 'Stopped before final check' };
  f.write(f.recording);
  f.storage.collectRunRecording(f.task);
  const final = f.storage.persistRunRecord(f.project, f.task);
  assert.ok(final.finalizedAt);
  assert.equal(final.run.finalVerification.outcome, 'unverified');
  assert.equal(final.run.app.versionName, '2.1');
  assert.equal(final.run.device.apiLevel, '36');
  f.recording.context.app.versionName = '3.0';
  f.write(f.recording);
  f.storage.collectRunRecording(f.task);
  assert.throws(() => f.storage.persistRunRecord(f.project, f.task), /Finalized/);
  assert.equal(f.storage.readRunManifest(f.task.id).run.app.versionName, '2.1');
});

test('legacy missing recording creates no invented app, device, steps, or verification metadata', t => {
  const f = fixture(t);
  f.task.status = 'completed';
  f.task.apkSource = { type: 'installed_package', packageName: 'com.unverified.app' };
  assert.equal(f.storage.collectRunRecording(f.task), undefined);
  assert.equal(f.task.app, undefined);
  assert.equal(f.task.device, undefined);
  assert.equal(f.task.finalVerification, undefined);
  assert.equal(f.task.recordingPath, undefined);
  const manifest = f.storage.persistRunRecord(f.project, f.task);
  assert.equal(manifest.run.app, undefined);
  assert.equal(manifest.run.recordingPath, undefined);
  assert.equal(manifest.run.finalVerification, undefined);
  assert.equal(f.storage.readRunManifest('task_missing'), undefined);
});

test('collector validates actual schema, identity, goal, context, and step fields before mutating the task', t => {
  const f = fixture(t);
  const invalid = [
    { ...f.recording, schemaVersion: 2 },
    { ...f.recording, runId: 'task_other' },
    { ...f.recording, goal: 'Other goal' },
    { ...f.recording, status: 'passed' },
    { ...f.recording, context: { app: { versionCode: 21 }, device: {} } },
    { ...f.recording, testCaseId: 'case_other' },
    { ...f.recording, steps: [{ ...f.recording.steps[0], action: { type: 'shell', intent: 'Run arbitrary command' } }] },
    { ...f.recording, steps: [{ ...f.recording.steps[0], index: -1 }] },
    { ...f.recording, steps: [{ ...f.recording.steps[0], error: { message: 'Failure' } }] },
    { ...f.recording, finalVerification: { source: 'agent_visual', goal: 'Other goal', outcome: 'passed', detail: 'Wrong goal' } },
  ];
  for (const recording of invalid) {
    f.write(recording);
    assert.throws(() => f.storage.collectRunRecording(f.task), /Invalid run recording/);
    assert.equal(f.task.app, undefined);
    assert.equal(f.task.recordingPath, undefined);
  }
  f.recording.steps[0].action = { type: 'enter', intent: 'Submit keyboard input' };
  f.write(f.recording);
  const collected = f.storage.collectRunRecording(f.task);
  assert.equal(collected.steps[0].action.type, 'enter');
  assert.deepEqual(plain(f.task.app), f.recording.context.app);
  assert.deepEqual(plain(f.task.device), f.recording.context.device);
  assert.equal(f.task.recordingPath, f.recordingPath);
});

test('collector reads only the registered result path and applies its byte limit before parsing', t => {
  const f = fixture(t);
  const unrelated = path.join(f.dir, 'unrelated.json');
  fs.writeFileSync(unrelated, JSON.stringify(f.recording));
  f.task.recordingPath = unrelated;
  assert.equal(f.storage.collectRunRecording(f.task), undefined);
  fs.writeFileSync(f.recordingPath, Buffer.alloc(5 * 1024 * 1024 + 1, 0x20));
  assert.throws(() => f.storage.collectRunRecording(f.task), /size/);
  assert.equal(f.task.recordingPath, unrelated);
  assert.throws(() => f.storage.collectRunRecording({ ...f.task, resultPath: 'relative/path' }), /absolute/);
  fs.rmSync(f.recordingPath);
  fs.symlinkSync(unrelated, f.recordingPath);
  assert.throws(() => f.storage.collectRunRecording(f.task), /regular file/);
});

test('direct Android point, swipe, and wait records retain screen coordinates and verification decisions', t => {
  const f = fixture(t);
  const actions = [
    { type: 'tap', intent: 'Open account', x: 639, y: 1279 },
    { type: 'swipe', intent: 'Scroll account', x: 0, y: 0, endX: 639, endY: 1279, durationMs: 5000 },
    { type: 'wait', intent: 'Wait for account screen', durationMs: 1 },
  ];
  f.recording.steps = actions.map((action, index) => ({ ...structuredClone(f.recording.steps[0]), index, round: index + 1,
    screen: { width: 640, height: 1280 }, action,
    verification: { source: 'agent_visual', decision: ['continue', 'passed', 'failed'][index], detail: 'Observed result' } }));
  f.write(f.recording);
  const collected = f.storage.collectRunRecording(f.task);
  assert.deepEqual(plain(collected.steps.map(step => step.action)), actions);
  assert.deepEqual(plain(collected.steps.map(step => step.screen)), actions.map(() => ({ width: 640, height: 1280 })));
  assert.deepEqual(plain(collected.steps.map(step => step.verification.decision)), ['continue', 'passed', 'failed']);
});

test('screen dimensions, coordinate bounds, and duration are validated before metadata is collected', t => {
  const f = fixture(t);
  const base = { ...f.recording.steps[0], screen: { width: 640, height: 1280 },
    action: { type: 'swipe', intent: 'Scroll', x: 0, y: 0, endX: 639, endY: 1279, durationMs: 200 } };
  const invalidSteps = [
    ...[{ width: 0, height: 1280 }, { width: 640, height: -1 }, { width: 1.5, height: 1280 },
      { width: 640, height: '1280' }, null].map(screen => ({ ...base, screen })),
    ...[{ x: -1 }, { x: 640 }, { y: 1280 }, { endX: 640 }, { endY: 1280 }, { y: 1.5 }, { x: '20' },
      { y: Infinity }, { endX: NaN }, { durationMs: 0 }, { durationMs: 5001 }, { durationMs: 1.5 },
      { durationMs: '200' }].map(extra => ({ ...base, action: { ...base.action, ...extra } })),
  ];
  for (const step of invalidSteps) {
    f.write({ ...f.recording, steps: [step] });
    assert.throws(() => f.storage.collectRunRecording(f.task), /Invalid run recording/);
    assert.equal(f.task.app, undefined);
    assert.equal(f.task.recordingPath, undefined);
  }
});

test('historical actions without screen or coordinates and optional coordinates without screen remain readable', t => {
  const f = fixture(t);
  f.recording.steps[0].action = { type: 'long_press', intent: 'Open old menu', target: { text: 'Menu' } };
  f.write(f.recording);
  assert.equal(f.storage.collectRunRecording(f.task).steps[0].screen, undefined);
  assert.equal(f.storage.collectRunRecording(f.task).steps[0].action.x, undefined);
  f.recording.steps[0].action = { type: 'tap', intent: 'Tap older recording', x: 1000, y: 2000 };
  f.write(f.recording);
  assert.equal(f.storage.collectRunRecording(f.task).steps[0].action.y, 2000);
});

test('evidence rejects absolute paths, traversal, Windows paths, and escaping symlinks', t => {
  const f = fixture(t);
  const external = path.join(f.dir, 'outside');
  fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'secret.png'), 'private');
  fs.symlinkSync(external, path.join(f.runDir, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const evidence of ['../outside/secret.png', path.join(external, 'secret.png'), 'C:\\private\\secret.png',
    '..\\outside\\secret.png', 'linked/secret.png', 'linked/missing.png']) {
    const recording = structuredClone(f.recording);
    recording.steps[0].evidence.before = evidence;
    f.write(recording);
    assert.throws(() => f.storage.collectRunRecording(f.task), /escapes/);
    assert.equal(f.task.app, undefined);
  }
  f.recording.finalVerification = { source: 'agent_visual', goal: f.task.goal, outcome: 'failed', detail: 'Failed', evidence: '../outside/secret.png' };
  f.write(f.recording);
  assert.throws(() => f.storage.collectRunRecording(f.task), /escapes/);
});

test('failed recording retains missing evidence within the run and accepts legacy scoped identity', t => {
  const f = fixture(t);
  delete f.recording.runId;
  f.recording.status = 'failed';
  f.recording.steps[0].result = 'failed';
  f.recording.steps[0].evidence = { before: 'screenshots/unfinished.png', after: 'missing/subdir/after.png' };
  f.write(f.recording);
  const collected = f.storage.collectRunRecording(f.task);
  assert.equal(collected.steps[0].evidence.after, 'missing/subdir/after.png');
  assert.equal(collected.status, 'failed');
  assert.equal(collected.runId, undefined);
});

test('failed attempted action retains an empty uncaptured before screenshot and its error', t => {
  const f = fixture(t);
  f.recording.status = 'failed';
  f.recording.steps[0].result = 'failed';
  f.recording.steps[0].error = 'Screenshot capture failed before the action';
  f.recording.steps[0].evidence = { before: '' };
  f.write(f.recording);
  const collected = f.storage.collectRunRecording(f.task);
  assert.equal(collected.steps[0].evidence.before, '');
  assert.equal(collected.steps[0].error, 'Screenshot capture failed before the action');
  for (const evidence of [{ before: null }, { before: '', after: '' }, { before: '', xml: '' },
    { before: path.join(f.dir, 'outside.png') }]) {
    f.recording.steps[0].evidence = evidence;
    f.write(f.recording);
    assert.throws(() => f.storage.collectRunRecording(f.task), /Invalid run recording/);
  }
});

test('manifest IDs cannot traverse directories and manifest files cannot be redirected by symlinks', t => {
  const f = fixture(t);
  for (const id of ['../outside', 'task/other', 'task\\other', '.task', '', 'task:other', 'x'.repeat(181)]) {
    assert.throws(() => f.storage.getRunManifestPath(id), /Invalid run ID/);
    assert.throws(() => f.storage.readRunManifest(id), /Invalid run ID/);
  }
  assert.ok(f.storage.getRunManifestPath('task_1728000000000').endsWith('task_1728000000000.json'));
  const manifest = f.storage.persistRunRecord(f.project, f.task);
  const outside = path.join(f.dir, 'outside.json');
  fs.writeFileSync(outside, JSON.stringify(manifest));
  fs.rmSync(f.task.manifestPath);
  fs.symlinkSync(outside, f.task.manifestPath);
  assert.throws(() => f.storage.readRunManifest(f.task.id), /regular file/);
  assert.throws(() => f.storage.persistRunRecord(f.project, f.task), /regular file/);
  assert.equal(fs.readFileSync(outside, 'utf8'), JSON.stringify(manifest));
  fs.rmSync(path.join(f.dir, 'runs'), { recursive: true });
  fs.mkdirSync(path.join(f.dir, 'redirected'));
  fs.symlinkSync(path.join(f.dir, 'redirected'), path.join(f.dir, 'runs'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.storage.persistRunRecord(f.project, f.task), /directory is invalid/);
});

test('manifest reader rejects corrupt schemas, wrong IDs, and mismatched project ownership', t => {
  const f = fixture(t);
  const manifest = f.storage.persistRunRecord(f.project, f.task);
  for (const invalid of [{ ...manifest, schemaVersion: 2 }, { ...manifest, run: { ...manifest.run, id: 'task_other' } },
    { ...manifest, run: { ...manifest.run, projectId: 'other' } }]) {
    fs.writeFileSync(f.task.manifestPath, JSON.stringify(invalid));
    assert.throws(() => f.storage.readRunManifest(f.task.id), /Invalid run manifest/);
  }
  assert.throws(() => f.storage.persistRunRecord({ ...f.project, id: 'other' }, f.task), /belong/);
});
