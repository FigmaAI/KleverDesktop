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
              <TaskStatusSummary
                total={statusSummary.total}
                running={statusSummary.running}
                completed={statusSummary.completed}
                failed={statusSummary.failed}
              />

              {expand ? (
                <Stack 
                  direction="row" 
                  spacing={1.5} 
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ width: '100%' }}
                >
                  <Typography 
                    level="body-xs" 
                    textColor="text.secondary"
                    sx={{ 
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      minWidth: 0,
                    }}
                  >
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </Typography>
                  <Chip
                    startDecorator={<FolderOpen />}
                    onClick={handleOpenWorkDir}
                    sx={{
                      cursor: 'pointer',
                      flex: 1,
                      minWidth: 0,
                      '& > span': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }
                    }}
                  >
                    {project.workspaceDir}/apps/{getSanitizedAppName(project.name)}
                  </Chip>
                </Stack>
              ) : (
                <Typography 
                  level="body-xs" 
                  textColor="text.secondary"
                  sx={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </Typography>
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
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  size="md"
                  variant="soft"
                  color={project.platform === 'android' ? 'primary' : 'success'}
                >
                  {project.platform}
                </Chip>
              </Stack>
              <Box sx={{ mt: 1.5 }}>
                <TaskStatusSummary
                  total={statusSummary.total}
                  running={statusSummary.running}
                  completed={statusSummary.completed}
                  failed={statusSummary.failed}
                />
              </Box>
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