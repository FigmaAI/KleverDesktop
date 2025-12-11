import { IpcMain } from 'electron';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

export function registerScheduleHandlers(ipcMain: IpcMain): void {
  // List all scheduled tasks (from projects.json)
  ipcMain.handle('schedule:list', async () => {
    try {
      const scheduledTasks = scheduleQueueManager.getScheduledTasks();
      return { success: true, scheduledTasks };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Schedule a task (set scheduledAt on task)
  ipcMain.handle('schedule:add', async (_event, projectId: string, taskId: string, scheduledAt: string) => {
    console.log('[schedule:add] Called with:', { projectId, taskId, scheduledAt });
    try {
      const result = scheduleQueueManager.scheduleTask(projectId, taskId, scheduledAt);
      console.log('[schedule:add] Result:', result);
      return result;
    } catch (error: unknown) {
      console.error('[schedule:add] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Cancel a scheduled task (remove scheduledAt from task)
  ipcMain.handle('schedule:cancel', async (_event, projectId: string, taskId: string) => {
    console.log('[schedule:cancel] Called with:', { projectId, taskId });
    try {
      const result = scheduleQueueManager.cancelSchedule(projectId, taskId);
      return result;
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
