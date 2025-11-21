/**
 * Terminal Line
 * Renders a single terminal output line with timestamp and formatting
 */

import type { TerminalLine as TerminalLineType } from '@/types/terminal'
import { renderAnsi } from '@/utils/ansiParser'
import { cn } from '@/lib/utils'

interface TerminalLineProps {
  line: TerminalLineType
  showTimestamp?: boolean
}

export function TerminalLine({ line, showTimestamp = true }: TerminalLineProps) {
  // Get color based on level
  const getColor = () => {
    switch (line.level) {
      case 'error':
        return 'text-red-500' // Red
      case 'warning':
        return 'text-orange-500' // Orange
      case 'info':
      default:
        return 'text-[#d4d4d4]' // Light gray (VS Code default)
    }
  }

  // Get source label and color
  const getSourceBadge = () => {
    const badges = {
      task: { label: 'TASK', color: 'text-green-500' },
      project: { label: 'PROJ', color: 'text-blue-500' },
      env: { label: 'SETUP', color: 'text-purple-500' },
      integration: { label: 'TEST', color: 'text-orange-500' },
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
    <div
      className={cn(
        'font-mono text-sm whitespace-pre-wrap break-words leading-relaxed',
        'py-0.5 flex gap-2 hover:bg-white/5',
        getColor()
      )}
    >
      {showTimestamp && (
        <span className="text-gray-500 text-xs flex-shrink-0 select-none">
          {formatTimestamp(line.timestamp)}
        </span>
      )}

      <span
        className={cn(
          'text-xs font-bold flex-shrink-0 select-none min-w-[45px]',
          sourceBadge.color
        )}
      >
        [{sourceBadge.label}]
      </span>

      <span className={cn('flex-1', getColor())}>{renderAnsi(line.content)}</span>
    </div>
  )
}
