/**
 * Terminal Header
 * Header with tabs, controls, and drag handle
 */

import { GripVertical, X, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTerminal } from '@/hooks/useTerminal'
import type { TerminalTab } from '@/types/terminal'

export function TerminalHeader() {
  const { activeTab, setActiveTab, processes, clearLines, setIsOpen, getFilteredLines } = useTerminal()

  const runningCount = processes.filter((p) => p.status === 'running').length

  const handleClear = () => {
    if (confirm('Clear all terminal output?')) {
      clearLines()
    }
  }

  const handleCopy = () => {
    const lines = getFilteredLines()
    const text = lines.map((line) => line.content).join('\n')

    // Use textarea method for better Electron compatibility
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()

    try {
      document.execCommand('copy')
    } catch (err) {
      console.error('[Terminal] Failed to copy:', err)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 border-b border-border bg-background select-none cursor-grab active:cursor-grabbing">
      {/* Drag indicator */}
      <GripVertical className="h-5 w-5 text-muted-foreground" />

      {/* Title */}
      <h3 className="text-sm font-bold flex-shrink-0">
        Terminal
        {runningCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">({runningCount} running)</span>
        )}
      </h3>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TerminalTab)} className="flex-1 min-w-0">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Controls */}
      <TooltipProvider>
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy output</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={handleClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear output</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close terminal</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  )
}
