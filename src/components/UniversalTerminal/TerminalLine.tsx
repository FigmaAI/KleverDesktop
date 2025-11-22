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
        return 'text-[#ff7b72]' // GitHub red
      case 'warning':
        return 'text-[#ffa657]' // GitHub orange
      case 'info':
      default:
        return 'text-[#e6edf3]' // GitHub light
    }
  }

  // Get source label and color
  const getSourceBadge = () => {
    const badges = {
      task: { label: 'TASK', color: 'text-[#7ee787]' }, // GitHub green
      project: { label: 'PROJ', color: 'text-[#79c0ff]' }, // GitHub blue
      env: { label: 'SETUP', color: 'text-[#d2a8ff]' }, // GitHub purple
      integration: { label: 'TEST', color: 'text-[#ffa657]' }, // GitHub orange
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
        'font-mono text-xs whitespace-pre-wrap break-words leading-relaxed',
        'py-0.5 px-1 flex gap-2 rounded hover:bg-[#1c2128] transition-colors',
        getColor()
      )}
    >
      {showTimestamp && (
        <span className="text-[#7d8590] text-[0.65rem] flex-shrink-0 select-none opacity-70">
          {formatTimestamp(line.timestamp)}
        </span>
      )}

      <span
        className={cn(
          'text-[0.65rem] font-semibold flex-shrink-0 select-none min-w-[50px]',
          sourceBadge.color
        )}
      >
        [{sourceBadge.label}]
      </span>

      <span className={cn('flex-1', getColor())}>{renderAnsi(line.content)}</span>
    </div>
  )
}
