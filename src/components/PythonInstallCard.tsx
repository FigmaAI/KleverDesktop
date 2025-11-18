import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Box,
  Typography,
  Sheet,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import Terminal, { ColorMode, TerminalOutput } from 'react-terminal-ui'
import { ToolStatus } from '@/types/setupWizard'

interface PythonInstallCardProps {
  status: ToolStatus
  onInstall: () => void
  delay: number
}

export function PythonInstallCard({
  status,
  onInstall,
  delay,
}: PythonInstallCardProps) {
  const [terminalLines, setTerminalLines] = useState<React.ReactNode[]>([])
  const [progress, setProgress] = useState(0)
  const [terminalExpanded, setTerminalExpanded] = useState(false)

  // Listen for Python download progress
  useEffect(() => {
    if (!status.installing) return

    let lineCount = 0

    const handleProgress = (data: string) => {
      lineCount++
      // Estimate progress based on output lines
      // Download: ~30%, Extract: ~30%, Dependencies: ~40%
      const estimatedProgress = Math.min(95, lineCount * 5)
      setProgress(estimatedProgress)

      setTerminalLines((prev) => [
        ...prev,
        <TerminalOutput key={prev.length}>{data}</TerminalOutput>,
      ])
    }

    window.electronAPI.onPythonProgress(handleProgress)

    return () => {
      window.electronAPI.removeAllListeners('python:progress')
    }
  }, [status.installing])

  // Reset state when installation starts
  useEffect(() => {
    if (status.installing) {
      setTerminalLines([])
      setProgress(0)
    }
  }, [status.installing])

  // Set progress to 100% when installed successfully
  useEffect(() => {
    if (status.installed && !status.installing) {
      setProgress(100)
    }
  }, [status.installed, status.installing])

  const getColor = () => {
    if (status.checking) return 'neutral'
    return status.installed ? 'success' : 'warning'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <Sheet
        variant="soft"
        color={getColor()}
        sx={{
          p: 2,
          borderRadius: 'sm',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {status.checking ? (
              <CircularProgress size="sm" />
            ) : status.installed ? (
              <CheckCircleIcon color="success" />
            ) : (
              <WarningIcon color="warning" />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography
                level="body-sm"
                fontWeight={status.installed ? 'md' : 'normal'}
                textColor={status.installed ? 'text.primary' : 'text.secondary'}
              >
                Python 3.11.9
              </Typography>
              {status.version && (
                <Typography level="body-xs" textColor="text.tertiary">
                  {status.version}
                </Typography>
              )}
              {!status.installed && !status.installing && (
                <Typography level="body-xs" textColor="text.tertiary">
                  Will be installed to ~/.klever-desktop/python/
                </Typography>
              )}
              {status.error && !status.installing && (
                <Typography level="body-xs" textColor="danger.500">
                  {status.error}
                </Typography>
              )}
            </Box>
          </Box>
          {!status.installed && !status.checking && (
            <Button
              size="sm"
              variant="solid"
              color="primary"
              loading={status.installing}
              onClick={onInstall}
              sx={{ minWidth: '100px' }}
            >
              {status.error ? 'Retry' : 'Install'}
            </Button>
          )}
        </Box>

        {/* Progress bar during installation */}
        {status.installing && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress
              determinate
              value={progress}
              sx={{ mb: 1 }}
            />
            <Typography level="body-xs" textAlign="center" textColor="text.tertiary">
              {progress}%
            </Typography>
          </Box>
        )}

        {/* Guide message during installation */}
        {status.installing && (
          <Alert
            color="primary"
            variant="soft"
            sx={{ mt: 1, mb: 1 }}
          >
            <Typography level="body-sm">
              Downloading Python 3.11.9 and dependencies. This may take a few minutes.
              Expand the terminal below to see detailed progress.
            </Typography>
          </Alert>
        )}

        {/* Terminal output during installation - collapsible */}
        {status.installing && terminalLines.length > 0 && (
          <Accordion
            expanded={terminalExpanded}
            onChange={(_, expanded) => setTerminalExpanded(expanded)}
          >
            <AccordionSummary indicator={<ExpandMoreIcon />}>
              <Typography level="body-sm">
                {terminalExpanded ? 'Hide' : 'Show'} installation details
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{
                '& .react-terminal-wrapper': {
                  fontSize: '10px !important',
                },
                '& .react-terminal-line': {
                  fontSize: '10px !important',
                }
              }}>
                <Terminal name="Python Installation" colorMode={ColorMode.Dark}>
                  {terminalLines}
                </Terminal>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Error message with retry guidance */}
        {status.error && !status.installing && (
          <Alert
            color="danger"
            variant="soft"
          >
            <Typography level="body-sm">
              Installation failed. Please check your internet connection and try again.
              If the problem persists, you may need to install Python manually.
            </Typography>
          </Alert>
        )}
      </Sheet>
    </motion.div>
  )
}
