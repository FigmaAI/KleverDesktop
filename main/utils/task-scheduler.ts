/**
 * Task Scheduler Service
 * Manages scheduled tasks and executes them at the specified time
 */

import { BrowserWindow } from 'electron';
import { loadProjects, saveProjects } from './project-storage';
import { Task } from '../types';

interface ScheduledTaskInfo {
  projectId: string;
  taskId: string;
  scheduledAt: string;
  timeoutId: NodeJS.Timeout;
}

class TaskScheduler {
  private scheduledTasks: Map<string, ScheduledTaskInfo> = new Map();
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private taskStartHandler: ((projectId: string, taskId: string) => Promise<void>) | null = null;

  /**
   * Initialize the scheduler with window accessor and task start handler
   */
  initialize(
    getMainWindow: () => BrowserWindow | null,
    taskStartHandler: (projectId: string, taskId: string) => Promise<void>
  ): void {
    this.getMainWindow = getMainWindow;
    this.taskStartHandler = taskStartHandler;

    // Load and schedule all existing scheduled tasks
    this.loadScheduledTasks();
  }

  /**
   * Load all scheduled tasks from projects.json and schedule them
   */
  private loadScheduledTasks(): void {
    try {
      const data = loadProjects();

      for (const project of data.projects) {
        for (const task of project.tasks) {
          if (task.isScheduled && task.scheduledAt && task.status === 'pending') {
            this.scheduleTask(project.id, task);
          }
        }
      }

      console.log(`[task-scheduler] Loaded ${this.scheduledTasks.size} scheduled tasks`);
    } catch (error) {
      console.error('[task-scheduler] Failed to load scheduled tasks:', error);
    }
  }

  /**
   * Schedule a task to run at the specified time
   */
  scheduleTask(projectId: string, task: Task): void {
    if (!task.scheduledAt || !task.isScheduled) {
      console.warn('[task-scheduler] Task is not configured for scheduling:', task.id);
      return;
    }

    const scheduledTime = new Date(task.scheduledAt).getTime();
    const now = Date.now();
    const delay = scheduledTime - now;

    // If the scheduled time is in the past, execute immediately
    if (delay <= 0) {
      console.log(`[task-scheduler] Scheduled time is in the past, executing immediately: ${task.id}`);
      this.executeScheduledTask(projectId, task.id);
      return;
    }

    // Cancel existing schedule if any
    this.cancelTask(task.id);

    // Schedule the task
    const timeoutId = setTimeout(() => {
      this.executeScheduledTask(projectId, task.id);
    }, delay);

    this.scheduledTasks.set(task.id, {
      projectId,
      taskId: task.id,
      scheduledAt: task.scheduledAt,
      timeoutId,
    });

    console.log(`[task-scheduler] Scheduled task ${task.id} to run at ${task.scheduledAt}`);

    // Notify renderer about the scheduled task
    this.notifyRenderer('task:scheduled', {
      taskId: task.id,
      projectId,
      scheduledAt: task.scheduledAt,
    });
  }

  /**
   * Cancel a scheduled task
   */
  cancelTask(taskId: string): void {
    const scheduled = this.scheduledTasks.get(taskId);
    if (scheduled) {
      clearTimeout(scheduled.timeoutId);
      this.scheduledTasks.delete(taskId);
      console.log(`[task-scheduler] Cancelled scheduled task: ${taskId}`);

      // Notify renderer
      this.notifyRenderer('task:schedule-cancelled', { taskId });
    }
  }

  /**
   * Execute a scheduled task
   */
  private async executeScheduledTask(projectId: string, taskId: string): Promise<void> {
    console.log(`[task-scheduler] Executing scheduled task: ${taskId}`);

    // Remove from scheduled tasks
    this.scheduledTasks.delete(taskId);

    try {
      // Update task to remove scheduling flags
      const data = loadProjects();
      const project = data.projects.find((p) => p.id === projectId);

      if (!project) {
        console.error(`[task-scheduler] Project not found: ${projectId}`);
        return;
      }

      const task = project.tasks.find((t) => t.id === taskId);

      if (!task) {
        console.error(`[task-scheduler] Task not found: ${taskId}`);
        return;
      }

      // Clear scheduling flags
      task.isScheduled = false;
      task.updatedAt = new Date().toISOString();

      saveProjects(data);

      // Notify renderer that task is starting
      this.notifyRenderer('task:schedule-triggered', {
        taskId,
        projectId,
      });

      // Execute the task using the provided handler
      if (this.taskStartHandler) {
        await this.taskStartHandler(projectId, taskId);
      } else {
        console.error('[task-scheduler] Task start handler not initialized');
      }
    } catch (error) {
      console.error(`[task-scheduler] Failed to execute scheduled task ${taskId}:`, error);

      // Notify renderer about the error
      this.notifyRenderer('task:schedule-error', {
        taskId,
        projectId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): ScheduledTaskInfo[] {
    return Array.from(this.scheduledTasks.values());
  }

  /**
   * Reschedule a task (cancel old schedule and create new one)
   */
  rescheduleTask(projectId: string, task: Task): void {
    this.cancelTask(task.id);
    this.scheduleTask(projectId, task);
  }

  /**
   * Send notification to renderer process
   */
  private notifyRenderer(channel: string, data: unknown): void {
    if (this.getMainWindow) {
      const mainWindow = this.getMainWindow();
      mainWindow?.webContents.send(channel, data);
    }
  }

  /**
   * Shutdown the scheduler (cancel all scheduled tasks)
   */
  shutdown(): void {
    console.log('[task-scheduler] Shutting down, cancelling all scheduled tasks');

    for (const [taskId] of this.scheduledTasks) {
      this.cancelTask(taskId);
    }
  }
}

// Singleton instance
export const taskScheduler = new TaskScheduler();
