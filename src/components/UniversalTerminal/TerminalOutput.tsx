/**
 * Terminal Output
 * Renders the terminal output area using Magic UI Terminal component
 */

import { useRef, useEffect } from 'react'
import { useTerminal } from '@/hooks/useTerminal'
import { Terminal, AnimatedSpan } from '@/components/ui/terminal'
import { renderAnsi } from '@/utils/ansiParser'

export function TerminalOutput() {
  const { lines, settings } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (settings.autoScroll && outputRef.current) {
      const preElement = outputRef.current.querySelector('pre')
      if (preElement) {
        preElement.scrollTop = preElement.scrollHeight
      }
    }
  }, [lines, settings.autoScroll])

  return (
    <div ref={outputRef} className="flex-1 overflow-hidden">
      <Terminal
        sequence={false}
        className="h-full border-0 rounded-none max-w-none"
        title="Output"
      >
        {lines.length === 0 ? (
          <AnimatedSpan className="text-muted-foreground">
            No output yet. Terminal logs will appear here.
          </AnimatedSpan>
        ) : (
          <>
            {lines.map((line) => (
              <AnimatedSpan key={line.id} className="font-mono text-xs">
                <span className="text-[#7d8590] text-[0.65rem] opacity-70 mr-2">
                  {line.timestamp.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`text-[0.65rem] font-semibold mr-2 ${
                    {
                      task: 'text-[#7ee787]',
                      project: 'text-[#79c0ff]',
                      env: 'text-[#d2a8ff]',
                      integration: 'text-[#ffa657]',
                    }[line.source]
                  }`}
                >
                  [
                  {
                    {
                      task: 'TASK',
                      project: 'PROJ',
                      env: 'SETUP',
                      integration: 'TEST',
                    }[line.source]
                  }
                  ]
                </span>
                <span
                  className={
                    line.level === 'error'
                      ? 'text-[#ff7b72]'
                      : line.level === 'warning'
                        ? 'text-[#ffa657]'
                        : 'text-[#e6edf3]'
                  }
                >
                  {renderAnsi(line.content)}
                </span>
              </AnimatedSpan>
            ))}
          </>
        )}
      </Terminal>
    </div>
  )
}
