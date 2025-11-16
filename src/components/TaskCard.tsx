import {
  Box,
  Button,
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
  Tooltip,
} from '@mui/joy'
import {
  PlayArrow,
  Stop,
  Delete as DeleteIcon,
  Terminal as TerminalIcon,
  Description as DescriptionIcon,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Cancel,
} from '@mui/icons-material'
import type { Task } from '../types/project'

interface TaskCardProps {
  task: Task
  variant?: 'card' | 'list'
  onStart?: (task: Task) => void
  onStop?: (task: Task) => void
  onDelete?: (task: Task) => void
  onViewLogs?: (task: Task) => void
  onViewMarkdown?: (task: Task) => void
}

export function TaskCard({
  task,
  variant = 'card',
  onStart,
  onStop,
  onDelete,
  onViewLogs,
  onViewMarkdown,
}: TaskCardProps) {
  const getStatusLabel = () => {
    switch (task.status) {
      case 'pending':
        return 'Scheduled'
      case 'running':
        return 'Running'
      case 'completed':
        return 'Finished'
      case 'failed':
        return 'Error'
      case 'cancelled':
        return 'Stopped'
      default:
        return 'Unknown'
    }
  }

  const getStatusIcon = () => {
    switch (task.status) {
      case 'pending':
        return <Schedule fontSize="small" />
      case 'running':
        return <PlayArrow fontSize="small" />
      case 'completed':
        return <CheckCircle fontSize="small" />
      case 'failed':
        return <ErrorIcon fontSize="small" />
      case 'cancelled':
        return <Cancel fontSize="small" />
      default:
        return <Schedule fontSize="small" />
    }
  }

  const getStatusColor = (): 'neutral' | 'primary' | 'success' | 'danger' | 'warning' => {
    switch (task.status) {
      case 'pending':
        return 'neutral'
      case 'running':
        return 'primary'
      case 'completed':
        return 'success'
      case 'failed':
        return 'danger'
      case 'cancelled':
        return 'warning'
      default:
        return 'neutral'
    }
  }


  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStart?.(task)
  }

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation()
    onStop?.(task)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`Are you sure you want to delete "${task.name}"?`)) {
      onDelete?.(task)
    }
  }

  const handleViewLogs = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewLogs?.(task)
  }

  const handleViewMarkdown = (e: React.MouseEvent) => {
    e.stopPropagation()
    onViewMarkdown?.(task)
  }

  // Card View
  if (variant === 'card') {
    return (
      <Card
        variant="outlined"
        sx={{
          transition: 'all 0.2s',
          minHeight: '240px',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            boxShadow: 'sm',
            borderColor: 'neutral.outlinedHoverBorder',
          },
        }}
      >
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={2} sx={{ flex: 1, justifyContent: 'space-between' }}>
            {/* Task Description (Main Content) */}
            <Typography
              level="body-md"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '52px',
              }}
            >
              {task.goal || task.description || 'No description'}
            </Typography>

            {/* Status & Model */}
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Chip
                size="md"
                variant="soft"
                color={getStatusColor()}
                startDecorator={getStatusIcon()}
              >
                {getStatusLabel()}
              </Chip>
              {task.model && (
                <Chip
                  size="sm"
                  variant="outlined"
                  color="neutral"
                >
                  {task.model}
                </Chip>
              )}
            </Stack>

            {/* Timestamps */}
            {task.startedAt && (
              <Typography level="body-xs" textColor="text.tertiary">
                Started: {new Date(task.startedAt).toLocaleString()}
              </Typography>
            )}

            {/* Action Buttons */}
            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="space-between">
              <Stack direction="row" spacing={1}>
                {task.status === 'pending' && (
                  <Button
                    size="sm"
                    variant="solid"
                    color="primary"
                    startDecorator={<PlayArrow />}
                    onClick={handleStart}
                  >
                    Start
                  </Button>
                )}

                {task.status === 'running' && (
                  <Button
                    size="sm"
                    variant="solid"
                    color="danger"
                    startDecorator={<Stop />}
                    onClick={handleStop}
                  >
                    Stop
                  </Button>
                )}
              </Stack>

              <Stack direction="row" spacing={0.5}>
                <Tooltip title="View Logs">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={handleViewLogs}
                    disabled={!task.output && task.status === 'pending'}
                  >
                    <TerminalIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="View Results">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={handleViewMarkdown}
                    disabled={task.status !== 'completed'}
                  >
                    <DescriptionIcon />
                  </IconButton>
                </Tooltip>

                <Tooltip title="Delete Task">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="danger"
                    onClick={handleDelete}
                    disabled={task.status === 'running'}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
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
      <ListItemButton sx={{ cursor: 'default' }}>
        <ListItemDecorator sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
          {getStatusIcon()}
        </ListItemDecorator>
        <ListItemContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ width: '100%' }}>
            {/* Left: Task Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {/* Task Description (Main Content) */}
              <Typography
                level="body-md"
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
              
              {/* Status & Model */}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" alignItems="center">
                <Chip
                  size="sm"
                  variant="soft"
                  color={getStatusColor()}
                  startDecorator={getStatusIcon()}
                >
                  {getStatusLabel()}
                </Chip>
                {task.model && (
                  <Chip
                    size="sm"
                    variant="outlined"
                    color="neutral"
                  >
                    {task.model}
                  </Chip>
                )}
              </Stack>

              {/* Timestamp */}
              {task.startedAt && (
                <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 1 }}>
                  Started: {new Date(task.startedAt).toLocaleString()}
                </Typography>
              )}
            </Box>

            {/* Right: Actions */}
            <Stack direction="row" spacing={1} alignItems="center">
              {task.status === 'pending' && (
                <Button
                  size="sm"
                  variant="solid"
                  color="primary"
                  startDecorator={<PlayArrow />}
                  onClick={handleStart}
                >
                  Start
                </Button>
              )}

              {task.status === 'running' && (
                <Button
                  size="sm"
                  variant="solid"
                  color="danger"
                  startDecorator={<Stop />}
                  onClick={handleStop}
                >
                  Stop
                </Button>
              )}

              <Tooltip title="View Logs">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={handleViewLogs}
                  disabled={!task.output && task.status === 'pending'}
                >
                  <TerminalIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="View Results">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="neutral"
                  onClick={handleViewMarkdown}
                  disabled={task.status !== 'completed'}
                >
                  <DescriptionIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title="Delete Task">
                <IconButton
                  size="sm"
                  variant="plain"
                  color="danger"
                  onClick={handleDelete}
                  disabled={task.status === 'running'}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </ListItemContent>
      </ListItemButton>
    </ListItem>
  )
}

