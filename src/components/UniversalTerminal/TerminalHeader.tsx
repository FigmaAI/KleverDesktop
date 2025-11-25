/**
 * Terminal Header
 * Simple header with title and controls
 */

import { GripVertical, X, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTerminal } from '@/hooks/useTerminal'

export function TerminalHeader() {
  const { processes, clearLines, setIsOpen, lines } = useTerminal()

  const runningCount = processes.filter((p) => p.status === 'running').length

  const handleClear = () => {
    if (confirm('Clear all terminal output?')) {
      clearLines()
    }
  }

  const handleCopy = async () => {
    // Copy last 100 lines only
    const lastLines = lines.slice(-100)
    const text = lastLines.map((line) => line.content).join('\n')

    try {
      // Use Electron clipboard API
      const result = await window.electronAPI.clipboardWriteText(text)
      if (result.success) {
        console.log(`[Terminal] Copied ${lastLines.length} lines to clipboard`)
      } else {
        console.error('[Terminal] Failed to copy:', result.error)
      }
    } catch (err) {
      console.error('[Terminal] Failed to copy:', err)
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30 select-none cursor-grab active:cursor-grabbing">
      {/* Drag indicator */}
      <GripVertical className="h-4 w-4 text-muted-foreground" />

      {/* Title */}
      <div className="flex-1">
        <h3 className="text-sm font-semibold">
          Terminal
          {runningCount > 0 && (
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              ({runningCount} running)
            </span>
          )}
        </h3>
      </div>

      {/* Controls */}
      <TooltipProvider delayDuration={300}>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleCopy} disabled={lines.length === 0}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy output</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleClear} disabled={lines.length === 0}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear output</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close terminal</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
