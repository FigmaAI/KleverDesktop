/**
 * Terminal Output
 * Renders the terminal output area with auto-scroll
 */

import { useRef, useEffect } from 'react'
import { useTerminal } from '@/hooks/useTerminal'
import { TerminalLine } from './TerminalLine'

export function TerminalOutput() {
  const { lines, settings } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (settings.autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines, settings.autoScroll])

  return (
    <div
      ref={outputRef}
      className="flex-1 bg-[#0d1117] text-[#e6edf3] p-3 overflow-y-auto overflow-x-hidden font-mono text-xs leading-relaxed scrollbar-thin scrollbar-track-[#161b22] scrollbar-thumb-[#30363d] hover:scrollbar-thumb-[#484f58]"
    >
      {lines.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground">
            No output yet. Terminal logs will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {lines.map((line) => (
            <TerminalLine key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
