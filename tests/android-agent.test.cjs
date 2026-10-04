const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');

const decision = (type, assessment = 'continue', overrides = {}) => ({
  observation: assessment === 'passed' ? 'Android version is visibly shown.' : 'Settings is visible.',
  intent: 'Open the Android version page', assessment, reason: 'Visible screen evidence',
  action: { type, x: type === 'tap' ? 40 : null, y: type === 'tap' ? 60 : null,
    endX: null, endY: null, durationMs: null, text: null, ...overrides },
});

async function fixture(t, steps, overrides = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'klever-native-agent-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const commands = [];
  const prompts = [];
  const progress = [];
  let preparations = 0;
  const driver = {
    prepareAndroidApp: async () => { preparations++; return { device: { serial: 'emulator-test', model: 'Test device', androidVersion: '17', apiLevel: '37' }, app: { packageName: 'com.android.settings', versionName: '17', versionCode: '37' } }; },
    captureAndroidScreen: async (_serial, filename) => { await fs.writeFile(filename, Buffer.from([137,80,78,71,13,10,26,10])); return { path: filename, width: 200, height: 400 }; },
    executeAndroidAction: async (_serial, action) => { commands.push(action); },
    ...overrides.driver,
  };
  const report = load('main/utils/android-report.ts', { './android-annotation': {
    annotateAndroidScreenshot: async (source, destination) => fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL),
  } });
  const agent = load('main/utils/android-agent.ts', {
    './android-driver': driver,
    './android-report': report,
    './chatgpt-auth': {
      getChatGPTStatus: async () => ({ authenticated: overrides.authenticated ?? true }),
      inferAndroidStep: async (request) => {
        prompts.push(request.prompt);
        if (!steps.length) throw new Error('Unexpected inference');
        const next = steps.shift();
        if (next instanceof Error) throw next;
        return { step: next, model: 'test-luna', usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 } };
      },
    },
  });
  const controller = new AbortController();
  const options = { projectId: 'proj_test', taskId: 'task_test', testCaseId: 'case_test', testCaseRevision: 1,
    goal: 'Open Settings and verify the Android version without changing anything.',
    apkSource: { type: 'installed_package', packageName: 'com.android.settings' },
    resultPath: directory, maxSteps: 5, signal: controller.signal,
    onOutput: () => {}, onProgress: value => progress.push(value) };
  return { directory, agent, options, controller, commands, prompts, progress, preparations: () => preparations };
}

test('a completed structured run retains native actions, actual build metadata and evidence', async t => {
  const f = await fixture(t, [decision('tap'), decision('finish', 'passed')]);
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'completed');
  assert.equal(result.finalVerification.outcome, 'passed');
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].result, 'executed');
  assert.equal(result.steps[0].action.x, 40);
  assert.equal(result.steps[0].screen.width, 200);
  assert.equal(result.steps[0].observationAfter, 'Android version is visibly shown.');
  assert.equal(result.context.app.versionName, '17');
  assert.equal(result.model, 'test-luna');
  assert.equal(f.progress.at(-1).tokens, 56);
  assert.equal(f.commands.length, 1);
  assert.equal((JSON.parse(await fs.readFile(path.join(f.directory, 'recording.json')))).runId, 'task_test');
  await fs.stat(path.join(f.directory, result.finalVerification.evidence));
});

test('unsigned runs record unverified failure before any native transport or inference', async t => {
  const f = await fixture(t, [], { authenticated: false });
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'failed');
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.match(result.reason, /Sign in with ChatGPT/);
  assert.equal(f.preparations(), 0);
  assert.equal(f.prompts.length, 0);
  assert.equal(f.commands.length, 0);
});

test('invalid screenshot coordinates never execute a device action or masquerade as an app failure', async t => {
  const f = await fixture(t, [decision('tap', 'continue', { x: 200 })]);
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.match(result.reason, /outside the current screenshot/);
  assert.equal(f.commands.length, 0);
});

test('refused or incomplete inference cannot produce a successful assessment', async t => {
  const f = await fixture(t, [new Error('ChatGPT refused screen analysis')]);
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'failed');
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.equal(f.commands.length, 0);
});

test('a model-confirmed unmet goal is distinct from an infrastructure failure', async t => {
  const f = await fixture(t, [decision('finish', 'failed')]);
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'failed');
  assert.equal(result.finalVerification.outcome, 'failed');
  assert.equal(result.steps.length, 0);
});

test('an input or execution limitation remains unverified rather than an app failure', async t => {
  const f = await fixture(t, [decision('finish', 'unverified')]);
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'failed');
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.equal(f.commands.length, 0);
});

test('an unconfirmed step limit keeps its executed evidence and stays unverified', async t => {
  const f = await fixture(t, [decision('tap'), decision('tap')]);
  const result = await f.agent.startAndroidTest({ ...f.options, maxSteps: 1 });
  assert.equal(result.status, 'failed');
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.equal(result.steps[0].result, 'executed');
  assert.equal(f.commands.length, 1);
  await fs.stat(path.join(f.directory, result.steps[0].evidence.after));
});

test('the final permitted action is visually assessed without exceeding the action limit', async t => {
  const f = await fixture(t, [decision('tap'), decision('finish', 'passed')]);
  const result = await f.agent.startAndroidTest({ ...f.options, maxSteps: 1 });
  assert.equal(result.status, 'completed');
  assert.equal(result.finalVerification.outcome, 'passed');
  assert.equal(f.commands.length, 1);
  assert.equal(f.prompts.length, 2);
  assert.equal(JSON.parse(f.prompts.at(-1).slice(f.prompts.at(-1).indexOf('\n') + 1)).remainingActions, 0);
});

test('cancellation during native execution saves an interrupted action and never schedules another', async t => {
  let controller;
  const f = await fixture(t, [decision('tap')], { driver: {
    executeAndroidAction: async () => { controller.abort(); throw new Error('cancelled'); },
  } });
  controller = f.controller;
  const result = await f.agent.startAndroidTest(f.options);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.finalVerification.outcome, 'unverified');
  assert.equal(result.steps[0].result, 'failed');
  assert.match(result.steps[0].error, /cancelled/);
  assert.equal(f.prompts.length, 1);
});

test('existing results are immutable and successful references supply intentions without old coordinates', async t => {
  const f = await fixture(t, [decision('finish', 'passed')]);
  const previous = { schemaVersion: 1, status: 'completed', testCaseId: 'case_test', finalVerification: { outcome: 'passed' },
    steps: [{ result: 'executed', action: { intent: 'Open About phone', x: 187, y: 390 }, observationBefore: 'Menu visible', observationAfter: 'Version page visible' }] };
  await f.agent.startAndroidTest({ ...f.options, referenceRecording: previous });
  assert.match(f.prompts[0], /Open About phone/);
  assert.doesNotMatch(f.prompts[0], /"x":187|"y":390/);
  const bytes = await fs.readFile(path.join(f.directory, 'recording.json'));
  await assert.rejects(f.agent.startAndroidTest(f.options), /EEXIST/);
  assert.equal(Buffer.compare(bytes, await fs.readFile(path.join(f.directory, 'recording.json'))), 0);
});
