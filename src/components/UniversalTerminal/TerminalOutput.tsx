/**
 * Terminal Output
 * Renders the terminal output area with auto-scroll
 */

import { useRef, useEffect } from 'react'
import { Box, Typography } from '@mui/joy'
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
    <Box
      ref={outputRef}
      sx={{
        flex: 1,
        bgcolor: '#1e1e1e',
        color: '#d4d4d4',
        p: 2,
        overflowY: 'auto',
        overflowX: 'hidden',
        fontFamily: 'monospace',
        fontSize: '0.875rem',
        '&::-webkit-scrollbar': {
          width: '8px',
        },
        '&::-webkit-scrollbar-track': {
          bgcolor: '#2d2d2d',
        },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: '#555',
          borderRadius: '4px',
          '&:hover': {
            bgcolor: '#666',
          },
        },
      }}
    >
      {lines.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#888',
          }}
        >
          <Typography level="body-sm">No output yet. Start a task to see terminal output here.</Typography>
        </Box>
      ) : (
        <Box>
          {lines.map((line) => (
            <TerminalLine key={line.id} line={line} />
          ))}
        </Box>
      )}
    </Box>
  )
}
