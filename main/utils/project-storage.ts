/**
 * Project storage utilities
 * Manages reading/writing projects.json and workspace directories
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectsData, TestCase } from '../types';
import { readRunManifest, persistRunRecord, collectRunRecording } from './run-records';
import { getKleverDir } from './app-paths';

/**
 * Get the path to the projects storage file
 * @returns Path to ~/.klever-desktop/projects.json
 */
export function getProjectsStoragePath(): string {
  return path.join(getKleverDir(), 'projects.json');
}

/**
 * Load projects from storage
 * @returns Projects data object
 */
export function loadProjects(): ProjectsData {
  const projectsPath = getProjectsStoragePath();
  if (!fs.existsSync(projectsPath)) return { projects: [] };
  const raw: unknown = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
  const data = normalizeProjectsData(raw);
  let changed = JSON.stringify(data) !== JSON.stringify(raw);
  for (const project of data.projects) {
    for (const task of project.tasks) {
      if (task.manifestPath) continue;
      const manifest = readRunManifest(task.id);
      if (!manifest) { persistRunRecord(project, task); changed = true; }
      else if (!task.manifestPath) { task.manifestPath = manifest.run.manifestPath; changed = true; }
    }
  }
  if (changed) saveProjects(data);
  return data;
}

/** Keep retired platform records recoverable without exposing them to native execution. */
export function normalizeProjectsData(value: unknown): ProjectsData {
  if (!value || typeof value !== 'object' || !Array.isArray((value as ProjectsData).projects)) {
    throw new Error('Project storage is invalid. Existing data has been left untouched.');
  }
  const raw = value as { projects: Record<string, unknown>[]; legacyProjects?: unknown[] };
  const legacyProjects = Array.isArray(raw.legacyProjects) ? [...raw.legacyProjects] : [];
  const projects: ProjectsData['projects'] = [];
  for (const original of raw.projects) {
    if (!original || typeof original !== 'object') {
      legacyProjects.push(original);
      continue;
    }
    if (original.platform !== 'android') {
      const tasks = Array.isArray(original.tasks) ? original.tasks.map((task) => {
        if (!task || typeof task !== 'object') return task;
        if (task.status !== 'pending' && task.status !== 'running') return task;
        return { ...task, status: 'cancelled', isScheduled: false, error: 'This platform is no longer supported.' };
      }) : original.tasks;
      legacyProjects.push({ ...original, status: 'archived', tasks });
      continue;
    }
    if (!Array.isArray(original.tasks)) throw new Error('Project tasks are invalid. Existing data has been left untouched.');
    const testCases: TestCase[] = Array.isArray(original.testCases) ? original.testCases.map(item => ({ ...item })) : [];
    const project = { ...original, testCases, tasks: original.tasks.map((entry) => {
      if (!entry || typeof entry !== 'object') throw new Error('A stored run is invalid. Existing data has been left untouched.');
      const task = { ...entry };
      const legacyMetadata = { ...(task.legacyMetadata || {}) };
      for (const key of ['modelProvider', 'modelName', 'model', 'url', 'coldBoot']) {
        if (task[key] !== undefined) legacyMetadata[key] = task[key];
        delete task[key];
      }
      if (task.metrics && typeof task.metrics === 'object') {
        task.metrics = { ...task.metrics };
        const oldMetrics = { ...(legacyMetadata.metrics || {}) };
        for (const key of ['isLocalModel', 'estimatedCost', 'tokensPerSecond']) {
          if (task.metrics[key] !== undefined) oldMetrics[key] = task.metrics[key];
          delete task.metrics[key];
        }
        if (Object.keys(oldMetrics).length) legacyMetadata.metrics = oldMetrics;
      }
      if (Object.keys(legacyMetadata).length) task.legacyMetadata = legacyMetadata;
      const caseId = typeof task.testCaseId === 'string' ? task.testCaseId : `case_${task.id}`;
      let testCase = testCases.find(item => item.id === caseId);
      if (!testCase) {
        testCase = {
          id: caseId, projectId: String(original.id), name: task.name, goal: task.goal,
          ...(task.description !== undefined ? { description: task.description } : {}),
          ...(task.apkSource ? { apkSource: { ...task.apkSource } } : {}),
          ...(task.maxRounds ? { maxRounds: task.maxRounds } : {}),
          revision: task.caseRevision || 1,
          createdAt: task.createdAt || original.createdAt || '', updatedAt: task.createdAt || original.createdAt || '',
        };
        testCases.push(testCase);
      }
      task.testCaseId = caseId;
      task.projectId = task.projectId || original.id;
      task.caseRevision = task.caseRevision || task.caseSnapshot?.revision || 1;
      task.caseSnapshot = task.caseSnapshot || {
        id: caseId, revision: task.caseRevision, name: task.name, goal: task.goal,
        ...(task.description !== undefined ? { description: task.description } : {}),
        ...(task.apkSource ? { apkSource: { ...task.apkSource } } : {}),
        ...(task.maxRounds ? { maxRounds: task.maxRounds } : {}),
      };
      return task;
    }) };
    projects.push(project as unknown as ProjectsData['projects'][number]);
  }
  return { projects, ...(legacyProjects.length ? { legacyProjects } : {}) };
}

export function saveProjects(data: ProjectsData): void {
  const projectsPath = getProjectsStoragePath();
  fs.mkdirSync(path.dirname(projectsPath), { recursive: true });
  const temporaryPath = `${projectsPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryPath, projectsPath);
}

/**
 * Get the workspace directory for a project
 * @param projectName - Name of the project
 * @returns Path to ~/.klever-desktop/Projects/{projectName}
 *
 * Projects are stored in ~/.klever-desktop/Projects/ for consistency with other app data.
 */
export function getProjectWorkspaceDir(projectName: string): string {
  return path.join(getKleverDir(), 'Projects', projectName);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Path to the directory
 * @returns true if directory exists or was created successfully, false otherwise
 */
export function ensureDirectoryExists(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    // Verify the directory was created
    return fs.existsSync(dirPath);
  } catch (error) {
    console.error('Error creating directory:', error);
    return false;
  }
}

/** Stable directory name for native recordings. */
export function sanitizeAppName(appName: string): string {
  return appName.replace(/ /g, '');
}

/**
 * Delete a directory and all its contents recursively
 * @param dirPath - Path to the directory to delete
 */
export function deleteDirectory(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Clean up zombie tasks on app startup
 * Tasks that were 'running' when the app was terminated will be marked as 'failed'
 * This prevents orphaned running tasks from appearing after restart
 */
export function cleanupZombieTasks(): void {
  try {
    const data = loadProjects();
    let changed = false;
    for (const project of data.projects) {
      for (let index = 0; index < project.tasks.length; index++) {
        const task = project.tasks[index];
        const manifest = readRunManifest(task.id);
        if (manifest?.project.id !== undefined && manifest.project.id !== project.id) {
          throw new Error('A run manifest belongs to another project. Existing data has been left untouched.');
        }
        // A completed canonical record survives a partial project-index write or a later case edit.
        if (manifest?.finalizedAt) {
          if (JSON.stringify(task) !== JSON.stringify(manifest.run)) {
            project.tasks[index] = manifest.run;
            changed = true;
          }
          continue;
        }
        if (task.status === 'running' || task.status === 'cancelled' || task.status === 'failed' || task.status === 'completed') {
          if (task.status === 'running') {
            task.status = 'failed';
            task.error = 'Task was interrupted by app shutdown';
            task.completedAt = new Date().toISOString();
            task.updatedAt = task.completedAt;
          }
          try { collectRunRecording(task); }
          catch (error) { task.recordingError = error instanceof Error ? error.message : 'Unable to recover the run recording.'; }
          persistRunRecord(project, task);
          changed = true;
        }
      }
    }
    if (changed) saveProjects(data);
  } catch (error) {
    console.error('[project-storage] Unable to recover interrupted runs:', error);
  }
}
