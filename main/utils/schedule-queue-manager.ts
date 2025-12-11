/**
 * Schedule Queue Manager (Simplified)
 * 
 * Manages scheduled task execution based on Task.scheduledAt field.
 * No separate schedules.json - uses projects.json as single source of truth.
 * 
 * ## How it works:
 * 1. Polls projects.json every 10 seconds for tasks with scheduledAt in the past
 * 2. Executes due tasks one at a time (sequential execution)
 * 3. Task completion updates status in projects.json
 */

import { BrowserWindow } from 'electron';
import { loadProjects, saveProjects } from './project-storage';
import { startTaskExecution } from '../handlers/task';
import { Task } from '../types';

export class ScheduleQueueManager {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private getMainWindow: (() => BrowserWindow | null) | null = null;
  private isExecuting = false;

  /**
   * Initialize on app start
   */
  initialize(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;
    this.startPolling();
    console.log('[schedule-manager] Initialized (Task-based scheduling)');
  }

  /**
   * Helper to notify renderer of schedule changes
   */
  private notifyRenderer(channel: string, data: unknown): void {
    if (this.getMainWindow) {
      const win = this.getMainWindow();
      win?.webContents.send(channel, data);
    }
  }

  /**
   * Check if any task is currently running (from any project)
   */
  private checkAnyRunningTask(): boolean {
    try {
      const projectData = loadProjects();
      for (const project of projectData.projects) {
        for (const task of project.tasks) {
          if (task.status === 'running') {
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[schedule-manager] Error checking running tasks:', error);
      return false;
    }
  }

  /**
   * Start the polling loop (10 seconds interval)
   */
  private startPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteDue();
    }, 10000);
    
    // Check immediately on startup
    this.checkAndExecuteDue();
  }

  /**
   * Find and execute due scheduled tasks
   */
  private async checkAndExecuteDue(): Promise<void> {
    if (this.isExecuting) {
      return;
    }

    // Check if any task is currently running
    if (this.checkAnyRunningTask()) {
      return;
    }

    const now = Date.now();
    const projectData = loadProjects();
    
    // Find all due tasks (scheduledAt in the past, status is pending)
    const dueTasks: { projectId: string; task: Task }[] = [];
    
    for (const project of projectData.projects) {
      for (const task of project.tasks) {
        if (
          task.scheduledAt &&
          task.status === 'pending' &&
          new Date(task.scheduledAt).getTime() <= now
        ) {
          dueTasks.push({ projectId: project.id, task });
        }
      }
    }

    if (dueTasks.length === 0) {
      return;
    }

    // Sort by scheduledAt (oldest first)
    dueTasks.sort((a, b) => 
      new Date(a.task.scheduledAt!).getTime() - new Date(b.task.scheduledAt!).getTime()
    );

    const nextTask = dueTasks[0];
    console.log(`[schedule-manager] Starting scheduled task: ${nextTask.task.id} (${dueTasks.length} due)`);
    
    await this.executeScheduledTask(nextTask.projectId, nextTask.task.id);
  }

  /**
   * Execute a scheduled task
   */
  private async executeScheduledTask(projectId: string, taskId: string): Promise<void> {
    if (!this.getMainWindow) {
      console.error('[schedule-manager] Window accessor not initialized');
      return;
    }

    this.isExecuting = true;

    try {
      console.log(`[schedule-manager] Executing task ${taskId}`);
      
      const result = await startTaskExecution(projectId, taskId, this.getMainWindow);

      if (result.success) {
        // Notify renderer AFTER task status has been updated to 'running'
        // This ensures frontend receives the correct state when refreshing
        this.notifyRenderer('schedule:started', { projectId, taskId });
      } else {
        console.error(`[schedule-manager] Failed to start task ${taskId}:`, result.error);
        this.notifyRenderer('schedule:failed', { projectId, taskId, error: result.error });
      }
      
    } catch (error) {
      console.error(`[schedule-manager] Execution error for ${taskId}:`, error);
      this.notifyRenderer('schedule:failed', { 
        projectId, 
        taskId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Get all scheduled tasks from projects
   * Returns tasks that have scheduledAt set
   */
  getScheduledTasks(): { projectId: string; projectName: string; task: Task }[] {
    const projectData = loadProjects();
    const scheduledTasks: { projectId: string; projectName: string; task: Task }[] = [];
    
    for (const project of projectData.projects) {
      for (const task of project.tasks) {
        if (task.scheduledAt) {
          scheduledTasks.push({
            projectId: project.id,
            projectName: project.name,
            task
          });
        }
      }
    }
    
    // Sort by scheduledAt
    scheduledTasks.sort((a, b) => 
      new Date(a.task.scheduledAt!).getTime() - new Date(b.task.scheduledAt!).getTime()
    );
    
    return scheduledTasks;
  }

  /**
   * Schedule a task (set scheduledAt)
   */
  scheduleTask(projectId: string, taskId: string, scheduledAt: string): { success: boolean; error?: string } {
    try {
      const projectData = loadProjects();
      const project = projectData.projects.find(p => p.id === projectId);
      
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      
      const task = project.tasks.find(t => t.id === taskId);
      
      if (!task) {
        return { success: false, error: 'Task not found' };
      }
      
      task.scheduledAt = scheduledAt;
      task.updatedAt = new Date().toISOString();
      
      saveProjects(projectData);
      
      console.log(`[schedule-manager] Task ${taskId} scheduled for ${scheduledAt}`);
      this.notifyRenderer('schedule:added', { projectId, taskId, scheduledAt });
      
      // Check if we should execute immediately
      this.checkAndExecuteDue();
      
      return { success: true };
    } catch (error) {
      console.error('[schedule-manager] Error scheduling task:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Cancel a scheduled task (remove scheduledAt)
   */
  cancelSchedule(projectId: string, taskId: string): { success: boolean; error?: string } {
    try {
      const projectData = loadProjects();
      const project = projectData.projects.find(p => p.id === projectId);
      
      if (!project) {
        return { success: false, error: 'Project not found' };
      }
      
      const task = project.tasks.find(t => t.id === taskId);
      
      if (!task) {
        return { success: false, error: 'Task not found' };
      }
      
      if (!task.scheduledAt) {
        return { success: false, error: 'Task is not scheduled' };
      }
      
      // Remove schedule and mark task as cancelled
      delete task.scheduledAt;
      task.status = 'cancelled';
      task.updatedAt = new Date().toISOString();
      
      saveProjects(projectData);
      
      console.log(`[schedule-manager] Schedule cancelled for task ${taskId}`);
      this.notifyRenderer('schedule:cancelled', { projectId, taskId });
      
      return { success: true };
    } catch (error) {
      console.error('[schedule-manager] Error cancelling schedule:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Trigger an immediate check for due schedules
   * Called when a task completes
   */
  triggerCheck(): void {
    console.log('[schedule-manager] Triggered check');
    this.checkAndExecuteDue();
  }

  /**
   * Shutdown
   */
  shutdown(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

// Singleton
export const scheduleQueueManager = new ScheduleQueueManager();
