/** Dispatch scheduled native tests in the main process, including when the window is closed. */
import { BrowserWindow } from 'electron';
import { loadProjects, saveProjects } from './project-storage';
import { startTaskExecution, isTaskExecutionActive } from '../handlers/task';
import { Task } from '../types';
import { persistRunRecord } from './run-records';

export class ScheduleQueueManager {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private isExecuting = false;

  initialize(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = setInterval(() => { void this.checkAndExecuteDue(); }, 10000);
    void this.checkAndExecuteDue();
  }

  private notify(channel: string, data: unknown): void {
    const win = this.getMainWindow?.();
    if (win && !win.isDestroyed()) win.webContents.send(channel, data);
  }

  private async checkAndExecuteDue(): Promise<void> {
    if (this.isExecuting || isTaskExecutionActive() || !this.getMainWindow) return;
    this.isExecuting = true;
    try {
      const data = loadProjects();
      if (data.projects.some(project => project.tasks.some(task => task.status === 'running'))) return;
      const due = data.projects.filter(project => project.status === 'active' && project.platform === 'android')
        .flatMap(project => project.tasks.filter(task => task.status === 'pending' && task.scheduledAt && Date.parse(task.scheduledAt) <= Date.now())
          .map(task => ({ projectId: project.id, task })))
        .sort((a, b) => Date.parse(a.task.scheduledAt!) - Date.parse(b.task.scheduledAt!));
      const next = due[0];
      if (!next) return;
      const result = await startTaskExecution(next.projectId, next.task.id, this.getMainWindow);
      if (result.success) {
        this.notify('schedule:started', { projectId: next.projectId, taskId: next.task.id });
      } else {
        // A rejected scheduled start is a recorded failure, so it cannot loop forever and starve the queue.
        const latest = loadProjects();
        const task = latest.projects.find(project => project.id === next.projectId)?.tasks.find(task => task.id === next.task.id);
        if (task?.status === 'pending') {
          task.status = 'failed';
          task.error = result.error || 'Unable to start scheduled test.';
          task.completedAt = new Date().toISOString();
          task.updatedAt = task.completedAt;
          task.output = (task.output || '') + `${task.error}\n`;
          const project = latest.projects.find(project => project.id === next.projectId)!;
          persistRunRecord(project, task);
          saveProjects(latest);
          this.notify('task:complete', { projectId: next.projectId, taskId: task.id, code: 1, status: 'failed' });
        }
        this.notify('schedule:failed', { projectId: next.projectId, taskId: next.task.id, error: result.error });
      }
    } catch (error) {
      console.error('[schedule-manager] Unable to dispatch scheduled test:', error);
    } finally { this.isExecuting = false; }
  }

  getScheduledTasks(): { projectId: string; projectName: string; task: Task }[] {
    return loadProjects().projects.filter(project => project.status === 'active')
      .flatMap(project => project.tasks.filter(task => task.scheduledAt)
        .map(task => ({ projectId: project.id, projectName: project.name, task })))
      .sort((a, b) => Date.parse(a.task.scheduledAt!) - Date.parse(b.task.scheduledAt!));
  }

  scheduleTask(projectId: string, taskId: string, scheduledAt: string): { success: boolean; error?: string } {
    try {
      if (!Number.isFinite(Date.parse(scheduledAt))) return { success: false, error: 'Enter a valid schedule date.' };
      const data = loadProjects();
      const project = data.projects.find(project => project.id === projectId);
      const task = project?.tasks.find(task => task.id === taskId);
      if (!project || !task || project.status !== 'active') return { success: false, error: 'Active project or test not found.' };
      if (task.status !== 'pending') return { success: false, error: 'Create a new test to schedule another run.' };
      task.scheduledAt = new Date(scheduledAt).toISOString();
      task.isScheduled = true;
      task.updatedAt = new Date().toISOString();
      persistRunRecord(project, task);
      saveProjects(data);
      this.notify('schedule:added', { projectId, taskId, scheduledAt: task.scheduledAt });
      void this.checkAndExecuteDue();
      return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to schedule test.' }; }
  }

  cancelSchedule(projectId: string, taskId: string): { success: boolean; error?: string } {
    try {
      const data = loadProjects();
      const project = data.projects.find(project => project.id === projectId);
      const task = project?.tasks.find(task => task.id === taskId);
      if (!task || !task.scheduledAt) return { success: false, error: 'Scheduled test not found.' };
      if (task.status !== 'pending') return { success: false, error: 'Only a pending schedule can be cancelled.' };
      delete task.scheduledAt;
      task.isScheduled = false;
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      task.completedAt = task.updatedAt;
      persistRunRecord(project!, task);
      saveProjects(data);
      this.notify('schedule:cancelled', { projectId, taskId });
      return { success: true };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Unable to cancel schedule.' }; }
  }

  triggerCheck(): void { void this.checkAndExecuteDue(); }
  shutdown(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkInterval = null;
    this.getMainWindow = null;
  }
}
export const scheduleQueueManager = new ScheduleQueueManager();
