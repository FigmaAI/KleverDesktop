import { useEffect, useState, useRef } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  Box,
  Chip,
  Button,
  ColorPaletteProp,
} from '@mui/joy'
import {
  FolderOpen,
  Stop,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
  Schedule,
  Cancel,
} from '@mui/icons-material'
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutput(task.output || '')
    setIsRunning(task.status === 'running')
  }, [task.output, task.status])

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
      await window.electronAPI.openPath(workspaceDir)
    } catch (error) {
      console.error('Error opening folder:', error)
    }
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <Schedule color="action" />
      case 'running':
        return <PlayArrow color="primary" />
      case 'completed':
        return <CheckCircle color="success" />
      case 'failed':
        return <ErrorIcon color="error" />
      case 'cancelled':
        return <Cancel color="action" />
      default:
        return <Schedule color="action" />
    }
  }

  const getStatusColor = (): ColorPaletteProp => {
    switch (task.status) {
      case 'pending':
        return 'neutral'
      case 'running':
        return 'primary'
      case 'completed':
        return 'success'
      case 'failed':
        return 'danger'
      case 'cancelled':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 1000,
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ModalClose />

        {/* Task Info Header */}
        <Stack spacing={2} mb={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            {getStatusIcon()}
            <Typography level="h4" fontWeight="bold" sx={{ flex: 1 }}>
              {task.name}
            </Typography>
            <Chip
              size="lg"
              variant="soft"
              color={getStatusColor()}
            >
              {task.status}
            </Chip>
          </Stack>

          {task.goal && (
            <Box>
              <Typography level="body-sm" textColor="text.secondary" mb={0.5}>
                Goal:
              </Typography>
              <Typography level="body-md">{task.goal}</Typography>
            </Box>
          )}

          <Stack direction="row" spacing={2} flexWrap="wrap">
            {task.startedAt && (
              <Typography level="body-sm" textColor="text.secondary">
                Started: {new Date(task.startedAt).toLocaleString()}
              </Typography>
            )}
            {task.completedAt && (
              <Typography level="body-sm" textColor="text.secondary">
                Completed: {new Date(task.completedAt).toLocaleString()}
              </Typography>
            )}
          </Stack>

          {/* Action buttons */}
          <Stack direction="row" spacing={1}>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<FolderOpen />}
              onClick={handleOpenFolder}
            >
              Open Folder
            </Button>
            {isRunning && (
              <Button
                size="sm"
                variant="solid"
                color="danger"
                startDecorator={<Stop />}
                onClick={handleStop}
              >
                Stop Task
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Terminal Output */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <Typography level="title-md" fontWeight="bold" mb={1}>
            Terminal Output
          </Typography>
          <Box
            ref={terminalRef}
            sx={{
              bgcolor: '#1e1e1e',
              color: '#d4d4d4',
              p: 2,
              borderRadius: 'sm',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              height: '400px',
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#2d2d2d',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#555',
                borderRadius: '4px',
              },
            }}
          >
            {output || (
              <Typography level="body-sm" sx={{ color: '#888' }}>
                {isRunning ? 'Waiting for output...' : 'No output available'}
              </Typography>
            )}
          </Box>
        </Box>
      </ModalDialog>
    </Modal>
  )
}
