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
                <span className="text-zinc-500 dark:text-zinc-500 text-[0.65rem] opacity-70 mr-2">
                  {line.timestamp.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
                <span
                  className={`text-[0.65rem] font-semibold mr-2 ${{
                    task: 'text-green-600 dark:text-green-400',
                    project: 'text-blue-600 dark:text-blue-400',
                    env: 'text-purple-600 dark:text-purple-400',
                    integration: 'text-orange-600 dark:text-orange-400',
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
                      ? 'text-red-600 dark:text-red-400'
                      : line.level === 'warning'
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-zinc-800 dark:text-zinc-200'
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
