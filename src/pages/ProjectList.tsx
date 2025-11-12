import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Sheet,
  Stack,
  Typography,
} from '@mui/joy'
import {
  Add as AddIcon,
  PhoneAndroid,
  Language,
  Delete as DeleteIcon,
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
} from '@mui/icons-material'
import type { Project } from '../types/project'

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.projectList()
      if (result.success && result.projects) {
        setProjects(result.projects)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const result = await window.electronAPI.projectDelete(projectId)
      if (result.success) {
        setProjects(projects.filter((p) => p.id !== projectId))
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const getTaskStatusSummary = (project: Project) => {
    const total = project.tasks.length
    const completed = project.tasks.filter((t) => t.status === 'completed').length
    const running = project.tasks.filter((t) => t.status === 'running').length
    const failed = project.tasks.filter((t) => t.status === 'failed').length
    return { total, completed, running, failed }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography level="h2" fontWeight="bold">
              Projects
            </Typography>
            <Typography level="body-md" textColor="text.secondary">
              Manage your automation projects
            </Typography>
          </Box>
          <Button
            startDecorator={<AddIcon />}
            color="primary"
            onClick={() => navigate('/projects/new')}
          >
            New Project
          </Button>
        </Stack>

        {loading ? (
          <Sheet
            variant="outlined"
            sx={{
              p: 4,
              borderRadius: 'md',
              bgcolor: 'background.surface',
              textAlign: 'center',
            }}
          >
            <Typography>Loading projects...</Typography>
          </Sheet>
        ) : projects.length === 0 ? (
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
              No projects yet
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
              Create your first project to get started with UI automation
            </Typography>
            <Button
              variant="solid"
              color="primary"
              startDecorator={<AddIcon />}
              sx={{ minWidth: 200 }}
              onClick={() => navigate('/projects/new')}
            >
              Create Project
            </Button>
          </Sheet>
        ) : (
          <Grid container spacing={2}>
            {projects.map((project) => {
              const statusSummary = getTaskStatusSummary(project)
              return (
                <Grid key={project.id} xs={12} sm={6} md={4}>
                  <Card
                    variant="outlined"
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: 'md',
                        borderColor: 'primary.outlinedBorder',
                      },
                    }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <CardContent>
                      <Stack spacing={2}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Stack direction="row" spacing={1} alignItems="center">
                            {project.platform === 'android' ? (
                              <PhoneAndroid color="primary" />
                            ) : (
                              <Language color="primary" />
                            )}
                            <Typography level="title-lg" fontWeight="bold">
                              {project.name}
                            </Typography>
                          </Stack>
                          <IconButton
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={(e) => handleDelete(project.id, e)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Stack>

                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={project.platform === 'android' ? 'primary' : 'success'}
                          >
                            {project.platform}
                          </Chip>
                          {statusSummary.total > 0 && (
                            <Chip size="sm" variant="soft" color="neutral">
                              {statusSummary.total} {statusSummary.total === 1 ? 'task' : 'tasks'}
                            </Chip>
                          )}
                        </Stack>

                        {statusSummary.total > 0 && (
                          <Stack spacing={1}>
                            <Typography level="body-xs" textColor="text.secondary">
                              Task Status:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              {statusSummary.running > 0 && (
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color="primary"
                                  startDecorator={<PlayArrow />}
                                >
                                  {statusSummary.running} running
                                </Chip>
                              )}
                              {statusSummary.completed > 0 && (
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color="success"
                                  startDecorator={<CheckCircle />}
                                >
                                  {statusSummary.completed} completed
                                </Chip>
                              )}
                              {statusSummary.failed > 0 && (
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color="danger"
                                  startDecorator={<ErrorIcon />}
                                >
                                  {statusSummary.failed} failed
                                </Chip>
                              )}
                            </Stack>
                          </Stack>
                        )}

                        <Typography level="body-xs" textColor="text.secondary">
                          Created {new Date(project.createdAt).toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Box>
    </Box>
  )
}
