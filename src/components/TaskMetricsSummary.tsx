import { Box } from '@mui/joy'
import { Loop, Token, AttachMoney, Memory, Speed } from '@mui/icons-material'
import { MetricCard } from './TaskStatusSummary'

interface TaskMetricsSummaryProps {
  rounds?: number
  maxRounds?: number
  // API model metrics
  tokens?: number
  estimatedCost?: number
  // Local model metrics
  cpuUsage?: number
  memoryUsage?: number
  modelProvider?: 'api' | 'local'
}

export function TaskMetricsSummary({
  rounds,
  maxRounds,
  tokens,
  estimatedCost,
  cpuUsage,
  memoryUsage,
  modelProvider,
}: TaskMetricsSummaryProps) {
  const metrics = []

  // Always show rounds if available
  if (rounds !== undefined) {
    const roundsDisplay = maxRounds ? `${rounds}/${maxRounds}` : rounds
    metrics.push({
      label: 'Rounds',
      value: roundsDisplay,
      icon: <Loop sx={{ fontSize: 16, color: 'primary.500' }} />,
      color: 'primary' as const,
    })
  }

  // API model metrics
  if (modelProvider === 'api') {
    if (tokens !== undefined && tokens > 0) {
      const tokensDisplay = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : tokens
      metrics.push({
        label: 'Tokens',
        value: tokensDisplay,
        icon: <Token sx={{ fontSize: 16, color: 'success.500' }} />,
        color: 'success' as const,
      })
    }

    if (estimatedCost !== undefined && estimatedCost > 0) {
      metrics.push({
        label: 'Est. Cost',
        value: `$${estimatedCost.toFixed(4)}`,
        icon: <AttachMoney sx={{ fontSize: 16, color: 'warning.500' }} />,
        color: 'neutral' as const,
      })
    }
  }

  // Local model metrics
  if (modelProvider === 'local') {
    if (cpuUsage !== undefined && cpuUsage > 0) {
      metrics.push({
        label: 'CPU Usage',
        value: `${cpuUsage.toFixed(1)}%`,
        icon: <Speed sx={{ fontSize: 16, color: 'primary.500' }} />,
        color: 'primary' as const,
      })
    }

    if (memoryUsage !== undefined && memoryUsage > 0) {
      const memoryDisplay = memoryUsage >= 1024 
        ? `${(memoryUsage / 1024).toFixed(1)}GB` 
        : `${memoryUsage.toFixed(0)}MB`
      metrics.push({
        label: 'Memory',
        value: memoryDisplay,
        icon: <Memory sx={{ fontSize: 16, color: 'success.500' }} />,
        color: 'success' as const,
      })
    }
  }

  // Don't render if no metrics
  if (metrics.length === 0) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        width: '100%',
      }}
    >
      {metrics.map((metric, index) => (
        <MetricCard key={`${metric.label}-${index}`} {...metric} />
      ))}
    </Box>
  )
}

