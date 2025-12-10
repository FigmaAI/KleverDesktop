import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { ScheduleQueue } from '../types';

/**
 * Get the path to the schedules storage file
 * Uses Electron userData path
 */
export function getSchedulesStoragePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'schedules.json');
}

/**
 * Load schedules from storage
 */
export function loadSchedules(): ScheduleQueue {
  const schedulesPath = getSchedulesStoragePath();

  if (!fs.existsSync(schedulesPath)) {
    return { schedules: [] };
  }

  try {
    const data = fs.readFileSync(schedulesPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading schedules:', error);
    return { schedules: [] };
  }
}

/**
 * Save schedules to storage
 */
export function saveSchedules(data: ScheduleQueue): void {
  const schedulesPath = getSchedulesStoragePath();
  try {
    fs.writeFileSync(schedulesPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving schedules:', error);
  }
}
