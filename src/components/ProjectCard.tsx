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
  FolderOpen,
} from '@mui/icons-material'
import type { Project } from '../types/project'
import { TaskStatusSummary } from './TaskStatusSummary'

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
          minHeight: '240px',
          display: 'flex',
          flexDirection: 'column',
          ...(clickable && {
            '&:hover': {
              boxShadow: 'md',
              borderColor: 'primary.outlinedBorder',
            },
          }),
        }}
        onClick={handleClick}
      >
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={2} sx={{ flex: 1, justifyContent: 'space-between' }}>
            {/* Top Section: Name and Platform grouped together */}
            <Stack spacing={1.5}>
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

              <Chip
                size="md"
                variant="soft"
                color={project.platform === 'android' ? 'primary' : 'success'}
              >
                {project.platform}
              </Chip>
            </Stack>

            {/* Bottom Section: Task Status and Created Date */}
            <Stack spacing={2}>
              {!expand && (
                <TaskStatusSummary
                  total={statusSummary.total}
                  running={statusSummary.running}
                  completed={statusSummary.completed}
                  failed={statusSummary.failed}
                />
              )}

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography 
                  level="body-xs" 
                  textColor="text.secondary"
                  sx={{
                    minWidth: '120px'
                  }}
                >
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </Typography>
                {expand && (
                  <Chip
                    startDecorator={<FolderOpen />}
                    onClick={handleOpenWorkDir}
                    sx={{
                      cursor: 'cursor',
                      minWidth: '160px',
                      '& > span': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'block',
                      }
                    }}
                  >
                    {project.workspaceDir}/apps/{getSanitizedAppName(project.name)}
                  </Chip>
                )}
              </Stack>
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
                  size="md"
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
                  <TaskStatusSummary
                    total={statusSummary.total}
                    running={statusSummary.running}
                    completed={statusSummary.completed}
                    failed={statusSummary.failed}
                    showTotal={false}
                  />
                )}
              </Stack>
              {expand && (
                <Typography
                  level="body-sm"
                  onClick={handleOpenWorkDir}
                  sx={{
                    mt: 1,
                    cursor: 'pointer',
                    '&:hover': { textDecoration: 'underline' },
                    maxWidth: '500px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
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