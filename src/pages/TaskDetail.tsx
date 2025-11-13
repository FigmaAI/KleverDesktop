import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Sheet,
  Stack,
  Typography,
} from '@mui/joy'
import {
  ArrowBack,
  PlayArrow,
  Stop,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Cancel,
} from '@mui/icons-material'
import type { Project, Task } from '../types/project'

export function TaskDetail() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTaskData()
  }, [projectId, taskId])

  useEffect(() => {
    // Set up event listeners for task output
    if (!projectId || !taskId) return

    const handleOutput = (data: { projectId: string; taskId: string; output: string }) => {
      if (data.projectId === projectId && data.taskId === taskId) {
        setOutput((prev) => prev + data.output)
        // Auto-scroll to bottom
        setTimeout(() => {
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight
          }
        }, 100)
      }
    }

    const handleError = (data: { projectId: string; taskId: string; error: string }) => {
      if (data.projectId === projectId && data.taskId === taskId) {
        setError((prev) => prev + data.error)
      }
    }

    const handleComplete = (data: { projectId: string; taskId: string; code: number }) => {
      if (data.projectId === projectId && data.taskId === taskId) {
        loadTaskData() // Reload to get updated status
      }
    }

    window.electronAPI.onTaskOutput(handleOutput)
    window.electronAPI.onTaskError(handleError)
    window.electronAPI.onTaskComplete(handleComplete)

    return () => {
      window.electronAPI.removeAllListeners('task:output')
      window.electronAPI.removeAllListeners('task:error')
      window.electronAPI.removeAllListeners('task:complete')
    }
  }, [projectId, taskId])

  const loadTaskData = async () => {
    if (!projectId || !taskId) return

    setLoading(true)
    try {
      const result = await window.electronAPI.projectGet(projectId)
      if (result.success && result.project) {
        setProject(result.project)
        const foundTask = result.project.tasks.find((t) => t.id === taskId)
        if (foundTask) {
          setTask(foundTask)
          setOutput(foundTask.output || '')
          setError(foundTask.error || '')
        }
      }
    } catch (error) {
      console.error('Error loading task:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    if (!projectId || !taskId) return

    try {
      setOutput('')
      setError('')
      const result = await window.electronAPI.taskStart(projectId, taskId)
      if (result.success) {
        loadTaskData()
      } else {
        alert(`Failed to start task: ${result.error}`)
      }
    } catch (error) {
      console.error('Error starting task:', error)
      alert('Failed to start task')
    }
  }

  const handleStop = async () => {
    if (!projectId || !taskId) return

    try {
      const result = await window.electronAPI.taskStop(projectId, taskId)
      if (result.success) {
        loadTaskData()
      } else {
        alert(`Failed to stop task: ${result.error}`)
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }

  const getStatusIcon = (status?: Task['status']) => {
    if (!status) return <Schedule />
    switch (status) {
      case 'pending':
        return <Schedule />
      case 'running':
        return <PlayArrow />
      case 'completed':
        return <CheckCircle />
      case 'failed':
        return <ErrorIcon />
      case 'cancelled':
        return <Cancel />
      default:
        return <Schedule />
    }
  }

  const getStatusColor = (status?: Task['status']) => {
    if (!status) return 'neutral'
    switch (status) {
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

  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Loading task...</Typography>
      </Box>
    )
  }

  if (!project || !task) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
        <Box sx={{ p: 4, flex: 1 }}>
          <Typography>Task not found</Typography>
          <Button onClick={() => navigate(`/projects/${projectId}`)} sx={{ mt: 2 }}>
            Back to Project
          </Button>
        </Box>
      </Box>
    )
  }

  const isRunning = task.status === 'running'
  const canStart = task.status === 'pending' || task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Stack spacing={3}>
          <Button
            variant="plain"
            color="neutral"
            startDecorator={<ArrowBack />}
            onClick={() => navigate(`/projects/${projectId}`)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Back to Project
          </Button>

          {/* Task Header */}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                <Box>
                  <Typography level="h2" fontWeight="bold">
                    {task.name}
                  </Typography>
                  <Typography level="body-sm" textColor="text.secondary">
                    {project.name}
                  </Typography>
                </Box>

                <Chip
                  size="lg"
                  variant="soft"
                  color={getStatusColor(task.status) as any}
                  startDecorator={getStatusIcon(task.status)}
                >
                  {task.status}
                </Chip>
              </Stack>

              <Typography level="body-md" sx={{ mb: 2 }}>
                {task.description}
              </Typography>

              {task.lastRunAt && (
                <Typography level="body-sm" textColor="text.secondary">
                  Last run: {new Date(task.lastRunAt).toLocaleString()}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Control Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="solid"
              color="primary"
              startDecorator={<PlayArrow />}
              onClick={handleStart}
              disabled={!canStart || isRunning}
            >
              Start Task
            </Button>
            <Button
              variant="solid"
              color="danger"
              startDecorator={<Stop />}
              onClick={handleStop}
              disabled={!isRunning}
            >
              Stop Task
            </Button>
          </Stack>

          {/* Output Section */}
          <Stack spacing={2}>
            <Typography level="h4" fontWeight="bold">
              Console Output
            </Typography>
            <Sheet
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 'md',
                bgcolor: 'background.level1',
                minHeight: 300,
                maxHeight: 400,
                overflow: 'auto',
                fontFamily: 'monospace',
              }}
              ref={outputRef}
            >
              {output || error ? (
                <Box>
                  {output && (
                    <Typography
                      level="body-sm"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'text.primary',
                      }}
                    >
                      {output}
                    </Typography>
                  )}
                  {error && (
                    <Typography
                      level="body-sm"
                      sx={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: 'danger.500',
                      }}
                    >
                      {error}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography level="body-sm" textColor="text.secondary">
                  {isRunning ? 'Waiting for output...' : 'No output yet. Start the task to see output here.'}
                </Typography>
              )}
            </Sheet>
          </Stack>

          {/* Task Info */}
          <Card variant="outlined">
            <CardContent>
              <Typography level="title-lg" fontWeight="bold" sx={{ mb: 2 }}>
                Task Information
              </Typography>
              <Stack spacing={1}>
                <Typography level="body-sm">
                  <strong>Created:</strong> {new Date(task.createdAt).toLocaleString()}
                </Typography>
                <Typography level="body-sm">
                  <strong>Updated:</strong> {new Date(task.updatedAt).toLocaleString()}
                </Typography>
                <Typography level="body-sm">
                  <strong>Platform:</strong> {project.platform}
                </Typography>
                {project.url && (
                  <Typography level="body-sm">
                    <strong>URL:</strong> {project.url}
                  </Typography>
                )}
                {project.device && (
                  <Typography level="body-sm">
                    <strong>Device:</strong> {project.device}
                  </Typography>
                )}
                <Typography level="body-sm">
                  <strong>Workspace:</strong> {project.workspaceDir}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  )
}
