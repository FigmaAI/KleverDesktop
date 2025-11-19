import {
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
  Description as DescriptionIcon,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Cancel,
} from '@mui/icons-material'
import type { Task } from '../types/project'
import { TaskMetricsSummary } from './TaskMetricsSummary'

interface TaskCardProps {
  task: Task
  variant?: 'card' | 'list'
  onStart?: (task: Task) => void
  onStop?: (task: Task) => void
  onDelete?: (task: Task) => void
  onViewMarkdown?: (task: Task) => void
}

export function TaskCard({
  task,
  variant = 'card',
  onStart,
  onStop,
  onDelete,
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
            {/* Top Section: Description */}
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

            {/* Bottom Section: Status, Metrics, and Actions */}
            <Stack spacing={2}>
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

              {/* Task Metrics */}
              {task.metrics && (
                <TaskMetricsSummary
                  rounds={task.metrics.rounds}
                  maxRounds={task.metrics.maxRounds}
                  tokens={task.metrics.tokens}
                  estimatedCost={task.metrics.estimatedCost}
                  cpuUsage={task.metrics.cpuUsage}
                  memoryUsage={task.metrics.memoryUsage}
                  modelProvider={task.modelProvider}
                />
              )}

              {/* Bottom Row: Timestamp and Actions */}
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
                  {task.startedAt 
                    ? `Started ${new Date(task.startedAt).toLocaleString()}`
                    : `Created ${new Date(task.createdAt).toLocaleDateString()}`
                  }
                </Typography>

                {/* Right: Action Buttons */}
                <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
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

                  <Tooltip title="View Results">
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      onClick={handleViewMarkdown}
                      disabled={!task.resultPath}
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
          <Stack spacing={1.5} sx={{ width: '100%' }}>
            {/* Task Description */}
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
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
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

            {/* Task Metrics */}
            {task.metrics && (
              <TaskMetricsSummary
                rounds={task.metrics.rounds}
                maxRounds={task.metrics.maxRounds}
                tokens={task.metrics.tokens}
                estimatedCost={task.metrics.estimatedCost}
                cpuUsage={task.metrics.cpuUsage}
                memoryUsage={task.metrics.memoryUsage}
                modelProvider={task.modelProvider}
              />
            )}

            {/* Bottom Row: Timestamp and Actions */}
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
                {task.startedAt 
                  ? `Started ${new Date(task.startedAt).toLocaleString()}`
                  : `Created ${new Date(task.createdAt).toLocaleDateString()}`
                }
              </Typography>

              {/* Right: Actions */}
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
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

                <Tooltip title="View Results">
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={handleViewMarkdown}
                    disabled={!task.resultPath}
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
        </ListItemContent>
      </ListItemButton>
    </ListItem>
  )
}

