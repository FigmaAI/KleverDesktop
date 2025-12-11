import { Clock, Play, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import type { TaskStatus } from '@/types/project'

export interface TaskStatusConfig {
  label: string
  icon: React.ElementType
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
  priority: number // For sorting: lower = higher priority
}

/**
 * Get configuration for a task status
 * Unified status display across all components
 */
export function getTaskStatusConfig(status: TaskStatus): TaskStatusConfig {
  switch (status) {
    case 'pending':
      return {
        label: 'Scheduled',
        icon: Clock,
        variant: 'secondary',
        priority: 2,
      }
    case 'running':
      return {
        label: 'Running',
        icon: Play,
        variant: 'default',
        priority: 1,
      }
    case 'completed':
      return {
        label: 'Completed',
        icon: CheckCircle,
        variant: 'default',
        className: 'border-green-500/50 text-green-500 bg-green-500/10',
        priority: 4,
      }
    case 'failed':
      return {
        label: 'Error',
        icon: AlertCircle,
        variant: 'destructive',
        priority: 3,
      }
    case 'cancelled':
      return {
        label: 'Stopped',
        icon: XCircle,
        variant: 'secondary',
        priority: 5,
      }
    default:
      return {
        label: 'Unknown',
        icon: Clock,
        variant: 'secondary',
        priority: 6,
      }
  }
}

