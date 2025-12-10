import { IpcMain } from 'electron';
import { scheduleQueueManager } from '../utils/schedule-queue-manager';

export function registerScheduleHandlers(ipcMain: IpcMain): void {
  // list schedules
  ipcMain.handle('schedule:list', async () => {
    try {
      const schedules = scheduleQueueManager.getAllSchedules();
      return { success: true, schedules };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // cancel schedule
  ipcMain.handle('schedule:cancel', async (_event, scheduleId: string) => {
    try {
      const result = scheduleQueueManager.cancelSchedule(scheduleId);
      return { success: result };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // add schedule
  ipcMain.handle('schedule:add', async (_event, projectId: string, taskId: string, scheduledAt: string, silent: boolean) => {
    console.log('[schedule:add] Called with:', { projectId, taskId, scheduledAt, silent });
    try {
      const schedule = scheduleQueueManager.addSchedule(projectId, taskId, scheduledAt, silent);
      console.log('[schedule:add] Schedule created:', schedule);
      return { success: true, schedule };
    } catch (error: unknown) {
      console.error('[schedule:add] Error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}
