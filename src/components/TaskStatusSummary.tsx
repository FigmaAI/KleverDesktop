import { Box, Typography, Sheet } from '@mui/joy'
import { CheckCircle, Error as ErrorIcon, PlayArrow } from '@mui/icons-material'
import { ReactNode } from 'react'

interface TaskStatusSummaryProps {
  total: number
  running?: number
  completed?: number
  failed?: number
  showTotal?: boolean
}

interface MetricCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  color?: 'primary' | 'success' | 'danger' | 'neutral'
}

/**
 * Reusable MetricCard component for displaying individual metrics
 * Can be used to add more metrics in the future
 */
function MetricCard({ label, value, icon, color = 'neutral' }: MetricCardProps) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 'sm',
        bgcolor: 'background.surface',
        minWidth: 120,
        flex: 1,
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: `${color}.outlinedBorder`,
          boxShadow: 'sm',
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        {icon}
        <Typography level="body-xs" textColor="text.secondary">
          {label}
        </Typography>
      </Box>
      <Typography level="h4" fontWeight="bold" textColor={`${color}.plainColor`}>
        {value}
      </Typography>
    </Sheet>
  )
}

export function TaskStatusSummary({
  total,
  running = 0,
  completed = 0,
  failed = 0,
  showTotal = true,
}: TaskStatusSummaryProps) {
  if (total === 0) return null

  // Calculate metrics for display
  const metrics: MetricCardProps[] = []

  // Always show total if enabled
  if (showTotal) {
    metrics.push({
      label: 'Total Tasks',
      value: total,
      color: 'neutral',
    })
  }

  // Show running tasks
  if (running > 0) {
    metrics.push({
      label: 'Running',
      value: running,
      icon: <PlayArrow sx={{ fontSize: 16, color: 'primary.500' }} />,
      color: 'primary',
    })
  }

  // Show completed tasks
  if (completed > 0) {
    metrics.push({
      label: 'Completed',
      value: completed,
      icon: <CheckCircle sx={{ fontSize: 16, color: 'success.500' }} />,
      color: 'success',
    })
  }

  // Show failed tasks
  if (failed > 0) {
    metrics.push({
      label: 'Failed',
      value: failed,
      icon: <ErrorIcon sx={{ fontSize: 16, color: 'danger.500' }} />,
      color: 'danger',
    })
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: 1.5,
        width: '100%',
        overflowX: 'auto',
        '&::-webkit-scrollbar': {
          height: '4px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'neutral.outlinedBorder',
          borderRadius: '4px',
        },
      }}
    >
      {metrics.map((metric, index) => (
        <MetricCard key={`${metric.label}-${index}`} {...metric} />
      ))}
    </Box>
  )
}

// Export MetricCard for reuse in other components
export { MetricCard }

