import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Grid,
  Sheet,
  Stack,
  Typography,
  List,
  Divider,
  ToggleButtonGroup,
} from '@mui/joy'
import {
  Add as AddIcon,
  ArrowBack,
  ViewModule,
  ViewList,
} from '@mui/icons-material'
import type { Project, Task } from '../types/project'
import {
  ProjectCard,
  TaskCard,
  TaskCreateDialog,
  TaskDetailDialog,
  TaskMarkdownDialog,
} from '../components'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

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

  const handleStartTask = async (task: Task) => {
    if (!id) return

    try {
      const result = await window.electronAPI.taskStart(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to start task')
      }
    } catch (error) {
      console.error('Error starting task:', error)
      alert('Failed to start task')
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

  const handleDeleteTask = async (task: Task) => {
    if (!id) return

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

  const handleViewMarkdown = (task: Task) => {
    setSelectedTask(task)
    setMarkdownDialogOpen(true)
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
            variant="compact"
            expand={true}
            clickable={false}
            showDelete={true}
            onDeleted={() => navigate('/projects')}
          />

          {/* Tasks Section Header */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={2}
          >
            <Box>
              <Typography level="h3" fontWeight="bold">
                Tasks
              </Typography>
              <Typography level="body-sm" textColor="text.secondary">
                {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <ToggleButtonGroup
                value={viewMode}
                onChange={(_event, newValue) => {
                  if (newValue !== null) {
                    setViewMode(newValue as 'card' | 'list')
                  }
                }}
              >
                <Button value="card" startDecorator={<ViewModule />}>
                  Card
                </Button>
                <Button value="list" startDecorator={<ViewList />}>
                  List
                </Button>
              </ToggleButtonGroup>
              <Button
                startDecorator={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Add Task
              </Button>
            </Stack>
          </Stack>

          {/* Tasks Content */}
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
            <>
              {/* Card View */}
              {viewMode === 'card' && (
                <Grid container spacing={2}>
                  {project.tasks.map((task) => (
                    <Grid key={task.id} xs={12} sm={6} md={4}>
                      <TaskCard
                        task={task}
                        variant="card"
                        onStart={handleStartTask}
                        onStop={handleStopTask}
                        onDelete={handleDeleteTask}
                        onViewMarkdown={handleViewMarkdown}
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
                  {project.tasks.map((task, index) => (
                    <Box key={task.id}>
                      <TaskCard
                        task={task}
                        variant="list"
                        onStart={handleStartTask}
                        onStop={handleStopTask}
                        onDelete={handleDeleteTask}
                        onViewMarkdown={handleViewMarkdown}
                      />
                      {index < project.tasks.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </>
          )}
        </Stack>
      </Box>

      {/* Dialogs */}
      <TaskCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        projectId={id!}
        projectName={project.name}
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
            taskResultPath={selectedTask.resultPath}
            taskStatus={selectedTask.status}
          />
        </>
      )}
    </Box>
  )
}
