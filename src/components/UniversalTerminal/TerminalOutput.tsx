/**
 * Terminal Output
 * Renders the terminal output area with auto-scroll
 */

import { useRef, useEffect } from 'react'
import { useTerminal } from '@/hooks/useTerminal'
import { TerminalLine } from './TerminalLine'

export function TerminalOutput() {
  const { getFilteredLines, settings } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)

  const lines = getFilteredLines()

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (settings.autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [lines, settings.autoScroll])

  return (
    <div
      ref={outputRef}
      className="flex-1 bg-[#1e1e1e] text-[#d4d4d4] p-2 overflow-y-auto overflow-x-hidden font-mono text-sm scrollbar-thin scrollbar-track-[#2d2d2d] scrollbar-thumb-[#555] hover:scrollbar-thumb-[#666]"
    >
      {lines.length === 0 ? (
        <div className="flex items-center justify-center h-full text-[#888]">
          <p className="text-sm">No output yet. Start a task to see terminal output here.</p>
        </div>
      ) : (
        <div>
          {lines.map((line) => (
            <TerminalLine key={line.id} line={line} />
          ))}
        </div>
      )}
    </div>
  )
}
