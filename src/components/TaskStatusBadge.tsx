import { StopCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getTaskStatusConfig } from '@/lib/task-status'
import type { TaskStatus } from '@/types/project'

interface TaskStatusBadgeProps {
  status: TaskStatus
  /** Show stop button on hover for running tasks */
  showStopOnHover?: boolean
  /** Callback when stop button is clicked */
  onStop?: (e: React.MouseEvent) => void
  className?: string
}

/**
 * Unified task status badge component
 * Used in TaskContentArea, ScheduledTasks, and TaskDetail
 */
export function TaskStatusBadge({
  status,
  showStopOnHover = false,
  onStop,
  className = '',
}: TaskStatusBadgeProps) {
  const config = getTaskStatusConfig(status)
  const StatusIcon = config.icon
  const isRunning = status === 'running'

  if (isRunning && showStopOnHover && onStop) {
    return (
      <Badge
        variant={config.variant}
        className={`inline-flex items-center gap-1.5 cursor-pointer group hover:bg-destructive hover:text-destructive-foreground transition-colors ${config.className || ''} ${className}`}
        onClick={onStop}
        title="Click to stop"
      >
        <StatusIcon className="h-3 w-3 shrink-0 group-hover:hidden" />
        <StopCircle className="h-3 w-3 shrink-0 hidden group-hover:block" />
        <span className="group-hover:hidden">{config.label}</span>
        <span className="hidden group-hover:inline">Stop</span>
      </Badge>
    )
  }

  return (
    <Badge
      variant={config.variant}
      className={`inline-flex items-center gap-1.5 ${config.className || ''} ${className}`}
    >
      <StatusIcon className="h-3 w-3 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  )
}
