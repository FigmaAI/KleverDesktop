import { Box, Typography } from '@mui/joy'
import { CheckCircle, Error as ErrorIcon, PlayArrow } from '@mui/icons-material'

interface TaskStatusSummaryProps {
  total: number
  running?: number
  completed?: number
  failed?: number
  showTotal?: boolean
}

export function TaskStatusSummary({
  total,
  running = 0,
  completed = 0,
  failed = 0,
  showTotal = true,
}: TaskStatusSummaryProps) {
  if (total === 0) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Total Tasks */}
      {showTotal && (
        <Typography level="body-sm" textColor="text.secondary">
          {total} {total === 1 ? 'task' : 'tasks'}:
        </Typography>
      )}

      {/* Status Icons with Counts */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {running > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PlayArrow sx={{ fontSize: 16, color: 'primary.500' }} />
            <Typography level="body-sm" fontWeight="md" textColor="primary.500">
              {running}
            </Typography>
          </Box>
        )}
        
        {completed > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CheckCircle sx={{ fontSize: 16, color: 'success.500' }} />
            <Typography level="body-sm" fontWeight="md" textColor="success.500">
              {completed}
            </Typography>
          </Box>
        )}
        
        {failed > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ErrorIcon sx={{ fontSize: 16, color: 'danger.500' }} />
            <Typography level="body-sm" fontWeight="md" textColor="danger.500">
              {failed}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

