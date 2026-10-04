const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');

function recording() {
  return { schemaVersion: 1, runId: 'task_test', goal: 'Open the Android version page.', status: 'running',
    context: { app: { packageName: 'com.android.settings', versionName: '17' }, device: { model: 'Test phone', androidVersion: '17' } },
    steps: [{ index: 1, round: 1, action: { type: 'tap', intent: 'Open About phone', x: 12, y: 24 },
      observationBefore: 'About phone is visible.', result: 'executed', finishedAt: new Date().toISOString(),
      screen: { width: 40, height: 80 }, evidence: { before: 'before.png', after: 'after.png' },
      observationAfter: 'Android version 17 is visible.', verification: { source: 'agent_visual', decision: 'passed', detail: 'The expected value is visible.' } }] };
}

const moduleFor = annotate => load('main/utils/android-report.ts', { './android-annotation': { annotateAndroidScreenshot: annotate } });

test('the report keeps familiar round-by-round Markdown and concrete native actions', () => {
  const { formatAndroidReport } = moduleFor(() => {});
  const report = formatAndroidReport({ ...recording(), status: 'completed', finalVerification: { outcome: 'passed', detail: 'Version 17 is visible.', evidence: 'after.png' } }, { 1: 'screen-1-action.png' });
  assert.match(report, /^# User Testing Report for com\.android\.settings/);
  assert.match(report, /## Task Description[\s\S]*## Round 1/);
  for (const field of ['Observation', 'Thought', 'Action', 'Result', 'Summary']) assert.match(report, new RegExp(`\\*\\*${field}:\\*\\*`));
  assert.match(report, /Tap at \(12, 24\)/);
  assert.match(report, /!\[Before action\]\(screen-1-action\.png\)/);
  assert.match(report, /### Reflection[\s\S]*\*\*Decision:\*\* passed/);
  assert.match(report, /## Result[\s\S]*\*\*Outcome:\*\* passed/);
});

test('zero-action blocked runs still have a readable result and observation text cannot embed another image', () => {
  const { formatAndroidReport } = moduleFor(() => {});
  const blocked = { ...recording(), status: 'failed', steps: [], finalVerification: { outcome: 'unverified', detail: 'Sign in before testing.' } };
  assert.match(formatAndroidReport(blocked), /\*\*Outcome:\*\* unverified[\s\S]*Sign in before testing/);
  const r = recording(); r.steps[0].observationBefore = '![external](https://example.invalid/tracking.png)';
  assert.ok(!formatAndroidReport(r).includes('![external]'));
});

test('live report checkpoints update atomically while original screenshots and prior action marks stay unchanged', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'klever-markdown-report-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  let annotations = 0;
  const { writeAndroidReport } = moduleFor(async (source, destination) => { annotations++; await fs.copyFile(source, destination, fs.constants.COPYFILE_EXCL); });
  await fs.writeFile(path.join(directory, 'before.png'), 'original-before');
  await fs.writeFile(path.join(directory, 'after.png'), 'original-after');
  const r = recording();
  await writeAndroidReport(directory, r);
  const file = path.join(directory, `log_report_${path.basename(directory)}.md`);
  assert.match(await fs.readFile(file, 'utf8'), /Outcome:\*\* In progress/);
  r.status = 'completed'; r.finalVerification = { outcome: 'passed', detail: 'Version 17 is visible.' };
  await writeAndroidReport(directory, r);
  assert.match(await fs.readFile(file, 'utf8'), /Outcome:\*\* passed/);
  assert.equal(annotations, 1);
  assert.equal(await fs.readFile(path.join(directory, 'before.png'), 'utf8'), 'original-before');
  assert.equal(await fs.readFile(path.join(directory, 'screen-1-action.png'), 'utf8'), 'original-before');
  assert.ok(!(await fs.readdir(directory)).some(file => file.endsWith('.tmp')));
});

test('a marker failure preserves the report and raw visual evidence rather than hiding the execution', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'klever-markdown-mark-error-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const { writeAndroidReport } = moduleFor(async () => { throw new Error('annotation unavailable'); });
  await writeAndroidReport(directory, recording());
  const report = await fs.readFile(path.join(directory, `log_report_${path.basename(directory)}.md`), 'utf8');
  assert.match(report, /original screenshot is shown/);
  assert.match(report, /!\[Before action\]\(before\.png\)/);
});
