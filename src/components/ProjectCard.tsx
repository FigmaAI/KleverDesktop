import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Stack,
  Typography,
} from '@mui/joy'
import {
  PhoneAndroid,
  Language,
  Delete as DeleteIcon,
  PlayArrow,
  CheckCircle,
  Error as ErrorIcon,
  FolderOpen,
} from '@mui/icons-material'
import type { Project } from '../types/project'

interface ProjectCardProps {
  project: Project
  variant?: 'card' | 'list'
  expand?: boolean
  clickable?: boolean
  showDelete?: boolean
  onDeleted?: () => void
  onClick?: (projectId: string) => void
}

export function ProjectCard({
  project,
  variant = 'card',
  expand = false,
  clickable = true,
  showDelete = true,
  onDeleted,
  onClick,
}: ProjectCardProps) {
  const getTaskStatusSummary = () => {
    const total = project.tasks.length
    const completed = project.tasks.filter((t) => t.status === 'completed').length
    const running = project.tasks.filter((t) => t.status === 'running').length
    const failed = project.tasks.filter((t) => t.status === 'failed').length
    return { total, completed, running, failed }
  }

  // Sanitize app name to match Python behavior (remove spaces)
  const getSanitizedAppName = (name: string) => {
    return name.replace(/ /g, '')
  }

  const statusSummary = getTaskStatusSummary()

  const handleClick = () => {
    if (clickable && onClick) {
      onClick(project.id)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const result = await window.electronAPI.projectDelete(project.id)
      if (result.success) {
        // Notify parent component of successful deletion
        if (onDeleted) {
          onDeleted()
        }
      } else {
        alert(`Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }

  const handleOpenWorkDir = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const workDir = `${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`

    try {
      const result = await window.electronAPI.openFolder(workDir)
      if (!result.success) {
        alert(`Failed to open folder: ${result.error}`)
      }
    } catch (error) {
      console.error('Error opening folder:', error)
      alert('Failed to open folder')
    }
  }

  // Card View
  if (variant === 'card') {
    return (
      <Card
        variant="outlined"
        sx={{
          cursor: clickable ? 'pointer' : 'default',
          transition: 'all 0.2s',
          ...(clickable && {
            '&:hover': {
              boxShadow: 'md',
              borderColor: 'primary.outlinedBorder',
            },
          }),
        }}
        onClick={handleClick}
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
              {showDelete && (
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={handleDelete}
                >
                  <DeleteIcon />
                </IconButton>
              )}
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

            {statusSummary.total > 0 && !expand && (
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

            <Stack
              direction="row"
              justifyContent="space-between"
            >
              <Typography level="body-xs" textColor="text.secondary">
                Created {new Date(project.createdAt).toLocaleDateString()}
              </Typography>
              {expand && (
                <Chip
                  startDecorator={<FolderOpen />}
                  onClick={handleOpenWorkDir}
                  sx={{ cursor: 'pointer' }}
                >
                  {project.workspaceDir}/apps/{getSanitizedAppName(project.name)}
                </Chip>
              )}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    )
  }

  // List View
  return (
    <ListItem>
      <ListItemButton
        onClick={handleClick}
        disabled={!clickable}
        sx={{ cursor: clickable ? 'pointer' : 'default' }}
      >
        <ListItemDecorator>
          {project.platform === 'android' ? (
            <PhoneAndroid color="primary" />
          ) : (
            <Language color="primary" />
          )}
        </ListItemDecorator>
        <ListItemContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ width: '100%' }}>
            <Box sx={{ flex: 1 }}>
              <Typography level="title-md" fontWeight="bold">
                {project.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
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
                {!expand && (
                  <>
                    {statusSummary.running > 0 && (
                      <Chip
                        size="sm"
                        variant="soft"
                        color="primary"
                        startDecorator={<PlayArrow />}
                      >
                        {statusSummary.running}
                      </Chip>
                    )}
                    {statusSummary.completed > 0 && (
                      <Chip
                        size="sm"
                        variant="soft"
                        color="success"
                        startDecorator={<CheckCircle />}
                      >
                        {statusSummary.completed}
                      </Chip>
                    )}
                    {statusSummary.failed > 0 && (
                      <Chip
                        size="sm"
                        variant="soft"
                        color="danger"
                        startDecorator={<ErrorIcon />}
                      >
                        {statusSummary.failed}
                      </Chip>
                    )}
                  </>
                )}
              </Stack>
              {expand && (
                <Typography
                  level="body-sm"
                  onClick={handleOpenWorkDir}
                  sx={{ mt: 1, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                >
                  <strong>Work Dir:</strong> {project.workspaceDir}/apps/{getSanitizedAppName(project.name)}
                </Typography>
              )}
            </Box>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography level="body-xs" textColor="text.secondary">
                {new Date(project.createdAt).toLocaleDateString()}
              </Typography>
              {showDelete && (
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={handleDelete}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </ListItemContent>
      </ListItemButton>
    </ListItem>
  )
}