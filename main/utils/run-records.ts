import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { AppBuildMetadata, DeviceMetadata, Project, RunManifest, RunRecording, Task } from '../types/project';
import { getKleverDir } from './app-paths';

const MAX_RECORDING_BYTES = 5 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const terminalStatuses = new Set(['completed', 'failed', 'cancelled']);
const taskStatuses = new Set(['pending', 'running', ...terminalStatuses]);
const recordingStatuses = new Set(['running', ...terminalStatuses]);
const actionTypes = new Set(['tap', 'long_press', 'text', 'swipe', 'back', 'enter', 'wait']);

/** IDs become filenames; accepting path syntax here would cross the storage boundary. */
export function getRunManifestPath(runId: string): string {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,179}$/.test(runId)) {
    throw new Error('Invalid run ID.');
  }
  return path.join(getKleverDir(), 'runs', `${runId}.json`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new Error(`Invalid run recording: ${message}`);
}

function stringField(value: Record<string, unknown>, key: string, required = false): void {
  if (value[key] === undefined && !required) return;
  if (typeof value[key] !== 'string' || (required && !(value[key] as string).length)) invalid(`${key} must be a string.`);
}

/** Read regular files through a bounded descriptor, without following a file symlink. */
function readBoundedJSON(filePath: string, maxBytes: number): unknown | undefined {
  let before: fs.Stats;
  try { before = fs.lstatSync(filePath); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink()) throw new Error('Run record must be a regular file.');
  if (before.size > maxBytes) throw new Error('Run record exceeds the permitted size.');
  const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);
  const descriptor = fs.openSync(filePath, flags);
  try {
    const actual = fs.fstatSync(descriptor);
    if (!actual.isFile() || actual.dev !== before.dev || actual.ino !== before.ino) {
      throw new Error('Run record changed while being opened.');
    }
    if (actual.size > maxBytes) throw new Error('Run record exceeds the permitted size.');
    const bytes = Buffer.alloc(Math.min(actual.size + 1, maxBytes + 1));
    let count = 0;
    while (count < bytes.length) {
      const read = fs.readSync(descriptor, bytes, count, bytes.length - count, null);
      if (!read) break;
      count += read;
    }
    // A concurrent writer can grow a file after fstat; never read beyond the bound.
    if (count > maxBytes || (count === bytes.length && fs.fstatSync(descriptor).size > count)) {
      throw new Error('Run record changed or exceeds the permitted size.');
    }
    return JSON.parse(bytes.subarray(0, count).toString('utf8'));
  } finally { fs.closeSync(descriptor); }
}

function insideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

/** Missing evidence remains part of a failed run, but existing ancestors cannot escape. */
function validateEvidence(value: unknown, runDir: string, realRunDir: string): void {
  if (typeof value !== 'string' || !value.length || value.includes('\0')) invalid('evidence must be a relative file path.');
  const normalized = (value as string).replace(/\\/g, '/');
  if (path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || normalized.split('/').includes('..')) {
    invalid('evidence path escapes the run directory.');
  }
  const candidate = path.resolve(runDir, normalized);
  if (!insideDirectory(runDir, candidate) || candidate === runDir) invalid('evidence path escapes the run directory.');
  let ancestor = candidate;
  while (true) {
    try {
      // Broken symlinks also fail: their eventual destination cannot be verified.
      const info = fs.lstatSync(ancestor);
      const resolved = fs.realpathSync(ancestor);
      if (!insideDirectory(realRunDir, resolved)) invalid('evidence symlink escapes the run directory.');
      if (ancestor === candidate && !(info.isSymbolicLink() ? fs.statSync(resolved) : info).isFile()) invalid('evidence must reference a file.');
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      try {
        if (fs.lstatSync(ancestor).isSymbolicLink()) invalid('evidence symlink cannot be resolved.');
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code !== 'ENOENT') throw statError;
      }
      if (ancestor === runDir) invalid('run directory is missing.');
      ancestor = path.dirname(ancestor);
    }
  }
}

function validateFinalVerification(value: unknown, task: Task, runDir: string, realRunDir: string): void {
  if (!isObject(value) || value.source !== 'agent_visual' || !['passed', 'failed', 'unverified'].includes(value.outcome as string)) {
    invalid('final verification is invalid.');
  }
  stringField(value, 'goal', true);
  stringField(value, 'detail');
  if (typeof value.detail !== 'string' || value.goal !== task.goal) invalid('final verification does not match the run goal.');
  if (value.evidence !== undefined) validateEvidence(value.evidence, runDir, realRunDir);
}

function validateRecording(value: unknown, task: Task, runDir: string, realRunDir: string): asserts value is RunRecording {
  if (!isObject(value) || value.schemaVersion !== 1) invalid('unsupported schema.');
  if (value.runId !== undefined && value.runId !== task.id) invalid('run ID does not match the registered task.');
  if (value.goal !== task.goal || typeof value.goal !== 'string') invalid('goal does not match the registered task.');
  if (!recordingStatuses.has(value.status as string)) invalid('status is invalid.');
  const caseId = task.testCaseId ?? task.caseSnapshot?.id;
  const caseRevision = task.caseRevision ?? task.caseSnapshot?.revision;
  if (value.testCaseId !== undefined && value.testCaseId !== caseId) invalid('test case does not match the run.');
  if (value.testCaseRevision !== undefined && (value.testCaseRevision !== caseRevision || !Number.isInteger(value.testCaseRevision))) {
    invalid('test case revision does not match the run.');
  }
  stringField(value, 'startedAt', true);
  stringField(value, 'model');
  stringField(value, 'finishedAt');
  stringField(value, 'reason');
  if (!isObject(value.context) || !isObject(value.context.app) || !isObject(value.context.device)) invalid('context is invalid.');
  for (const key of ['packageName', 'versionName', 'versionCode']) stringField(value.context.app, key);
  for (const key of ['serial', 'manufacturer', 'model', 'androidVersion', 'apiLevel']) stringField(value.context.device, key);
  if (!Array.isArray(value.steps)) invalid('steps must be an array.');
  for (const step of value.steps) {
    if (!isObject(step) || !Number.isInteger(step.index) || (step.index as number) < 0 ||
      !Number.isInteger(step.round) || (step.round as number) < 0 || !['executed', 'failed'].includes(step.result as string)) {
      invalid('step is invalid.');
    }
    stringField(step, 'startedAt', true);
    stringField(step, 'finishedAt');
    stringField(step, 'error');
    if (typeof step.observationBefore !== 'string') invalid('step observation is invalid.');
    stringField(step, 'observationAfter');
    if (!isObject(step.action) || !actionTypes.has(step.action.type as string) || typeof step.action.intent !== 'string') invalid('step action is invalid.');
    if (step.screen !== undefined && (!isObject(step.screen) || !Number.isInteger(step.screen.width) ||
      (step.screen.width as number) <= 0 || !Number.isInteger(step.screen.height) || (step.screen.height as number) <= 0)) {
      invalid('step screen dimensions must be positive integers.');
    }
    for (const key of ['x', 'y', 'endX', 'endY']) {
      if (step.action[key] === undefined) continue;
      const coordinate = step.action[key];
      if (!Number.isInteger(coordinate) || (coordinate as number) < 0) invalid('action coordinates must be nonnegative integers.');
      if (step.screen !== undefined) {
        const screen = step.screen as Record<string, number>;
        const extent = key === 'x' || key === 'endX' ? screen.width : screen.height;
        if ((coordinate as number) >= extent) invalid('action coordinates exceed the recorded screen bounds.');
      }
    }
    if (step.action.durationMs !== undefined && (!Number.isInteger(step.action.durationMs) ||
      (step.action.durationMs as number) < 1 || (step.action.durationMs as number) > 5000)) {
      invalid('action duration must be an integer from 1 to 5000 milliseconds.');
    }
    for (const key of ['text', 'direction', 'distance']) stringField(step.action, key);
    if (step.action.target !== undefined) {
      if (!isObject(step.action.target)) invalid('step action target is invalid.');
      for (const key of ['resourceId', 'text', 'contentDescription', 'className']) stringField(step.action.target, key);
    }
    if (!isObject(step.evidence)) invalid('step evidence is invalid.');
    // An attempted action can fail before its first screenshot is captured.
    if (typeof step.evidence.before !== 'string') invalid('step evidence before must be a string.');
    if (step.evidence.before) validateEvidence(step.evidence.before, runDir, realRunDir);
    for (const key of ['after', 'xml']) {
      if (step.evidence[key] !== undefined) validateEvidence(step.evidence[key], runDir, realRunDir);
    }
    if (step.verification !== undefined) {
      if (!isObject(step.verification) || step.verification.source !== 'agent_visual' ||
        typeof step.verification.decision !== 'string' || typeof step.verification.detail !== 'string') invalid('step verification is invalid.');
    }
  }
  if (value.finalVerification !== undefined) validateFinalVerification(value.finalVerification, task, runDir, realRunDir);
}

function metadata<T>(value: Record<string, unknown>, keys: string[]): T {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as T;
}

/** The caller supplies a registered task, never a renderer-selected recording path. */
export function collectRunRecording(task: Task): RunRecording | undefined {
  if (!task.resultPath) return undefined;
  if (typeof task.resultPath !== 'string' || !path.isAbsolute(task.resultPath)) invalid('result directory must be absolute.');
  const runDir = path.resolve(task.resultPath);
  let info: fs.Stats;
  try { info = fs.lstatSync(runDir); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) invalid('result directory must be a directory.');
  const recordingPath = path.join(runDir, 'recording.json');
  const value = readBoundedJSON(recordingPath, MAX_RECORDING_BYTES);
  if (value === undefined) return undefined;
  validateRecording(value, task, runDir, fs.realpathSync(runDir));
  // Commit metadata only after every path and field has passed validation.
  task.app = metadata<AppBuildMetadata>(value.context.app as Record<string, unknown>, ['packageName', 'versionName', 'versionCode']);
  task.device = metadata<DeviceMetadata>(value.context.device as Record<string, unknown>, ['serial', 'manufacturer', 'model', 'androidVersion', 'apiLevel']);
  task.recordingPath = recordingPath;
  if (value.finalVerification) task.finalVerification = JSON.parse(JSON.stringify(value.finalVerification));
  else delete task.finalVerification;
  return value;
}

function validateManifest(value: unknown, runId: string): asserts value is RunManifest {
  if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.project) || !isObject(value.run) ||
    typeof value.project.id !== 'string' || typeof value.project.name !== 'string' || value.project.platform !== 'android' ||
    value.run.id !== runId || value.run.projectId !== value.project.id || typeof value.run.name !== 'string' ||
    typeof value.run.goal !== 'string' || !taskStatuses.has(value.run.status as string) ||
    (value.finalizedAt !== undefined && typeof value.finalizedAt !== 'string')) {
    throw new Error('Invalid run manifest.');
  }
}

function validateManifestDirectory(directory: string): void {
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || !insideDirectory(fs.realpathSync(getKleverDir()), fs.realpathSync(directory))) {
    throw new Error('Run manifest directory is invalid.');
  }
}

export function readRunManifest(runId: string): RunManifest | undefined {
  const manifestPath = getRunManifestPath(runId);
  try { validateManifestDirectory(path.dirname(manifestPath)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const value = readBoundedJSON(manifestPath, MAX_MANIFEST_BYTES);
  if (value === undefined) return undefined;
  validateManifest(value, runId);
  return value;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Terminal snapshots are immutable; cancellation can remain open until the child exits. */
export function persistRunRecord(project: Project, task: Task, options?: { finalize?: boolean }): RunManifest {
  if (task.projectId !== project.id || project.platform !== 'android') throw new Error('Run does not belong to this native project.');
  const manifestPath = getRunManifestPath(task.id);
  task.manifestPath = manifestPath;
  const directory = path.dirname(manifestPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  validateManifestDirectory(directory);
  const existing = readRunManifest(task.id);
  const manifest: RunManifest = JSON.parse(JSON.stringify({
    schemaVersion: 1,
    project: { id: project.id, name: project.name, platform: project.platform },
    run: task,
    ...(existing?.finalizedAt ? { finalizedAt: existing.finalizedAt } :
      (options?.finalize ?? terminalStatuses.has(task.status)) ? { finalizedAt: new Date().toISOString() } : {}),
  }));
  validateManifest(manifest, task.id);
  if (existing?.finalizedAt) {
    if (canonical(existing) !== canonical(manifest)) throw new Error('Finalized run records cannot be changed.');
    return existing;
  }
  const serialized = JSON.stringify(manifest, null, 2);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_MANIFEST_BYTES) throw new Error('Run manifest exceeds the permitted size.');
  const temporaryPath = path.join(directory, `.${task.id}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temporaryPath, serialized, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, manifestPath);
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
  return manifest;
}
