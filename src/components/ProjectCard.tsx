import {
  Box,
  Card,
  CardContent,
  CardOverflow,
  Chip,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Stack,
  Typography,
  Tooltip,
} from '@mui/joy'
import {
  PhoneAndroid,
  Language,
  Delete as DeleteIcon,
  FolderOpen,
} from '@mui/icons-material'
import type { Project } from '../types/project'

interface ProjectCardProps {
  project: Project
  variant?: 'card' | 'list'
  expand?: boolean
  clickable?: boolean
  showDelete?: boolean
  hideTaskSummary?: boolean
  onDeleted?: () => void
  onClick?: (projectId: string) => void
}

export function ProjectCard({
  project,
  variant = 'card',
  expand = false,
  clickable = true,
  showDelete = true,
  hideTaskSummary = false,
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

    console.log('[ProjectCard] Opening work directory:', workDir)
    console.log('[ProjectCard] Project:', { name: project.name, workspaceDir: project.workspaceDir })

    try {
      const result = await window.electronAPI.openFolder(workDir)
      console.log('[ProjectCard] openFolder result:', result)
      if (!result.success) {
        console.error('[ProjectCard] Failed to open folder:', result.error)
        alert(`Failed to open folder: ${result.error}`)
      } else {
        console.log('[ProjectCard] Folder opened successfully')
      }
    } catch (error) {
      console.error('[ProjectCard] Exception opening folder:', error)
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
            {/* Top Section: Name and Platform */}
            <Stack spacing={1.5}>
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

              <Chip
                size="md"
                variant="soft"
                color={project.platform === 'android' ? 'primary' : 'success'}
              >
                {project.platform}
              </Chip>
            </Stack>

            {/* Bottom Section: Timestamp and Actions */}
            <Stack
              direction="row"
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
              sx={{ width: '100%' }}
            >
              {/* Left: Timestamp */}
              <Typography
                level="body-xs"
                textColor="text.secondary"
                sx={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                  flex: 1,
                }}
              >
                Created {new Date(project.createdAt).toLocaleDateString()}
              </Typography>

              {/* Right: Action Buttons */}
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                {expand && (
                  <Tooltip title={`${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`}>
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={handleOpenWorkDir}
                    >
                      <FolderOpen />
                    </IconButton>
                  </Tooltip>
                )}
                {showDelete && (
                  <Tooltip title="Delete Project">
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={handleDelete}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
        <CardOverflow
          variant="soft"
          sx={{
            display: 'flex',
            flexDirection: 'row',
            gap: 1.5,
            py: 1,
            px: 2,
            bgcolor: 'background.level1',
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography level="body-sm" textColor="text.secondary">
            {statusSummary.running > 0
              ? `${statusSummary.running} running / ${statusSummary.total} total`
              : statusSummary.total > 0
              ? `${statusSummary.total} ${statusSummary.total === 1 ? 'task' : 'tasks'}`
              : 'No tasks'}
          </Typography>
        </CardOverflow>
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
              {!hideTaskSummary && (
                <Typography level="body-sm" textColor="text.secondary" sx={{ mt: 1.5 }}>
                  {statusSummary.running > 0
                    ? `${statusSummary.running} running / ${statusSummary.total} total`
                    : statusSummary.total > 0
                    ? `${statusSummary.total} ${statusSummary.total === 1 ? 'task' : 'tasks'}`
                    : 'No tasks'}
                </Typography>
              )}
            </Box>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Typography level="body-xs" textColor="text.secondary">
                {new Date(project.createdAt).toLocaleDateString()}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                {expand && (
                  <Tooltip title={`${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`}>
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={handleOpenWorkDir}
                    >
                      <FolderOpen />
                    </IconButton>
                  </Tooltip>
                )}
                {showDelete && (
                  <Tooltip title="Delete Project">
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="danger"
                      onClick={handleDelete}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Stack>
          </Stack>
        </ListItemContent>
      </ListItemButton>
    </ListItem>
  )
}