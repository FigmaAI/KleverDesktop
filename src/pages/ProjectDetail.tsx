import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Sheet,
  Stack,
  Typography,
} from '@mui/joy'
import {
  Add as AddIcon,
  ArrowBack,
  Assignment,
  CheckCircle,
  Error as ErrorIcon,
  PlayArrow,
  Schedule,
  Cancel,
  PhoneAndroid,
  Language,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import type { Project, Task } from '../types/project'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProject()
  }, [id])

  const loadProject = async () => {
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
  }

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id || !confirm('Are you sure you want to delete this task?')) return

    try {
      const result = await window.electronAPI.taskDelete(id, taskId)
      if (result.success) {
        loadProject() // Reload project to get updated tasks
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return <Schedule color="neutral" />
      case 'running':
        return <PlayArrow color="primary" />
      case 'completed':
        return <CheckCircle color="success" />
      case 'failed':
        return <ErrorIcon color="danger" />
      case 'cancelled':
        return <Cancel color="neutral" />
      default:
        return <Schedule color="neutral" />
    }
  }

  const getStatusColor = (status: Task['status']) => {
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
      <Box sx={{ p: 4, flex: 1 }}>
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
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                {project.platform === 'android' ? (
                  <PhoneAndroid sx={{ fontSize: 32 }} color="primary" />
                ) : (
                  <Language sx={{ fontSize: 32 }} color="primary" />
                )}
                <Box>
                  <Typography level="h2" fontWeight="bold">
                    {project.name}
                  </Typography>
                  <Typography level="body-sm" textColor="text.secondary">
                    {project.platform} • Created {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Chip
                  size="sm"
                  variant="soft"
                  color={project.platform === 'android' ? 'primary' : 'success'}
                >
                  {project.platform}
                </Chip>
                <Chip size="sm" variant="soft" color="neutral">
                  {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
                </Chip>
              </Stack>

              {project.url && (
                <Typography level="body-sm" sx={{ mt: 2 }}>
                  <strong>URL:</strong> {project.url}
                </Typography>
              )}
              {project.device && (
                <Typography level="body-sm" sx={{ mt: 1 }}>
                  <strong>Device:</strong> {project.device}
                </Typography>
              )}
              <Typography level="body-sm" sx={{ mt: 1 }}>
                <strong>Workspace:</strong> {project.workspaceDir}
              </Typography>
            </CardContent>
          </Card>

          {/* Tasks Section */}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="h3" fontWeight="bold">
              Tasks
            </Typography>
            <Button
              startDecorator={<AddIcon />}
              onClick={() => navigate(`/projects/${id}/tasks/new`)}
            >
              Add Task
            </Button>
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
                onClick={() => navigate(`/projects/${id}/tasks/new`)}
              >
                Add Task
              </Button>
            </Sheet>
          ) : (
            <List>
              {project.tasks.map((task) => (
                <ListItem
                  key={task.id}
                  endAction={
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={(e) => handleDeleteTask(task.id, e)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    onClick={() => navigate(`/projects/${id}/tasks/${task.id}`)}
                  >
                    <ListItemDecorator>
                      {getStatusIcon(task.status)}
                    </ListItemDecorator>
                    <ListItemContent>
                      <Stack spacing={0.5}>
                        <Typography level="title-md" fontWeight="bold">
                          {task.name}
                        </Typography>
                        <Typography level="body-sm" textColor="text.secondary">
                          {task.description}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            size="sm"
                            variant="soft"
                            color={getStatusColor(task.status) as any}
                          >
                            {task.status}
                          </Chip>
                          {task.lastRunAt && (
                            <Typography level="body-xs" textColor="text.secondary">
                              Last run: {new Date(task.lastRunAt).toLocaleString()}
                            </Typography>
                          )}
                        </Stack>
                      </Stack>
                    </ListItemContent>
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </Stack>
      </Box>
    </Box>
  )
}
