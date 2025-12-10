export interface ScheduledTask {
  id: string;                    // Unique schedule ID (schedule_${timestamp})
  projectId: string;
  taskId: string;
  scheduledAt: string;           // ISO datetime
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  error?: string;
  // Silent execution flag
  silent: boolean;               // Don't open terminal, don't show toast (optional notification only)
}

export interface ScheduleQueue {
  schedules: ScheduledTask[];
}
