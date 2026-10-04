import type { IpcMain } from 'electron';
import type { CreateTestCaseInput, UpdateTestCaseInput, CreateTestRunInput } from '../types/project';
import { loadProjects, saveProjects } from '../utils/project-storage';
import { createTestCase, updateTestCase, createTestRun } from '../utils/testcase-storage';
import { persistRunRecord } from '../utils/run-records';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

export function registerTestCaseHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('testcase:create', (_event, input: CreateTestCaseInput) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === input.projectId);
      if (!project) throw new Error('Project not found.');
      const testCase = createTestCase(project, input);
      saveProjects(data);
      return { success: true, testCase };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to save test course.' }; }
  });
  ipcMain.handle('testcase:update', (_event, projectId: string, caseId: string, input: UpdateTestCaseInput) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      const testCase = updateTestCase(project, caseId, input);
      saveProjects(data);
      return { success: true, testCase };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to edit test course.' }; }
  });
  ipcMain.handle('testcase:archive', (_event, projectId: string, caseId: string) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === projectId);
      const testCase = project?.testCases?.find(item => item.id === caseId);
      if (!project || !testCase) throw new Error('Test course not found.');
      testCase.archived = true;
      testCase.updatedAt = new Date().toISOString();
      project.updatedAt = testCase.updatedAt;
      // Queued runs retain their snapshots and existing schedules; archival only prevents creating new runs.
      saveProjects(data);
      return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to archive test course.' }; }
  });
  ipcMain.handle('testcase:run', (_event, projectId: string, caseId: string, input: CreateTestRunInput = {}) => {
    try {
      const data = loadProjects();
      const project = data.projects.find(item => item.id === projectId);
      if (!project) throw new Error('Project not found.');
      const task = createTestRun(project, caseId, input);
      persistRunRecord(project, task);
      saveProjects(data);
      if (task.scheduledAt) scheduleQueueManager.triggerCheck();
      return { success: true, task };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to create test run.' }; }
  });
}
