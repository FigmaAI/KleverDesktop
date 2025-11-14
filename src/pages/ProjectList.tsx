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
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Sheet,
  Stack,
  Typography,
  ToggleButtonGroup,
} from '@mui/joy'
import {
  Add as AddIcon,
  PhoneAndroid,
  Language,
  Delete as DeleteIcon,
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  ViewModule as ViewModuleIcon,
  ViewList as ViewListIcon,
  Folder as FolderIcon,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material'
import type { Project } from '../types/project'

const ITEMS_PER_PAGE = 12

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.projectList()
      if (result.success && result.projects) {
        // Sort by createdAt descending (newest first)
        const sorted = [...result.projects].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setProjects(sorted)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this project? This will also delete all project files.')) return

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Pagination
  const totalPages = Math.ceil(projects.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedProjects = projects.slice(startIndex, endIndex)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
              {projects.length} {projects.length === 1 ? 'project' : 'projects'} total
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center">
            {projects.length > 0 && (
              <ToggleButtonGroup
                value={viewMode}
                onChange={(_event, newValue) => {
                  if (newValue) setViewMode(newValue)
                }}
                variant="outlined"
                size="sm"
              >
                <IconButton value="card">
                  <ViewModuleIcon />
                </IconButton>
                <IconButton value="list">
                  <ViewListIcon />
                </IconButton>
              </ToggleButtonGroup>
            )}
            <Button
              startDecorator={<AddIcon />}
              color="primary"
              onClick={() => navigate('/projects/new')}
            >
              New Project
            </Button>
          </Stack>
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
        ) : viewMode === 'card' ? (
          <>
            <Grid container spacing={2}>
              {paginatedProjects.map((project) => {
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

                          <Stack spacing={0.5}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FolderIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                              <Typography level="body-xs" textColor="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                {project.workspaceDir}
                              </Typography>
                            </Stack>
                            <Typography level="body-xs" textColor="text.tertiary">
                              Created {formatDate(project.createdAt)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 4 }}>
                <IconButton
                  size="sm"
                  variant="outlined"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography level="body-sm">
                  Page {currentPage} of {totalPages}
                </Typography>
                <IconButton
                  size="sm"
                  variant="outlined"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <ChevronRight />
                </IconButton>
              </Stack>
            )}
          </>
        ) : (
          <>
            <List
              variant="outlined"
              sx={{
                borderRadius: 'md',
                bgcolor: 'background.surface',
              }}
            >
              {paginatedProjects.map((project) => {
                const statusSummary = getTaskStatusSummary(project)
                return (
                  <ListItem key={project.id}>
                    <ListItemButton onClick={() => navigate(`/projects/${project.id}`)}>
                      <ListItemDecorator>
                        {project.platform === 'android' ? (
                          <PhoneAndroid color="primary" />
                        ) : (
                          <Language color="primary" />
                        )}
                      </ListItemDecorator>
                      <ListItemContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack spacing={0.5} sx={{ flex: 1 }}>
                            <Typography level="title-md" fontWeight="bold">
                              {project.name}
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip
                                size="sm"
                                variant="soft"
                                color={project.platform === 'android' ? 'primary' : 'success'}
                              >
                                {project.platform}
                              </Chip>
                              {statusSummary.total > 0 && (
                                <>
                                  {statusSummary.running > 0 && (
                                    <Chip size="sm" variant="soft" color="primary">
                                      {statusSummary.running} running
                                    </Chip>
                                  )}
                                  {statusSummary.completed > 0 && (
                                    <Chip size="sm" variant="soft" color="success">
                                      {statusSummary.completed} completed
                                    </Chip>
                                  )}
                                  {statusSummary.failed > 0 && (
                                    <Chip size="sm" variant="soft" color="danger">
                                      {statusSummary.failed} failed
                                    </Chip>
                                  )}
                                </>
                              )}
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <FolderIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                              <Typography level="body-xs" textColor="text.secondary">
                                {project.workspaceDir}
                              </Typography>
                            </Stack>
                            <Typography level="body-xs" textColor="text.tertiary">
                              Created {formatDate(project.createdAt)}
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
                      </ListItemContent>
                    </ListItemButton>
                  </ListItem>
                )
              })}
            </List>

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 4 }}>
                <IconButton
                  size="sm"
                  variant="outlined"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography level="body-sm">
                  Page {currentPage} of {totalPages}
                </Typography>
                <IconButton
                  size="sm"
                  variant="outlined"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                >
                  <ChevronRight />
                </IconButton>
              </Stack>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}
