import { app, BrowserWindow, ipcMain, session, shell } from 'electron';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';

// This entry deliberately excludes main/index.ts, its updater, analytics initialization,
// auto-sync, and visible windows. All application handlers and renderer code remain real.
const scratch = process.env.KLEVER_DESKTOP_SMOKE_ROOT;
const repository = process.env.KLEVER_DESKTOP_SMOKE_REPOSITORY;
let window: BrowserWindow | undefined;
let cleanup: (() => Promise<void>) | undefined;
const unexpected: string[] = [];
const checks: string[] = [];
const executions: string[] = [];
const networkAttempts: string[] = [];

function check(name: string): void {
  checks.push(name);
  console.log(`PASS ${name}`);
}

function fixtureFile(file: string, contents: string | Uint8Array = ''): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, { mode: 0o600 });
}

async function waitFor(predicate: () => Promise<boolean>, description: string): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function script<T = unknown>(source: string): Promise<T> {
  return window!.webContents.executeJavaScript(source, false) as Promise<T>;
}

async function invoke(method: string, ...args: unknown[]): Promise<any> {
  return script(`window.electronAPI[${JSON.stringify(method)}](...${JSON.stringify(args)})`);
}

function succeeded(result: any, message: string): void {
  assert.equal(result?.success, true, `${message}: ${result?.error || 'missing successful IPC response'}`);
}

async function clickText(text: string): Promise<void> {
  await waitFor(async () => script<boolean>(`(() => {
    const button = [...document.querySelectorAll('button')].find(element =>
      element.textContent.trim() === ${JSON.stringify(text)} ||
      [...element.querySelectorAll('span')].some(span => span.textContent.trim() === ${JSON.stringify(text)}));
    if (!button) return false;
    button.click();
    return true;
  })()`), `button ${text}`);
}

async function run(): Promise<void> {
  assert.ok(scratch && repository, 'Run this entry through scripts/test-desktop.cjs.');
  const realScratch = fs.realpathSync(scratch);
  assert.equal(path.dirname(realScratch), fs.realpathSync(os.tmpdir()), 'Scratch must be a dedicated temporary-directory child.');
  assert.match(path.basename(realScratch), /^klever-desktop-smoke-/);
  const home = path.join(realScratch, 'home');
  const userData = path.join(realScratch, 'user-data');
  const sessionData = path.join(realScratch, 'session-data');
  for (const directory of [home, userData, sessionData]) fs.mkdirSync(directory, { recursive: true });
  app.setName('Klever Desktop Offline IPC Smoke');
  app.setPath('userData', userData);
  app.setPath('sessionData', sessionData);
  os.homedir = () => home;

  // A regression in the unsigned-account gate must fail the test rather than execute
  // a device controller or any other subprocess.
  for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
    (childProcess as any)[name] = (...args: unknown[]) => {
      executions.push(name);
      throw new Error(`Subprocess ${name} is forbidden in the offline desktop regression.`);
    };
  }
  syncBuiltinESMExports();
  globalThis.fetch = async () => {
    networkAttempts.push('main-process fetch');
    throw new Error('External networking is disabled in the offline desktop regression.');
  };
  shell.openExternal = async () => { throw new Error('External applications are disabled in the offline desktop regression.'); };
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    unexpected.push(`Main: ${args.map(value => value instanceof Error ? value.message : String(value)).join(' ')}`);
    originalConsoleError(...args);
  };

  const handlers = await import('../main/handlers');
  const records = await import('../main/utils/run-records');
  cleanup = handlers.cleanupAllProcesses;
  assert.equal(records.getRunManifestPath('smoke_isolation'), path.join(home, '.klever-desktop/runs/smoke_isolation.json'));

  await app.whenReady();
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_details, callback) => {
    networkAttempts.push('renderer request');
    callback({ cancel: true });
  });
  window = new BrowserWindow({
    show: false, width: 1200, height: 800,
    webPreferences: { preload: path.join(repository, '.vite/build/preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  window.webContents.on('console-message', (_event, level, message) => { if (level >= 3) unexpected.push(`Renderer: ${message}`); });
  window.webContents.on('render-process-gone', (_event, details) => unexpected.push(`Renderer exited: ${details.reason}`));
  window.webContents.on('did-fail-load', (_event, code, description) => { if (code !== -3) unexpected.push(`Renderer load: ${description}`); });
  handlers.registerAllHandlers(ipcMain, () => window || null);
  await window.loadFile(path.join(repository, 'dist/index.html'));
  await waitFor(() => script<boolean>(`Boolean(window.electronAPI?.testCaseRun && document.querySelector('#root')?.children.length)`), 'the actual renderer and preload');
  assert.equal(await script(`typeof window.require`), 'undefined');
  const account = await invoke('chatgptStatus');
  succeeded(account, 'Isolated account status');
  assert.equal(account.data.authenticated, false);
  assert.equal(fs.existsSync(path.join(userData, 'chatgpt/account.json')), false);
  const initial = await invoke('projectList');
  succeeded(initial, 'Empty isolated project storage');
  assert.deepEqual(initial.projects, []);
  check('actual renderer/preload IPC with isolated unsigned account');

  const projectResult = await invoke('projectCreate', { name: 'Offline Smoke Project', platform: 'android', workspaceDir: path.join(realScratch, 'workspace') });
  succeeded(projectResult, 'Create Android project');
  const project = projectResult.project;
  const caseResult = await invoke('testCaseCreate', {
    projectId: project.id, name: 'Offline Smoke Course', goal: 'Verify the original smoke course.',
    apkSource: { type: 'installed_package', packageName: 'com.example.klever.smoke' }, maxRounds: 2,
  });
  succeeded(caseResult, 'Save test course');
  const testCase = caseResult.testCase;
  assert.equal(testCase.revision, 1);
  const firstResult = await invoke('testCaseRun', project.id, testCase.id, { buildLabel: 'smoke-v1' });
  const queuedResult = await invoke('testCaseRun', project.id, testCase.id, { buildLabel: 'smoke-v1-queued' });
  succeeded(firstResult, 'Create first run'); succeeded(queuedResult, 'Create queued run');
  const first = firstResult.task;
  const queued = queuedResult.task;
  assert.notEqual(first.id, queued.id);
  for (const task of [first, queued]) {
    assert.equal(task.status, 'pending');
    assert.equal(task.testCaseId, testCase.id);
    assert.equal(task.caseSnapshot.revision, 1);
  }
  check('saved course creates unique pending run snapshots');

  const started = await invoke('taskStart', project.id, first.id);
  succeeded(started, 'Accept the asynchronous native job');
  await waitFor(async () => {
    const projectState = await invoke('projectGet', project.id);
    return projectState.success && projectState.project.tasks.find((task: any) => task.id === first.id)?.status === 'failed';
  }, 'the unsigned job to finish and record failure');
  assert.deepEqual(executions, [], 'Unsigned execution must stop before invoking the native device controller.');
  let saved = await invoke('projectGet', project.id);
  succeeded(saved, 'Read failed run');
  const failed = saved.project.tasks.find((task: any) => task.id === first.id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /Sign in with ChatGPT/);
  assert.ok(failed.completedAt && failed.resultPath);
  assert.ok(path.resolve(failed.resultPath).startsWith(path.join(realScratch, 'workspace') + path.sep));
  const recordedFailure = await invoke('taskRecordingGet', project.id, first.id);
  succeeded(recordedFailure, 'Read unsigned failure manifest');
  assert.equal(recordedFailure.recording.status, 'failed');
  assert.equal(recordedFailure.recording.finalVerification.outcome, 'unverified');
  assert.match(recordedFailure.recording.reason, /Sign in with ChatGPT/);
  assert.equal(recordedFailure.manifest.run.status, 'failed');
  assert.equal(recordedFailure.manifest.run.id, first.id);
  assert.ok(recordedFailure.manifest.finalizedAt);
  const manifestFile = records.getRunManifestPath(first.id);
  const sealedBytes = fs.readFileSync(manifestFile);
  check('unsigned start creates a sealed failed run without native execution');

  const edited = await invoke('testCaseUpdate', project.id, testCase.id, { goal: 'Verify the revised smoke course.', maxRounds: 3 });
  succeeded(edited, 'Edit saved course');
  assert.equal(edited.testCase.revision, 2);
  saved = await invoke('projectGet', project.id);
  const preserved = saved.project.tasks.find((task: any) => task.id === queued.id);
  assert.equal(preserved.caseSnapshot.revision, 1);
  assert.equal(preserved.goal, first.goal);
  assert.equal(preserved.maxRounds, 2);
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const scheduledResult = await invoke('testCaseRun', project.id, testCase.id, { buildLabel: 'smoke-v2-scheduled', scheduledAt: future });
  succeeded(scheduledResult, 'Create revised scheduled run');
  const scheduled = scheduledResult.task;
  assert.equal(scheduled.caseSnapshot.revision, 2);
  assert.equal(scheduled.maxRounds, 3);
  assert.equal(scheduled.goal, edited.testCase.goal);
  const scheduleList = await invoke('scheduleList');
  succeeded(scheduleList, 'Read scheduled run');
  assert.ok(scheduleList.scheduledTasks.some((entry: any) => entry.task.id === scheduled.id && entry.task.scheduledAt === future));
  succeeded(await invoke('scheduleCancel', project.id, scheduled.id), 'Cancel future run');
  const scheduledManifest = await invoke('taskRecordingGet', project.id, scheduled.id);
  assert.equal(scheduledManifest.manifest.run.status, 'cancelled');
  assert.equal(scheduledManifest.manifest.run.scheduledAt, undefined);
  assert.ok(scheduledManifest.manifest.finalizedAt);
  succeeded(await invoke('scheduleAdd', project.id, queued.id, future), 'Schedule an existing queued run');
  succeeded(await invoke('scheduleCancel', project.id, queued.id), 'Cancel an existing queued run');
  const repeated = await invoke('testCaseRun', project.id, testCase.id, { buildLabel: 'smoke-v3-new' });
  succeeded(repeated, 'Repeat revised course');
  assert.equal(new Set([first.id, queued.id, scheduled.id, repeated.task.id]).size, 4);
  assert.equal(repeated.task.caseSnapshot.revision, 2);
  assert.deepEqual(fs.readFileSync(manifestFile), sealedBytes);
  check('course edits affect future runs; schedules cancel; sealed manifests stay byte-identical');

  assert.equal(await script(`typeof window.electronAPI.taskUpdate`), 'undefined', 'Mutable run editing is not exposed through the renderer.');
  const invalidReference = await invoke('testCaseRun', project.id, testCase.id, { referenceRunId: first.id });
  assert.equal(invalidReference.success, false, 'A failed run cannot be a completed reference course.');
  const other = await invoke('projectCreate', { name: 'Other Smoke Project', platform: 'android', workspaceDir: path.join(realScratch, 'other-workspace') });
  succeeded(other, 'Create second project');
  const crossed = await invoke('taskRecordingGet', other.project.id, first.id);
  assert.equal(crossed.success, false, 'Recording lookup must be scoped to its project.');
  assert.deepEqual(fs.readFileSync(manifestFile), sealedBytes);
  check('IPC rejects run edits, failed references, and cross-project recording lookup');

  // A synthetic recording tests the existing IPC/renderer data contract. It is
  // explicitly unverified and does not claim a device or an AI action occurred.
  fixtureFile(path.join(failed.resultPath, 'smoke-before.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
  fixtureFile(path.join(failed.resultPath, 'recording.json'), JSON.stringify({
    schemaVersion: 1, runId: first.id, testCaseId: testCase.id, testCaseRevision: 1,
    goal: first.goal, status: 'failed', startedAt: failed.startedAt, finishedAt: failed.completedAt,
    reason: 'Synthetic offline evidence; no native execution.',
    context: { app: { packageName: 'com.example.klever.smoke', versionName: '0.0.0-smoke', versionCode: '1' }, device: { serial: 'OFFLINE-FIXTURE', model: 'Smoke fixture' } },
    steps: [{ index: 0, round: 0, startedAt: failed.startedAt, finishedAt: failed.completedAt,
      action: { type: 'tap', intent: 'Synthetic contract fixture', target: { resourceId: 'smoke:id/control' } },
      observationBefore: 'Offline recording contract fixture', result: 'failed', error: 'Device execution intentionally omitted.', evidence: { before: 'smoke-before.png' } }],
    finalVerification: { source: 'agent_visual', goal: first.goal, outcome: 'unverified', detail: 'Offline smoke fixture only; no device result was verified.' },
  }));
  const recording = await invoke('taskRecordingGet', project.id, first.id);
  succeeded(recording, 'Read recording contract');
  assert.equal(recording.recording.context.app.versionName, '0.0.0-smoke');
  assert.equal(recording.recording.context.device.serial, 'OFFLINE-FIXTURE');
  assert.equal(recording.recording.steps[0].action.target.resourceId, 'smoke:id/control');
  assert.equal(recording.recording.finalVerification.outcome, 'unverified');
  const image = await invoke('fileReadImage', 'smoke-before.png', failed.resultPath);
  succeeded(image, 'Read recorded screenshot through preload');
  assert.match(image.dataUrl, /^data:image\/png;base64,/);
  assert.deepEqual(fs.readFileSync(manifestFile), sealedBytes);
  check('recording IPC preserves app/device/action/evidence metadata without rewriting terminal history');

  // The structured file stays an internal reference. The visible result is the
  // original continuous Markdown report, including observations and screenshots.
  fixtureFile(path.join(failed.resultPath, `log_report_${path.basename(failed.resultPath)}.md`), [
    '# Offline Markdown report', '', first.goal, '',
    '## Round 1', '', '### Observation', '', 'Offline recording contract fixture', '',
    '### Action', '', 'Synthetic contract fixture; no device command executed.', '',
    '![Before action](./smoke-before.png)', '',
    '## Result', '', 'Offline smoke fixture only; no device result was verified.', '',
  ].join('\n'));
  await window.loadFile(path.join(repository, 'dist/index.html'));
  await clickText(project.name);
  await waitFor(() => script<boolean>(`document.querySelectorAll('table tbody tr').length >= 3`), 'original task/run list');
  await script(`Array.from(document.querySelectorAll('table tbody tr')).find(row => row.innerText.includes('Failed')).querySelector('button').click()`);
  await waitFor(() => script<boolean>(`document.querySelector('[data-testid="markdown-report"]')?.innerText.includes('Offline Markdown report') && document.body.innerText.includes('Offline recording contract fixture')`), 'continuous Markdown report');
  await waitFor(() => script<boolean>(`Array.from(document.querySelectorAll('[data-testid="markdown-report"] img')).some(image => image.complete && image.naturalWidth > 0)`), 'Markdown screenshot');
  assert.equal(await script(`document.querySelector('[data-testid="markdown-report"] h1')?.textContent`), 'Offline Markdown report');
  assert.equal(await script(`document.querySelector('[data-testid="markdown-report"] table, [data-testid="markdown-report"] [data-state]') !== null`), false);
  assert.equal(await script(`document.body.innerText.includes('Run comparison') || document.body.innerText.includes('Recorded steps')`), false);
  await clickText('Terminal');
  await waitFor(() => script<boolean>(`document.querySelector('[data-testid="task-log"]') !== null`), 'page-local run log');
  window.webContents.send('task:output', { projectId: other.project.id, taskId: first.id, output: 'OTHER_PROJECT_LOG_SENTINEL' });
  window.webContents.send('task:output', { projectId: project.id, taskId: repeated.task.id, output: 'OTHER_RUN_LOG_SENTINEL' });
  window.webContents.send('task:output', { projectId: project.id, taskId: first.id, output: 'SELECTED_RUN_LOG_SENTINEL' });
  await waitFor(() => script<boolean>(`document.querySelector('[data-testid="task-log"]')?.textContent.includes('SELECTED_RUN_LOG_SENTINEL')`), 'selected run live log');
  assert.equal(await script(`document.querySelector('[data-testid="task-log"]')?.textContent.includes('OTHER_PROJECT_LOG_SENTINEL') || document.querySelector('[data-testid="task-log"]')?.textContent.includes('OTHER_RUN_LOG_SENTINEL')`), false);
  await clickText('Report');
  await waitFor(() => script<boolean>(`document.querySelector('[data-testid="markdown-report"] h1')?.textContent === 'Offline Markdown report'`), 'report tab restoration');
  check('actual renderer preserves original Markdown screenshots and page-local selected-run logs');

  assert.deepEqual(executions, [], 'No subprocess may execute in the offline regression.');
  assert.deepEqual(networkAttempts, [], 'No external request may occur in the offline regression.');
  assert.deepEqual(unexpected, [], 'Unexpected renderer or main-process error.');
  assert.equal(fs.existsSync(path.join(userData, 'chatgpt/account.json')), false);
  console.log(`DESKTOP_SMOKE_OK ${JSON.stringify({ checks: checks.length, offline: true, actualIPC: true, nativeExecution: false })}`);
}

process.on('uncaughtException', error => { unexpected.push(error.message); void finish(1); });
process.on('unhandledRejection', error => { unexpected.push(error instanceof Error ? error.message : String(error)); void finish(1); });
let finishing = false;
async function finish(code: number): Promise<void> {
  if (finishing) return;
  finishing = true;
  try { await cleanup?.(); }
  catch (error) { console.error('Desktop smoke cleanup failed:', error instanceof Error ? error.message : String(error)); code = 1; }
  if (window && !window.isDestroyed()) window.destroy();
  if (code) console.error(`DESKTOP_SMOKE_FAIL ${unexpected.join('; ') || 'See assertion above.'}`);
  app.exit(code);
}

void run().then(() => finish(0)).catch(error => {
  console.error(error instanceof Error ? error.stack : String(error));
  void finish(1);
});
