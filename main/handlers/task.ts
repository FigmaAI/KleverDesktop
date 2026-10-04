/** Native Android runs execute directly in the Electron main process. */
import { IpcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { loadProjects, saveProjects, sanitizeAppName } from '../utils/project-storage';
import { loadAppConfig } from '../utils/config-storage';
import { startAndroidTest } from '../utils/android-agent';
import { Task, RunRecording, CreateTaskInput } from '../types';
import { createTestCase, createTestRun } from '../utils/testcase-storage';
import { persistRunRecord, readRunManifest, collectRunRecording, getRunManifestPath } from '../utils/run-records';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

interface RunningTest {
  projectId: string;
  taskId: string;
  controller: AbortController;
  completion?: Promise<void>;
  cancelled: boolean;
  finalized: boolean;
  terminalNotified?: boolean;
  notify: (channel: string, data: unknown) => void;
}
const runningTests = new Map<string, RunningTest>();
let shuttingDown = false;

function updateTask(projectId: string, taskId: string, update: (task: Task) => void, options: { finalize?: boolean; collect?: boolean } = { finalize: false }): Task | undefined {
  const data = loadProjects();
  const project = data.projects.find(item => item.id === projectId);
  const task = project?.tasks.find(item => item.id === taskId);
  if (task && project) {
    update(task);
    if (options.collect) {
      try {
        const recording = collectRunRecording(task);
        if (recording) task.metrics = { ...task.metrics, rounds: recording.steps.length };
      }
      catch (error) { task.recordingError = error instanceof Error ? error.message : 'Unable to read run recording.'; }
    }
    persistRunRecord(project, task, { finalize: options.finalize ?? false });
    project.updatedAt = new Date().toISOString();
    saveProjects(data);
  }
  return task;
}

function appendOutput(run: RunningTest, output: string, isError = false): void {
  if (run.finalized || run.cancelled) return;
  updateTask(run.projectId, run.taskId, task => { task.output = (task.output || '') + output; });
  run.notify(isError ? 'task:error' : 'task:output', {
    projectId: run.projectId, taskId: run.taskId, ...(isError ? { error: output } : { output }),
  });
}

function finishTest(run: RunningTest, status: Task['status'], code: number, error?: string, release = true): void {
  if (run.finalized) return;
  if (release) {
    runningTests.delete(run.taskId);
    run.finalized = true;
  }
  try {
    updateTask(run.projectId, run.taskId, current => {
      current.status = status;
      current.updatedAt = new Date().toISOString();
      current.completedAt = current.updatedAt;
      if (error) current.error = error;
      if (current.metrics?.startTime) {
        current.metrics.endTime = Date.now();
        current.metrics.durationMs = current.metrics.endTime - current.metrics.startTime;
      }
    }, { finalize: release, collect: release });
  } catch (error) {
    // A storage failure cannot be hidden as a successful recording or crash the desktop process.
    run.notify('task:error', { projectId: run.projectId, taskId: run.taskId,
      error: `Unable to save the run record: ${error instanceof Error ? error.message : 'storage unavailable'}` });
    if (release) { status = 'failed'; code = 1; }
  }
  if (!run.terminalNotified) {
    run.notify('task:complete', { projectId: run.projectId, taskId: run.taskId, code, status });
    run.terminalNotified = true;
  } else if (release) {
    run.notify('task:recorded', { projectId: run.projectId, taskId: run.taskId });
  }
  if (release && !shuttingDown) scheduleQueueManager.triggerCheck();
}

export function isTaskExecutionActive(): boolean { return runningTests.size > 0; }
export function isProjectExecutionActive(projectId: string): boolean {
  return [...runningTests.values()].some(run => run.projectId === projectId);
}
export { validateApkSource } from '../utils/native-source';

export async function startTaskExecution(projectId: string, taskId: string, getMainWindow: () => BrowserWindow | null): Promise<{ success: boolean; error?: string }> {
  let run: RunningTest | undefined;
  try {
    if (shuttingDown) return { success: false, error: 'The application is shutting down.' };
    if (isTaskExecutionActive()) return { success: false, error: 'Another native test is already running.' };
    const data = loadProjects();
    const project = data.projects.find(item => item.id === projectId);
    const task = project?.tasks.find(item => item.id === taskId);
    if (!project || !task) return { success: false, error: 'Test or project not found.' };
    if (project.platform !== 'android' || project.status !== 'active') return { success: false, error: 'Only active Android projects can run tests.' };
    if (task.status !== 'pending') return { success: false, error: 'Create a new test from the previous test to keep its recording.' };

    const appConfig = loadAppConfig();
    const taskDir = path.join(project.workspaceDir, 'apps', sanitizeAppName(project.name), 'runs', `test_${Date.now()}_${task.id}`);
    fs.mkdirSync(taskDir, { recursive: true });
    run = {
      projectId, taskId, controller: new AbortController(), cancelled: false, finalized: false,
      notify: (channel, payload) => { const window = getMainWindow(); if (window && !window.isDestroyed()) window.webContents.send(channel, payload); },
    };
    const activeRun = run;
    // Reserve native-device ownership before starting the asynchronous agent job.
    runningTests.set(taskId, activeRun);
    const startedTask = updateTask(projectId, taskId, current => {
      current.status = 'running';
      current.startedAt = new Date().toISOString();
      current.updatedAt = current.startedAt;
      delete current.completedAt;
      delete current.error;
      current.output = '';
      current.resultPath = taskDir;
      current.metrics = { startTime: Date.now(), maxRounds: task.maxRounds ?? appConfig.execution.maxRounds };
    });
    activeRun.notify('task:started', { projectId, taskId });
    activeRun.notify('task:progress', { projectId, taskId, metrics: startedTask?.metrics });

    let referenceRecording: RunRecording | undefined;
    if (task.referenceRunId) {
      const reference = project.tasks.find(previous => previous.id === task.referenceRunId && previous.testCaseId === task.testCaseId && previous.status === 'completed');
      try {
        const candidate = reference ? collectRunRecording(reference) : undefined;
        if (candidate?.status === 'completed' && candidate.finalVerification?.outcome === 'passed' &&
            candidate.testCaseId === task.testCaseId && candidate.steps.some(step => step.result === 'executed')) {
          referenceRecording = candidate;
        }
      } catch (error) {
        appendOutput(activeRun, `[Course] Earlier evidence is unavailable: ${error instanceof Error ? error.message : 'unable to read recording'}. Continuing with the saved instructions.\n`);
      }
      if (!referenceRecording) {
        // A deleted/legacy reference must not break the saved test or claim that its course was used.
        updateTask(projectId, taskId, current => { delete current.referenceRunId; });
        appendOutput(activeRun, '[Course] No earlier recorded course is available; continuing with the saved instructions.\n');
      }
    }
    const job = startAndroidTest({
      projectId, taskId, testCaseId: task.testCaseId, testCaseRevision: task.caseSnapshot?.revision || task.caseRevision,
      goal: task.goal, apkSource: task.apkSource, deviceSerial: task.deviceSerial,
      resultPath: taskDir, maxSteps: task.maxRounds ?? appConfig.execution.maxRounds,
      referenceRecording, signal: activeRun.controller.signal,
      onOutput: output => appendOutput(activeRun, output),
      onProgress: metrics => {
        if (activeRun.finalized || activeRun.cancelled) return;
        const updated = updateTask(projectId, taskId, current => { current.metrics = { ...current.metrics, ...metrics }; });
        activeRun.notify('task:progress', { projectId, taskId, metrics: updated?.metrics });
      },
    });
    activeRun.completion = job.then(recording => {
      const status = activeRun.cancelled ? 'cancelled' : recording.status === 'completed' ? 'completed' : recording.status === 'cancelled' ? 'cancelled' : 'failed';
      finishTest(activeRun, status, status === 'completed' ? 0 : status === 'cancelled' ? -1 : 1,
        status === 'failed' ? recording.reason || recording.finalVerification?.detail || 'The test goal was not confirmed.' : undefined);
    }).catch(error => {
      const message = error instanceof Error ? error.message : 'Unable to execute the native test.';
      if (!activeRun.cancelled) {
        try { appendOutput(activeRun, `${message}\n`, true); }
        catch { activeRun.notify('task:error', { projectId, taskId, error: message }); }
      }
      finishTest(activeRun, activeRun.cancelled ? 'cancelled' : 'failed', activeRun.cancelled ? -1 : 1, message);
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start native test.';
    if (run) {
      run.controller.abort();
      if (!run.finalized) {
        try { appendOutput(run, `${message}\n`, true); }
        catch { run.notify('task:error', { projectId, taskId, error: message }); }
      }
      finishTest(run, run.cancelled ? 'cancelled' : 'failed', run.cancelled ? -1 : 1, message);
    }
    return { success: false, error: message };
  }
}

export function registerTaskHandlers(ipcMain: IpcMain, getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === input.projectId);
      if (!project) throw new Error('Project not found.');
      const testCase = createTestCase(project, input);
      const task = createTestRun(project, testCase.id, { scheduledAt: input.scheduledAt, buildLabel: input.buildLabel, deviceSerial: input.deviceSerial });
      persistRunRecord(project, task);
      saveProjects(data);
      if (task.scheduledAt) scheduleQueueManager.triggerCheck();
      return { success: true, task, testCase };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to create test run.' }; }
  });
  ipcMain.handle('task:recording:get', (_event, projectId: string, taskId: string) => {
    try {
      const project = loadProjects().projects.find(item => item.id === projectId);
      const task = project?.tasks.find(item => item.id === taskId);
      if (!project || !task) throw new Error('Test run not found.');
      const recording = collectRunRecording(task);
      const manifest = readRunManifest(task.id);
      return { success: true, recording, manifest };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to read run recording.' }; }
  });
  ipcMain.handle('task:delete', (_event, projectId: string, taskId: string) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === projectId);
      const task = project?.tasks.find(item => item.id === taskId);
      if (!project || !task) return { success: false, error: 'Test not found.' };
      const owner = runningTests.get(taskId);
      if (task.status === 'running' || owner?.projectId === projectId) {
        return { success: false, error: 'Wait for the test to stop and finish saving before deleting it.' };
      }
      const manifest = readRunManifest(task.id);
      if (manifest && manifest.project.id !== projectId) throw new Error('The stored run belongs to another project.');
      const sharedResult = task.resultPath && data.projects.some(otherProject => otherProject.tasks.some(other =>
        (otherProject.id !== projectId || other.id !== taskId) && other.resultPath &&
        path.resolve(other.resultPath) === path.resolve(task.resultPath!),
      ));
      if (task.resultPath && !sharedResult && fs.existsSync(task.resultPath)) {
        fs.rmSync(task.resultPath, { recursive: true, force: true });
      }
      // Explicit deletion purges this run's canonical record too; immutable does not mean undeletable.
      fs.rmSync(getRunManifestPath(task.id), { force: true });
      project.tasks = project.tasks.filter(item => item.id !== taskId);
      if (task.testCaseId && !project.tasks.some(other => other.testCaseId === task.testCaseId)) {
        project.testCases = project.testCases?.filter(testCase => testCase.id !== task.testCaseId);
      }
      project.updatedAt = new Date().toISOString();
      saveProjects(data);
      return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to delete test.' }; }
  });
  ipcMain.handle('task:start', (_event, projectId: string, taskId: string) => startTaskExecution(projectId, taskId, getMainWindow));
  ipcMain.handle('task:stop', (_event, projectId: string, taskId: string) => {
    const run = runningTests.get(taskId);
    if (!run || run.projectId !== projectId) return { success: false, error: 'Test is not running.' };
    run.cancelled = true;
    run.controller.abort();
    // Keep device ownership until preparation/execution actually closes.
    finishTest(run, 'cancelled', -1, undefined, false);
    return { success: true };
  });
}

export async function cleanupTaskProcesses(timeoutMs = 6000): Promise<void> {
  shuttingDown = true;
  const jobs = [...runningTests.values()];
  for (const run of jobs) {
    run.cancelled = true;
    run.controller.abort();
    finishTest(run, 'cancelled', -1, 'Test interrupted by application shutdown.', false);
  }
  let timeout: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    Promise.allSettled(jobs.map(run => run.completion)).then(() => undefined),
    new Promise<void>(resolve => { timeout = setTimeout(resolve, timeoutMs); }),
  ]);
  if (timeout) clearTimeout(timeout);
  for (const run of jobs) {
    if (run.finalized) continue;
    // Unsettled jobs stay unsealed so startup recovery can read the last durable checkpoint.
    try { updateTask(run.projectId, run.taskId, task => { task.recordingError = 'Agent shutdown was not confirmed before the application exited.'; }); }
    catch (error) { run.notify('task:error', { projectId: run.projectId, taskId: run.taskId, error: error instanceof Error ? error.message : 'Unable to save shutdown checkpoint.' }); }
  }
}
