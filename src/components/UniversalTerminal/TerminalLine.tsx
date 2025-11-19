/**
 * Terminal Line
 * Renders a single terminal output line with timestamp and formatting
 */

import { Box, Typography } from '@mui/joy'
import type { TerminalLine as TerminalLineType } from '@/types/terminal'

interface TerminalLineProps {
  line: TerminalLineType
  showTimestamp?: boolean
}

export function TerminalLine({ line, showTimestamp = true }: TerminalLineProps) {
  // Get color based on level
  const getColor = () => {
    switch (line.level) {
      case 'error':
        return '#f44336' // Red
      case 'warning':
        return '#ff9800' // Orange
      case 'info':
      default:
        return '#d4d4d4' // Light gray (VS Code default)
    }
  }

  // Get source label and color
  const getSourceBadge = () => {
    const badges = {
      task: { label: 'TASK', color: '#4caf50' },
      project: { label: 'PROJ', color: '#2196f3' },
      env: { label: 'SETUP', color: '#9c27b0' },
      integration: { label: 'TEST', color: '#ff9800' },
    }

    return badges[line.source]
  }

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const sourceBadge = getSourceBadge()

  return (
    <Box
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        color: getColor(),
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.5,
        py: 0.25,
        display: 'flex',
        gap: 1,
        '&:hover': {
          bgcolor: 'rgba(255, 255, 255, 0.05)',
        },
      }}
    >
      {showTimestamp && (
        <Typography
          component="span"
          sx={{
            color: '#858585',
            fontSize: '0.75rem',
            flexShrink: 0,
            userSelect: 'none',
          }}
        >
          {formatTimestamp(line.timestamp)}
        </Typography>
      )}

      <Typography
        component="span"
        sx={{
          color: sourceBadge.color,
          fontSize: '0.75rem',
          fontWeight: 'bold',
          flexShrink: 0,
          userSelect: 'none',
          minWidth: '45px',
        }}
      >
        [{sourceBadge.label}]
      </Typography>

      <Typography
        component="span"
        sx={{
          flex: 1,
          color: getColor(),
        }}
      >
        {line.content}
      </Typography>
    </Box>
  )
}
