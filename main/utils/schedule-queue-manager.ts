/**
 * Schedule Queue Manager
 * 
 * Manages scheduled task execution with sequential (one-at-a-time) processing.
 * 
 * ## Architecture: Hybrid Polling + Event-Driven
 * 
 * This manager uses a HYBRID approach combining polling and events:
 * 
 * ### 1. POLLING (10-second interval) - For TIME detection
 * - WHY: "Is the scheduled time reached?" has no external event source
 * - Time itself doesn't emit events - we must periodically check
 * - Alternative (setTimeout per schedule) has downsides:
 *   - Lost on app restart (must rebuild all timers)
 *   - Memory overhead for many schedules
 *   - Complex management of timer handles
 * 
 * ### 2. EVENT-DRIVEN - For TASK STATE changes
 * - Task completion/failure calls triggerCheck() immediately
 * - No need to poll task status - we get notified when it changes
 * - This enables immediate start of next queued schedule
 * 
 * ### Sequential Execution Flow:
 * 1. Polling detects: "Schedule A's time has arrived"
 * 2. Check: "Is any task running?" → If yes, wait
 * 3. Execute Schedule A's task
 * 4. Task A completes → triggerCheck() called (EVENT)
 * 5. Check: "Any more due schedules?" → Execute next
 * 
 * ### Why Not Pure setTimeout?
 * - App restart: All timers lost, need to recalculate delays
 * - Far-future schedules: setTimeout may overflow (max ~24.8 days)
 * - Memory: Each setTimeout holds a reference
 * - Complexity: Managing timer cancellation on schedule updates
 * 
 * ### Why Not Pure Polling for Everything?
 * - Task completion: Already have events, no need to poll
 * - Wastes resources checking status that hasn't changed
 * - Event-driven is immediate; polling has latency
 */

import { BrowserWindow } from 'electron';
import { ScheduledTask } from '../types/schedule';
import { loadSchedules, saveSchedules } from './schedule-storage';
import { startTaskExecution } from '../handlers/task';
import { loadProjects } from './project-storage';

export class ScheduleQueueManager {
  private schedules: Map<string, ScheduledTask> = new Map();
  private activeExecution: string | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private getMainWindow: (() => BrowserWindow | null) | null = null;

  /**
   * Initialize on app start
   */
  initialize(getMainWindow: () => BrowserWindow | null): void {
    this.getMainWindow = getMainWindow;
    this.loadSchedules();
    this.startPolling();
    console.log('[schedule-manager] Initialized');
  }

  /**
   * Load schedules from schedules.json
   */
  private loadSchedules(): void {
    const data = loadSchedules();
    // Load all schedules into map
    data.schedules.forEach(s => {
      this.schedules.set(s.id, s);
    });
    console.log(`[schedule-manager] Loaded ${this.schedules.size} schedules`);
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
   * This ensures sequential execution even for manually started tasks
   */
  private checkAnyRunningTask(): boolean {
    try {
      const projectData = loadProjects();
      for (const project of projectData.projects) {
        for (const task of project.tasks) {
          if (task.status === 'running') {
            console.log(`[schedule-manager] Task ${task.id} is running, waiting...`);
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[schedule-manager] Error checking running tasks:', error);
      return false; // Assume no running task on error
    }
  }

  /**
   * Start the time-based polling loop.
   * 
   * PURPOSE: Detect when scheduled times have been reached.
   * 
   * This is the ONLY thing that requires polling - "time arrival" has no event.
   * Task state changes (running → completed) are handled via triggerCheck() events.
   * 
   * Interval: 10 seconds
   * - Fast enough for responsive scheduling
   * - Light enough to not impact performance
   */
  private startPolling(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // 10-second interval: balance between responsiveness and efficiency
    this.checkInterval = setInterval(() => {
      this.checkAndExecuteDue();
    }, 10000);
    
    // Check immediately on startup (app may have been closed when schedule was due)
    this.checkAndExecuteDue();
  }

  /**
   * Check for due schedules and execute the next one
   * NOTE: Polling only checks if scheduled TIME has arrived.
   * Running task detection is event-driven via triggerCheck().
   */
  private async checkAndExecuteDue(): Promise<void> {
    // If we're already executing a scheduled task, skip
    if (this.activeExecution) {
      return;
    }

    const now = Date.now();
    const dueSchedules = Array.from(this.schedules.values())
      .filter(s => s.status === 'pending' && new Date(s.scheduledAt).getTime() <= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

    if (dueSchedules.length === 0) {
      return;
    }

    // Check if any task is currently running before starting
    // This is the only place we check - not in the polling loop
    if (this.checkAnyRunningTask()) {
      console.log('[schedule-manager] Waiting for running task to complete...');
      return;
    }

    const nextSchedule = dueSchedules[0];
    console.log(`[schedule-manager] Starting schedule: ${nextSchedule.id} (${dueSchedules.length} due)`);
    await this.executeSchedule(nextSchedule);
  }

  /**
   * Execute a scheduled task
   */
  private async executeSchedule(schedule: ScheduledTask): Promise<void> {
    if (!this.getMainWindow) {
      console.error('[schedule-manager] Window accessor not initialized');
      return;
    }

    this.activeExecution = schedule.id;
    schedule.status = 'running';
    schedule.executedAt = new Date().toISOString();
    
    // Persist status change
    this.saveAllSchedules();
    this.notifyRenderer('schedule:started', { scheduleId: schedule.id });

    try {
      // Direct execution via extracted handlers function
      const result = await startTaskExecution(
        schedule.projectId,
        schedule.taskId,
        this.getMainWindow,
        { silent: schedule.silent }
      );

      schedule.status = result.success ? 'completed' : 'failed';
      if (!result.success && result.error) {
        schedule.error = result.error;
      }
    } catch (error) {
      schedule.status = 'failed';
      schedule.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[schedule-manager] Execution error for ${schedule.id}:`, error);
    } finally {
      schedule.completedAt = new Date().toISOString();
      this.activeExecution = null;
      
      this.saveAllSchedules();
      this.notifyRenderer('schedule:completed', {
        scheduleId: schedule.id,
        status: schedule.status,
        error: schedule.error
      });

      // Check for next due schedule after a short delay
      setTimeout(() => {
        this.checkAndExecuteDue();
      }, 2000);
    }
  }

  /**
   * Save all schedules to disk
   */
  private saveAllSchedules(): void {
    const schedulesList = Array.from(this.schedules.values());
    saveSchedules({ schedules: schedulesList });
  }

  /**
   * Add new schedule
   */
  addSchedule(projectId: string, taskId: string, scheduledAt: string, silent = true): ScheduledTask {
    const schedule: ScheduledTask = {
      id: `schedule_${Date.now()}`,
      projectId,
      taskId,
      scheduledAt,
      status: 'pending',
      createdAt: new Date().toISOString(),
      silent
    };

    this.schedules.set(schedule.id, schedule);
    this.saveAllSchedules();
    this.notifyRenderer('schedule:added', schedule);

    console.log(`[schedule-manager] Added schedule: ${schedule.id} for task ${taskId} at ${scheduledAt}`);

    // Check if we should execute immediately (if scheduled in past or very near future)
    this.checkAndExecuteDue();

    return schedule;
  }

  /**
   * Cancel schedule
   */
  cancelSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;
    
    if (schedule.status !== 'pending' && schedule.status !== 'running') {
      return false;
    }

    schedule.status = 'cancelled';
    this.saveAllSchedules();
    this.notifyRenderer('schedule:cancelled', { scheduleId });
    console.log(`[schedule-manager] Cancelled schedule: ${scheduleId}`);
    return true;
  }

  /**
   * Get all schedules
   */
  getAllSchedules(): ScheduledTask[] {
    return Array.from(this.schedules.values())
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  /**
   * Trigger an immediate check for due schedules.
   * 
   * CALLED BY: task.ts when any task completes or fails
   * 
   * This is the EVENT-DRIVEN part of our hybrid architecture:
   * - Instead of polling task status, we get notified when it changes
   * - Enables immediate start of next schedule (no 10-second wait)
   * - Called from task.ts process 'close' and 'error' handlers
   */
  triggerCheck(): void {
    console.log('[schedule-manager] Triggered check (task completed)');
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
