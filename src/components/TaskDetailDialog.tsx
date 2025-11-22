import { useEffect, useState, useRef } from 'react'
import {
  FolderOpen,
  StopCircle,
  CheckCircle,
  AlertCircle,
  Play,
  Clock,
  XCircle,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Task } from '../types/project'

interface TaskDetailDialogProps {
  open: boolean
  onClose: () => void
  task: Task
  projectId: string
  workspaceDir: string
  onTaskUpdated?: () => void
}

export function TaskDetailDialog({
  open,
  onClose,
  task,
  projectId,
  workspaceDir,
  onTaskUpdated,
}: TaskDetailDialogProps) {
  const [output, setOutput] = useState<string>('')
  const [isRunning, setIsRunning] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Reset state when task changes
  useEffect(() => {
    const newOutput = task.output || ''
    if (output !== newOutput) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOutput(newOutput)
    }
    const shouldBeRunning = task.status === 'running'
    if (isRunning !== shouldBeRunning) {
      setIsRunning(shouldBeRunning)
    }
  }, [task.output, task.status, output, isRunning])

  // Setup event listeners when dialog opens
  useEffect(() => {
    if (!open) return

    // Listen to task output events
    const handleTaskOutput = (data: { projectId: string; taskId: string; output: string }) => {
      if (data.projectId === projectId && data.taskId === task.id) {
        setOutput((prev) => prev + data.output)
        // Auto-scroll to bottom
        setTimeout(() => {
          if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight
          }
        }, 10)
      }
    }

    const handleTaskError = (data: { projectId: string; taskId: string; error: string }) => {
      if (data.projectId === projectId && data.taskId === task.id) {
        setOutput((prev) => prev + `[ERROR] ${data.error}`)
      }
    }

    const handleTaskComplete = (data: { projectId: string; taskId: string; code: number }) => {
      if (data.projectId === projectId && data.taskId === task.id) {
        setIsRunning(false)
        onTaskUpdated?.()
      }
    }

    window.electronAPI.onTaskOutput(handleTaskOutput)
    window.electronAPI.onTaskError(handleTaskError)
    window.electronAPI.onTaskComplete(handleTaskComplete)

    return () => {
      window.electronAPI.removeAllListeners('task:output')
      window.electronAPI.removeAllListeners('task:error')
      window.electronAPI.removeAllListeners('task:complete')
    }
  }, [open, task.id, projectId, onTaskUpdated])

  const handleStop = async () => {
    try {
      const result = await window.electronAPI.taskStop(projectId, task.id)
      if (result.success) {
        setIsRunning(false)
        onTaskUpdated?.()
      } else {
        alert(result.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }

  const handleOpenFolder = async () => {
    try {
      // Try to open task result path first if it exists
      if (task.resultPath) {
        const existsResult = await window.electronAPI.fileExists(task.resultPath)
        if (existsResult.success && existsResult.exists) {
          const result = await window.electronAPI.openPath(task.resultPath)
          if (result.success) {
            return
          }
        }
      }

      // Fallback to workspace directory
      const result = await window.electronAPI.openPath(workspaceDir)
      if (!result.success) {
        alert(`Failed to open folder: ${result.error}`)
      }
    } catch (error) {
      console.error('Error opening folder:', error)
      alert('Failed to open folder')
    }
  }

  const getStatusConfig = () => {
    switch (task.status) {
      case 'pending':
        return { icon: Clock, label: 'Pending', variant: 'secondary' as const }
      case 'running':
        return { icon: Play, label: 'Running', variant: 'default' as const }
      case 'completed':
        return { icon: CheckCircle, label: 'Completed', variant: 'default' as const }
      case 'failed':
        return { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const }
      case 'cancelled':
        return { icon: XCircle, label: 'Cancelled', variant: 'secondary' as const }
      default:
        return { icon: Clock, label: 'Unknown', variant: 'secondary' as const }
    }
  }

  const statusConfig = getStatusConfig()
  const StatusIcon = statusConfig.icon

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          {/* Task Info Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <StatusIcon className="h-6 w-6 flex-shrink-0" />
                <DialogTitle className="text-xl font-bold truncate">{task.name}</DialogTitle>
              </div>
              <Badge variant={statusConfig.variant} className="text-base py-1 px-3">
                {statusConfig.label}
              </Badge>
            </div>

            {task.goal && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Goal:</p>
                <p className="text-sm">{task.goal}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {task.startedAt && <p>Started: {new Date(task.startedAt).toLocaleString()}</p>}
              {task.completedAt && (
                <p>Completed: {new Date(task.completedAt).toLocaleString()}</p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleOpenFolder}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Open Folder
              </Button>
              {isRunning && (
                <Button size="sm" variant="destructive" onClick={handleStop}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  Stop Task
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Terminal Output */}
        <div className="flex-1 min-h-0 flex flex-col mt-4">
          <h3 className="text-sm font-semibold mb-2">Terminal Output</h3>
          <div
            ref={terminalRef}
            className={cn(
              'flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-md',
              'font-mono text-sm h-[400px] overflow-y-auto',
              'whitespace-pre-wrap break-words',
              'scrollbar-thin scrollbar-track-[#2d2d2d] scrollbar-thumb-[#555]'
            )}
          >
            {output || (
              <p className="text-gray-500">
                {isRunning ? 'Waiting for output...' : 'No output available'}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
