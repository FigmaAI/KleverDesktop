import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  IconButton,
  Sheet,
  Stack,
  Table,
  Typography,
  ColorPaletteProp,
  LinearProgress,
  Tooltip,
} from '@mui/joy'
import {
  Add as AddIcon,
  ArrowBack,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
  Schedule,
  Cancel,
  Visibility,
  FolderOpen,
  Description,
  Stop,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import type { Project, Task } from '../types/project'
import {
  ProjectCard,
  TaskCreateDialog,
  TaskDetailDialog,
  TaskMarkdownDialog,
} from '../components'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [markdownDialogOpen, setMarkdownDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const loadProject = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const result = await window.electronAPI.projectGet(id)
      if (result.success && result.project) {
        setProject(result.project)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadProject()
  }, [id, loadProject])

  const handleDeleteTask = async (task: Task) => {
    if (!id || !confirm(`Are you sure you want to delete "${task.name}"?`)) return

    try {
      const result = await window.electronAPI.taskDelete(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleStopTask = async (task: Task) => {
    if (!id) return

    try {
      const result = await window.electronAPI.taskStop(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }

  const handleOpenFolder = async () => {
    if (!project) return
    try {
      await window.electronAPI.openPath(project.workspaceDir)
    } catch (error) {
      console.error('Error opening folder:', error)
    }
  }

  const handleViewDetails = (task: Task) => {
    setSelectedTask(task)
    setDetailDialogOpen(true)
  }

  const handleViewMarkdown = (task: Task) => {
    setSelectedTask(task)
    setMarkdownDialogOpen(true)
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <Schedule fontSize="small" />
      case 'running':
        return <PlayArrow fontSize="small" color="primary" />
      case 'completed':
        return <CheckCircle fontSize="small" color="success" />
      case 'failed':
        return <ErrorIcon fontSize="small" color="error" />
      case 'cancelled':
        return <Cancel fontSize="small" />
      default:
        return <Schedule fontSize="small" />
    }
  }

  const getStatusColor = (status: Task['status']): ColorPaletteProp => {
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

  // Calculate progress based on task output
  const getTaskProgress = (task: Task): number => {
    if (task.status === 'completed') return 100
    if (task.status === 'running' && task.output) {
      // Simple heuristic: count "Round" occurrences in output
      const rounds = (task.output.match(/Round \d+/g) || []).length
      return Math.min(rounds * 10, 90) // Cap at 90% until completed
    }
    return 0
  }

  const getCurrentRound = (task: Task): string => {
    if (!task.output) return '-'
    const matches = task.output.match(/Round (\d+)/g)
    if (!matches || matches.length === 0) return '-'
    const lastRound = matches[matches.length - 1]
    return lastRound.replace('Round ', '')
  }

  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography>Loading project...</Typography>
      </Box>
    )
  }

  if (!project) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
        <Box sx={{ p: 4, flex: 1 }}>
          <Typography>Project not found</Typography>
          <Button onClick={() => navigate('/projects')} sx={{ mt: 2 }}>
            Back to Projects
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1, overflow: 'auto' }}>
        <Stack spacing={3}>
          <Button
            variant="plain"
            color="neutral"
            startDecorator={<ArrowBack />}
            onClick={() => navigate('/projects')}
            sx={{ alignSelf: 'flex-start' }}
          >
            Back to Projects
          </Button>

          {/* Project Header */}
          <ProjectCard
            project={project}
            variant="card"
            expand={true}
            clickable={false}
            showDelete={true}
            onDeleted={() => navigate('/projects')}
          />

          {/* Tasks Section */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="h3" fontWeight="bold">
              Tasks
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                size="sm"
                variant="outlined"
                startDecorator={<FolderOpen />}
                onClick={handleOpenFolder}
              >
                Open Workspace
              </Button>
              <Button
                startDecorator={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Add Task
              </Button>
            </Stack>
          </Stack>

          {project.tasks.length === 0 ? (
            <Sheet
              variant="outlined"
              sx={{
                p: 4,
                borderRadius: 'md',
                bgcolor: 'background.surface',
                textAlign: 'center',
              }}
            >
              <Typography level="title-lg" sx={{ mb: 1 }}>
                No tasks yet
              </Typography>
              <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                Add your first task to start automating
              </Typography>
              <Button
                variant="solid"
                color="primary"
                startDecorator={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Add Task
              </Button>
            </Sheet>
          ) : (
            <Sheet
              variant="outlined"
              sx={{
                borderRadius: 'md',
                overflow: 'auto',
              }}
            >
              <Table
                stickyHeader
                hoverRow
                sx={{
                  '& thead th': {
                    bgcolor: 'background.surface',
                  },
                }}
              >
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Task</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '10%' }}>Round</th>
                    <th style={{ width: '15%' }}>Progress</th>
                    <th style={{ width: '20%' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((task) => (
                    <tr key={task.id}>
                      {/* Task Info */}
                      <td>
                        <Stack spacing={0.5}>
                          <Typography level="title-sm" fontWeight="bold">
                            {task.name}
                          </Typography>
                          <Typography
                            level="body-xs"
                            textColor="text.secondary"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {task.goal || task.description || 'No description'}
                          </Typography>
                          {task.startedAt && (
                            <Typography level="body-xs" textColor="text.tertiary">
                              Started: {new Date(task.startedAt).toLocaleString()}
                            </Typography>
                          )}
                        </Stack>
                      </td>

                      {/* Status */}
                      <td>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={getStatusColor(task.status)}
                          startDecorator={getStatusIcon(task.status)}
                        >
                          {task.status}
                        </Chip>
                      </td>

                      {/* Current Round */}
                      <td>
                        <Typography level="body-sm" fontWeight="bold">
                          {task.status === 'running' ? `Round ${getCurrentRound(task)}` : '-'}
                        </Typography>
                      </td>

                      {/* Progress Bar */}
                      <td>
                        <Stack spacing={0.5}>
                          <LinearProgress
                            determinate
                            value={getTaskProgress(task)}
                            color={getStatusColor(task.status)}
                            size="sm"
                            sx={{ minWidth: 80 }}
                          />
                          <Typography level="body-xs" textColor="text.secondary">
                            {getTaskProgress(task)}%
                          </Typography>
                        </Stack>
                      </td>

                      {/* Actions */}
                      <td>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          <Tooltip title="View Details">
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="neutral"
                              onClick={() => handleViewDetails(task)}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="View Results">
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="neutral"
                              onClick={() => handleViewMarkdown(task)}
                              disabled={task.status !== 'completed'}
                            >
                              <Description />
                            </IconButton>
                          </Tooltip>

                          {task.status === 'running' && (
                            <Tooltip title="Stop Task">
                              <IconButton
                                size="sm"
                                variant="plain"
                                color="danger"
                                onClick={() => handleStopTask(task)}
                              >
                                <Stop />
                              </IconButton>
                            </Tooltip>
                          )}

                          <Tooltip title="Delete Task">
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="danger"
                              onClick={() => handleDeleteTask(task)}
                              disabled={task.status === 'running'}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Sheet>
          )}
        </Stack>
      </Box>

      {/* Dialogs */}
      <TaskCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectId={id!}
        platform={project.platform}
        onTaskCreated={() => {
          loadProject()
          setCreateDialogOpen(false)
        }}
      />

      {selectedTask && (
        <>
          <TaskDetailDialog
            open={detailDialogOpen}
            onClose={() => setDetailDialogOpen(false)}
            task={selectedTask}
            projectId={id!}
            workspaceDir={project.workspaceDir}
            onTaskUpdated={loadProject}
          />

          <TaskMarkdownDialog
            open={markdownDialogOpen}
            onClose={() => setMarkdownDialogOpen(false)}
            taskName={selectedTask.name}
            workspaceDir={project.workspaceDir}
          />
        </>
      )}
    </Box>
  )
}
