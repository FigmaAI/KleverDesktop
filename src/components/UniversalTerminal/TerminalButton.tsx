import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTerminal } from '@/hooks/useTerminal'
import { cn } from '@/lib/utils'

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

  // Determine badge styles
  const getBadgeStyles = () => {
    if (errorCount > 0) return 'bg-destructive text-destructive-foreground'
    if (warningCount > 0) return 'bg-yellow-500 text-white'
    return 'bg-primary text-primary-foreground'
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

  const badgeContent = getBadgeContent()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            className={cn('relative', animateAttention && 'animate-pulse-attention')}
          >
            <Terminal className="h-5 w-5" />
            {badgeContent && (
              <span
                className={cn(
                  'absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-semibold',
                  getBadgeStyles()
                )}
              >
                {badgeContent}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{getTooltipMessage()}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
