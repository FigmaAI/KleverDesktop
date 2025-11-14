import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Grid,
  IconButton,
  Sheet,
  Stack,
  Typography,
  List,
  Divider,
  ToggleButtonGroup,
} from '@mui/joy'
import {
  Add as AddIcon,
  ViewModule,
  ViewList,
  ChevronLeft,
  ChevronRight,
  FirstPage,
  LastPage,
} from '@mui/icons-material'
import type { Project } from '../types/project'
import { ProjectCard } from '../components'

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 12

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


  // Pagination logic
  const totalPages = Math.ceil(projects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProjects = projects.slice(startIndex, endIndex)

  // Reset to first page if current page is out of range
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [projects.length, currentPage, totalPages])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          sx={{ mb: 3, gap: 2 }}
        >
          <Box>
            <Typography level="h2" fontWeight="bold">
              Projects
            </Typography>
            <Typography level="body-md" textColor="text.secondary">
              Manage your automation projects
            </Typography>
          </Box>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            <ToggleButtonGroup
              value={viewMode}
              onChange={(_event, newValue) => {
                if (newValue !== null) {
                  setViewMode(newValue as 'card' | 'list')
                }
              }}
              sx={{ flex: { xs: 1, sm: 'none' } }}
            >
              <Button value="card" startDecorator={<ViewModule />} sx={{ flex: { xs: 1, sm: 'none' } }}>
                Card
              </Button>
              <Button value="list" startDecorator={<ViewList />} sx={{ flex: { xs: 1, sm: 'none' } }}>
                List
              </Button>
            </ToggleButtonGroup>
            <Button
              startDecorator={<AddIcon />}
              color="primary"
              onClick={() => navigate('/projects/new')}
              sx={{ flex: { xs: 1, sm: 'none' } }}
            >
              New
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
        ) : (
          <Stack spacing={3}>
            {/* Card View */}
            {viewMode === 'card' && (
              <Grid container spacing={2}>
                {paginatedProjects.map((project) => (
                  <Grid key={project.id} xs={12} sm={6} md={4}>
                    <ProjectCard
                      project={project}
                      variant="card"
                      expand={false}
                      clickable={true}
                      showDelete={true}
                      onDeleted={loadProjects}
                      onClick={(id) => navigate(`/projects/${id}`)}
                    />
                  </Grid>
                ))}
              </Grid>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <List
                variant="outlined"
                sx={{
                  borderRadius: 'md',
                  bgcolor: 'background.surface',
                }}
              >
                {paginatedProjects.map((project, index) => (
                  <Box key={project.id}>
                    <ProjectCard
                      project={project}
                      variant="list"
                      expand={false}
                      clickable={true}
                      showDelete={true}
                      onDeleted={loadProjects}
                      onClick={(id) => navigate(`/projects/${id}`)}
                    />
                    {index < paginatedProjects.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            )}

            {/* Pagination */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  variant="outlined"
                  color="neutral"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  <FirstPage />
                </IconButton>
                <IconButton
                  variant="outlined"
                  color="neutral"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  <ChevronLeft />
                </IconButton>

                <Stack direction="row" spacing={0.5}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)

                    if (!showPage) {
                      // Show ellipsis
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <Typography key={page} level="body-sm" sx={{ px: 1, alignSelf: 'center' }}>
                            ...
                          </Typography>
                        )
                      }
                      return null
                    }

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? 'solid' : 'outlined'}
                        color={currentPage === page ? 'primary' : 'neutral'}
                        onClick={() => setCurrentPage(page)}
                        sx={{ minWidth: 40 }}
                      >
                        {page}
                      </Button>
                    )
                  })}
                </Stack>

                <IconButton
                  variant="outlined"
                  color="neutral"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  <ChevronRight />
                </IconButton>
                <IconButton
                  variant="outlined"
                  color="neutral"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  <LastPage />
                </IconButton>
              </Stack>
            </Box>
          </Stack>
        )}
      </Box>
    </Box>
  )
}
