import { randomUUID } from 'crypto';
import type { Project, Task, TestCase, TestCaseSnapshot, CreateTestCaseInput, UpdateTestCaseInput, CreateTestRunInput } from '../types/project';
import { validateApkSource } from './native-source';

function instructions(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Enter ${field}.`);
  return value.trim();
}
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export function snapshotTestCase(testCase: TestCase): TestCaseSnapshot {
  return copy({ id: testCase.id, revision: testCase.revision, name: testCase.name, goal: testCase.goal,
    ...(testCase.description !== undefined ? { description: testCase.description } : {}),
    ...(testCase.apkSource ? { apkSource: testCase.apkSource } : {}),
    ...(testCase.maxRounds ? { maxRounds: testCase.maxRounds } : {}),
  });
}

export function createTestCase(project: Project, input: CreateTestCaseInput): TestCase {
  if (project.status !== 'active') throw new Error('Only active projects can save test courses.');
  const sourceError = validateApkSource(input.apkSource);
  if (sourceError) throw new Error(sourceError);
  const now = new Date().toISOString();
  const testCase: TestCase = {
    id: `case_${randomUUID()}`, projectId: project.id,
    name: instructions(input.name, 'a test course name'), goal: instructions(input.goal, 'test instructions'),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(input.apkSource ? { apkSource: copy(input.apkSource) } : {}),
    ...(typeof input.maxRounds === 'number' && Number.isInteger(input.maxRounds) && input.maxRounds >= 1 && input.maxRounds <= 200 ? { maxRounds: input.maxRounds } : {}),
    revision: 1, createdAt: now, updatedAt: now,
  };
  project.testCases = [...(project.testCases || []), testCase];
  project.updatedAt = now;
  if (testCase.apkSource) project.lastApkSource = copy(testCase.apkSource);
  return testCase;
}

export function updateTestCase(project: Project, caseId: string, input: UpdateTestCaseInput): TestCase {
  const testCase = project.testCases?.find(item => item.id === caseId);
  if (!testCase || testCase.archived || project.status !== 'active') throw new Error('Active test course not found.');
  if (input.apkSource) {
    const sourceError = validateApkSource(input.apkSource);
    if (sourceError) throw new Error(sourceError);
  }
  const next = {
    ...testCase,
    ...(input.name !== undefined ? { name: instructions(input.name, 'a test course name') } : {}),
    ...(input.goal !== undefined ? { goal: instructions(input.goal, 'test instructions') } : {}),
    ...(typeof input.description === 'string' ? { description: input.description } : {}),
    ...(input.apkSource ? { apkSource: copy(input.apkSource) } : {}),
    ...(typeof input.maxRounds === 'number' && Number.isInteger(input.maxRounds) && input.maxRounds >= 1 && input.maxRounds <= 200 ? { maxRounds: input.maxRounds } : {}),
  };
  if (JSON.stringify(snapshotTestCase(next)) !== JSON.stringify(snapshotTestCase(testCase))) {
    next.revision++;
    next.updatedAt = new Date().toISOString();
    Object.assign(testCase, next);
    project.updatedAt = next.updatedAt;
  }
  if (testCase.apkSource) project.lastApkSource = copy(testCase.apkSource);
  return testCase;
}

/** Each request creates its own run; case edits never mutate queued or completed snapshots. */
export function createTestRun(project: Project, caseId: string, input: CreateTestRunInput = {}): Task {
  const testCase = project.testCases?.find(item => item.id === caseId);
  if (!testCase || testCase.archived || project.status !== 'active') throw new Error('Active test course not found.');
  const source = input.apkSource || testCase.apkSource;
  const sourceError = validateApkSource(source);
  if (sourceError) throw new Error(sourceError);
  if (input.deviceSerial !== undefined && (typeof input.deviceSerial !== 'string' || !/^[A-Za-z0-9._:-]{1,200}$/.test(input.deviceSerial))) throw new Error('Select a valid Android device serial.');
  if (input.scheduledAt && !Number.isFinite(Date.parse(input.scheduledAt))) throw new Error('Enter a valid schedule date.');
  let reference: Task | undefined;
  if (input.referenceRunId) {
    reference = project.tasks.find(run => run.id === input.referenceRunId && run.testCaseId === caseId && run.status === 'completed');
    if (!reference) throw new Error('Select a completed run of this test course.');
  } else {
    reference = project.tasks.filter(run => run.testCaseId === caseId && run.status === 'completed' && run.goal === testCase.goal)
      .sort((a, b) => Date.parse(b.completedAt || b.createdAt) - Date.parse(a.completedAt || a.createdAt))[0];
  }
  const now = new Date().toISOString();
  const snapshot = snapshotTestCase(testCase);
  const task: Task = {
    id: `task_${randomUUID()}`, projectId: project.id, testCaseId: caseId,
    caseSnapshot: snapshot, caseRevision: snapshot.revision,
    name: snapshot.name, goal: snapshot.goal, description: snapshot.description,
    ...(source ? { apkSource: copy(source) } : {}),
    ...(snapshot.maxRounds ? { maxRounds: snapshot.maxRounds } : {}),
    ...(typeof input.buildLabel === 'string' && input.buildLabel.trim() ? { buildLabel: input.buildLabel.trim().slice(0, 200) } : {}),
    ...(reference ? { referenceRunId: reference.id } : {}),
    ...(input.deviceSerial ? { deviceSerial: input.deviceSerial } : {}),
    ...(input.scheduledAt ? { scheduledAt: new Date(input.scheduledAt).toISOString(), isScheduled: true } : {}),
    status: 'pending', createdAt: now, updatedAt: now,
  };
  project.tasks.push(task);
  project.updatedAt = now;
  if (source) project.lastApkSource = copy(source);
  return task;
}
