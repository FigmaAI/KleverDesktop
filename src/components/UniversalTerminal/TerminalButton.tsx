import { IconButton, Badge, Tooltip } from '@mui/joy'
import { Terminal as TerminalIcon } from '@mui/icons-material'
import { useTerminal } from '@/hooks/useTerminal'
import { keyframes } from '@emotion/react'

const pulseAnimation = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0.7);
  }
  70% {
    transform: scale(1.05);
    box-shadow: 0 0 0 10px rgba(0, 123, 255, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(0, 123, 255, 0);
  }
`

interface TerminalButtonProps {
  animateAttention?: boolean
}

export function TerminalButton({ animateAttention = false }: TerminalButtonProps) {
  const { isOpen, setIsOpen, processes, errorCount, warningCount, clearNotifications } = useTerminal()

  const runningCount = processes.filter((p) => p.status === 'running').length

  // Determine badge content
  const getBadgeContent = () => {
    if (errorCount > 0) return '⚠️'
    if (warningCount > 0) return '!'
    if (runningCount > 1) return runningCount.toString()
    return null
  }

  // Determine badge color
  const getBadgeColor = () => {
    if (errorCount > 0) return 'danger'
    if (warningCount > 0) return 'warning'
    return 'neutral'
  }

  // Tooltip message
  const getTooltipMessage = () => {
    if (errorCount > 0) return `Terminal (${errorCount} error${errorCount > 1 ? 's' : ''})`
    if (warningCount > 0) return `Terminal (${warningCount} warning${warningCount > 1 ? 's' : ''})`
    if (runningCount > 0) return `Terminal (${runningCount} running)`
    return 'Terminal'
  }

  const handleClick = () => {
    if (!isOpen) {
      // Clear notification badges when opening terminal
      clearNotifications()
    }
    setIsOpen(!isOpen)
  }

  return (
    <Tooltip title={getTooltipMessage()}>
      <IconButton
        variant="plain"
        color="neutral"
        onClick={handleClick}
        sx={{
          position: 'relative',
          animation: animateAttention ? `${pulseAnimation} 1s ease-out forwards` : 'none',
        }}
      >
        <Badge badgeContent={getBadgeContent()} color={getBadgeColor()} size="sm">
          <TerminalIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  )
}
