import {
  Play,
  StopCircle,
  Trash2,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Task } from '../types/project'

interface TaskCardProps {
  task: Task
  variant?: 'card' | 'list'
  onStart?: (task: Task) => void
  onStop?: (task: Task) => void
  onDelete?: (task: Task) => void
  onViewMarkdown?: (task: Task) => void
}

export function TaskCard({
  task,
  variant = 'card',
  onStart,
  onStop,
  onDelete,
  onViewMarkdown,
}: TaskCardProps) {
  const getStatusConfig = () => {
    switch (task.status) {
      case 'pending':
        return { label: 'Scheduled', icon: Clock, variant: 'secondary' as const }
      case 'running':
        return { label: 'Running', icon: Play, variant: 'default' as const }
      case 'completed':
        return { label: 'Finished', icon: CheckCircle, variant: 'default' as const }
      case 'failed':
        return { label: 'Error', icon: AlertCircle, variant: 'destructive' as const }
      case 'cancelled':
        return { label: 'Stopped', icon: XCircle, variant: 'secondary' as const }
      default:
        return { label: 'Unknown', icon: Clock, variant: 'secondary' as const }
    }
  }

  const getMetricsText = () => {
    if (!task.metrics) return null

    const parts: string[] = []

    // Rounds
    if (task.metrics.rounds !== undefined) {
      const roundsText = task.metrics.maxRounds
        ? `Round ${task.metrics.rounds}/${task.metrics.maxRounds}`
        : `Round ${task.metrics.rounds}`
      parts.push(roundsText)
    }

    // API model metrics
    if (task.modelProvider === 'api') {
      if (task.metrics.tokens !== undefined && task.metrics.tokens > 0) {
        const tokensText =
          task.metrics.tokens >= 1000
            ? `${(task.metrics.tokens / 1000).toFixed(1)}K tokens`
            : `${task.metrics.tokens} tokens`
        parts.push(tokensText)
      }

      if (task.metrics.estimatedCost !== undefined && task.metrics.estimatedCost > 0) {
        parts.push(`$${task.metrics.estimatedCost.toFixed(4)}`)
      }
    }

    // Local model metrics
    if (task.modelProvider === 'local') {
      if (task.metrics.cpuUsage !== undefined && task.metrics.cpuUsage > 0) {
        parts.push(`CPU ${task.metrics.cpuUsage.toFixed(1)}%`)
      }

      if (task.metrics.memoryUsage !== undefined && task.metrics.memoryUsage > 0) {
        const memoryText =
          task.metrics.memoryUsage >= 1024
            ? `${(task.metrics.memoryUsage / 1024).toFixed(1)}GB`
            : `${task.metrics.memoryUsage.toFixed(0)}MB`
        parts.push(`Memory ${memoryText}`)
      }
    }

    return parts.length > 0 ? parts.join(' • ') : null
  }

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStart?.(task)
  }

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStop?.(task)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete "${task.name}"?`)) {
      onDelete?.(task)
    }
  }

  const handleViewMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewMarkdown?.(task)
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  // Card View
  if (variant === 'card') {
    return (
      <Card className="group relative min-h-[240px] transition-all duration-300 hover:shadow-lg">
        <CardContent className="flex h-full flex-col justify-between pt-6">
          {/* Top Section: Description */}
          <div className="mb-4">
            <p className="line-clamp-2 text-sm text-foreground">
              {task.goal || task.description || 'No description'}
            </p>
          </div>

          {/* Middle Section: Status & Model */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusConfig.variant} className="flex items-center gap-1">
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
            {task.model && (
              <Badge variant="outline" className="text-xs">
                {task.model}
              </Badge>
            )}
          </div>

          {/* Bottom Section: Timestamp and Actions */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {task.startedAt
                ? `Started ${new Date(task.startedAt).toLocaleString()}`
                : `Created ${new Date(task.createdAt).toLocaleDateString()}`}
            </p>

            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {task.status === 'pending' && (
                <Button size="sm" onClick={handleStart} className="h-8">
                  <Play className="mr-1 h-3 w-3" />
                  Start
                </Button>
              )}

              {task.status === 'running' && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleStop}
                  className="h-8"
                >
                  <StopCircle className="mr-1 h-3 w-3" />
                  Stop
                </Button>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={handleViewMarkdown}
                disabled={!task.resultPath}
                title="View Results"
                className="h-8 w-8"
              >
                <FileText className="h-4 w-4" />
              </Button>

              <Button
                size="icon"
                variant="ghost"
                onClick={handleDelete}
                disabled={task.status === 'running'}
                title="Delete Task"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>

        {/* Footer: Metrics */}
        {getMetricsText() && (
          <CardFooter className="border-t bg-muted/50 py-3">
            <p className="text-sm text-muted-foreground">{getMetricsText()}</p>
          </CardFooter>
        )}
      </Card>
    )
  }

  // List View
  return (
    <div className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50">
      <div className="mt-1">
        <StatusIcon className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 space-y-3">
        {/* Task Description */}
        <p className="line-clamp-2 text-sm text-foreground">
          {task.goal || task.description || 'No description'}
        </p>

        {/* Status & Model */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusConfig.variant} className="flex items-center gap-1 text-xs">
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
          {task.model && (
            <Badge variant="outline" className="text-xs">
              {task.model}
            </Badge>
          )}
        </div>

        {/* Metrics */}
        {getMetricsText() && (
          <p className="text-sm text-muted-foreground">{getMetricsText()}</p>
        )}

        {/* Bottom: Timestamp and Actions */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {task.startedAt
              ? `Started ${new Date(task.startedAt).toLocaleString()}`
              : `Created ${new Date(task.createdAt).toLocaleDateString()}`}
          </p>

          <div className="flex gap-1">
            {task.status === 'pending' && (
              <Button size="sm" onClick={handleStart} className="h-8">
                <Play className="mr-1 h-3 w-3" />
                Start
              </Button>
            )}

            {task.status === 'running' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
                className="h-8"
              >
                <StopCircle className="mr-1 h-3 w-3" />
                Stop
              </Button>
            )}

            <Button
              size="icon"
              variant="ghost"
              onClick={handleViewMarkdown}
              disabled={!task.resultPath}
              title="View Results"
              className="h-8 w-8"
            >
              <FileText className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              disabled={task.status === 'running'}
              title="Delete Task"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
