export interface ScheduledTask {
  id: string;
  projectId: string;
  taskId: string;
  scheduledAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  completedAt?: string;
  error?: string;
  silent: boolean;
}
