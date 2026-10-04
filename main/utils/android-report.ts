/** The familiar linear Markdown report, backed by the internal structured recording. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { annotateAndroidScreenshot } from './android-annotation';
import type { RecordedAction, RunRecording } from '../types/project';

function text(value: string): string {
  return value.replace(/[\\`*_{}[\]<>#|!]/g, '\\$&');
}

function actionDescription(action: RecordedAction): string {
  switch (action.type) {
    case 'tap': return `Tap at (${action.x}, ${action.y})`;
    case 'swipe': return `Swipe from (${action.x}, ${action.y}) to (${action.endX}, ${action.endY}), ${action.durationMs} ms`;
    case 'text': return `Enter requested text: ${text(JSON.stringify(action.text || ''))}`;
    case 'wait': return `Wait ${action.durationMs} ms`;
    case 'back': return 'Press Back';
    case 'enter': return 'Press Enter';
  }
}

export function formatAndroidReport(recording: RunRecording, marks: Record<number, string> = {}, notes: Record<number, string> = {}): string {
  const lines = [
    `# User Testing Report for ${text(recording.context.app.packageName || 'Android app')}`, '',
    '## Task Description', '', recording.goal, '',
  ];
  if (recording.context.app.packageName) lines.push(`App: ${text(recording.context.app.packageName)} · ${text(recording.context.app.versionName || 'unknown version')}`, '');
  if (recording.context.device.model) lines.push(`Device: ${text(recording.context.device.model)} · Android ${text(recording.context.device.androidVersion || '')}`, '');
  for (const step of recording.steps) {
    const pending = recording.status === 'running' && !step.finishedAt;
    lines.push(`## Round ${step.round}`, '',
      `**Observation:** ${text(step.observationBefore)}`, '',
      `**Thought:** ${text(step.action.intent)}`, '',
      `**Action:** ${actionDescription(step.action)}`, '',
      `**Result:** ${pending ? 'In progress' : step.result}${step.error ? ` — ${text(step.error)}` : ''}`, '',
      '| Before action | After action |', '| --- | --- |',
      `| ![Before action](${marks[step.index] || step.evidence.before}) | ${step.evidence.after ? `![After action](${step.evidence.after})` : '—'} |`, '',
    );
    if (notes[step.index]) lines.push(`**Screenshot note:** ${text(notes[step.index])}`, '');
    if (step.observationAfter) lines.push(`**Summary:** ${text(step.observationAfter)}`, '');
    if (step.verification) lines.push('### Reflection', '',
      `**Decision:** ${text(step.verification.decision)}`, '',
      `**Thought:** ${text(step.verification.detail)}`, '');
  }
  lines.push('## Result', '',
    `**Outcome:** ${recording.finalVerification?.outcome || 'In progress'}`, '',
    text(recording.finalVerification?.detail || recording.reason || ''), '');
  if (recording.finalVerification?.evidence) lines.push(`![Final screen](${recording.finalVerification.evidence})`, '');
  return lines.join('\n');
}

/** Checkpoints replace only the current run's report; original evidence stays untouched. */
export async function writeAndroidReport(directory: string, recording: RunRecording): Promise<void> {
  const marks: Record<number, string> = {};
  const notes: Record<number, string> = {};
  for (const step of recording.steps) {
    if (!step.screen || !['tap', 'swipe'].includes(step.action.type)) continue;
    const name = `screen-${step.index}-action.png`;
    const destination = path.join(directory, name);
    try {
      try { await fs.access(destination); }
      catch { await annotateAndroidScreenshot(path.join(directory, step.evidence.before), destination, step.action, step.screen); }
      marks[step.index] = name;
    } catch {
      notes[step.index] = 'The action marker could not be generated; the original screenshot is shown.';
    }
  }
  const target = path.join(directory, `log_report_${path.basename(directory)}.md`);
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, formatAndroidReport(recording, marks, notes), { mode: 0o600, flag: 'wx' });
    await fs.rename(temporary, target);
  } finally { await fs.rm(temporary, { force: true }); }
}
