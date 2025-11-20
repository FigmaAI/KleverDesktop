/**
 * Terminal Header
 * Header with tabs, controls, and drag handle
 */

import { Box, Typography, IconButton, Tabs, TabList, Tab, Tooltip } from '@mui/joy'
import {
  Close as CloseIcon,
  Delete as ClearIcon,
  DragIndicator as DragIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
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
      const successful = document.execCommand('copy')
      if (successful) {
        console.log('[Terminal] Output copied to clipboard')
      } else {
        console.error('[Terminal] Failed to copy')
      }
    } catch (err) {
      console.error('[Terminal] Failed to copy:', err)
    } finally {
      document.body.removeChild(textarea)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.surface',
        cursor: 'grab',
        userSelect: 'none',
        '&:active': {
          cursor: 'grabbing',
        },
      }}
    >
      {/* Drag indicator */}
      <DragIcon sx={{ color: 'text.tertiary', fontSize: '1.2rem' }} />

      {/* Title */}
      <Typography level="title-sm" fontWeight="bold" sx={{ flex: 0 }}>
        Terminal
        {runningCount > 0 && (
          <Typography component="span" level="body-xs" sx={{ ml: 1, color: 'text.tertiary' }}>
            ({runningCount} running)
          </Typography>
        )}
      </Typography>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, value) => setActiveTab(value as TerminalTab)}
        sx={{ flex: 1, minWidth: 0 }}
        size="sm"
      >
        <TabList>
          <Tab value="all">All</Tab>
          <Tab value="tasks">Tasks</Tab>
          <Tab value="projects">Projects</Tab>
          <Tab value="setup">Setup</Tab>
        </TabList>
      </Tabs>

      {/* Controls */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Tooltip title="Copy output">
          <IconButton size="sm" variant="plain" color="neutral" onClick={handleCopy}>
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Clear output">
          <IconButton size="sm" variant="plain" color="neutral" onClick={handleClear}>
            <ClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="Close terminal">
          <IconButton size="sm" variant="plain" color="neutral" onClick={() => setIsOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
