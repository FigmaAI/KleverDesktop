import React, { useState } from 'react'
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

interface EnvironmentSetupProps {
  status: ToolStatus
  onSetup: () => void
  setToolsStatus: React.Dispatch<React.SetStateAction<any>>
  checkPlatformTools: () => void
}

export function EnvironmentSetup({
  status,
  onSetup,
  setToolsStatus,
  checkPlatformTools,
}: EnvironmentSetupProps) {
  const [envSetupTerminalLines, setEnvSetupTerminalLines] = useState<React.ReactNode[]>([])
  const [envSetupProgress, setEnvSetupProgress] = useState(0)
  const [terminalExpanded, setTerminalExpanded] = useState(false)

  const handleSetupEnvironment = async () => {
    setToolsStatus((prev: any) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true } }))
    setEnvSetupTerminalLines([])
    setEnvSetupProgress(0)

    try {
      let lineCount = 0
      // Listen for progress
      window.electronAPI.onEnvProgress((data: string) => {
        lineCount++
        // Estimate progress based on typical installation steps (rough estimation)
        // Creating venv: ~10%, Installing packages: ~70%, Installing Playwright: ~20%
        const estimatedProgress = Math.min(95, lineCount * 2)
        setEnvSetupProgress(estimatedProgress)

        setEnvSetupTerminalLines((prev) => [...prev, <TerminalOutput key={prev.length}>{data}</TerminalOutput>])
      })

      const result = await window.electronAPI.envSetup()

      if (result.success) {
        setEnvSetupProgress(100)
        setEnvSetupTerminalLines((prev) => [
          ...prev,
          <TerminalOutput key={prev.length}>
            <span style={{ color: '#4caf50' }}>✅ Environment setup complete!</span>
          </TerminalOutput>,
        ])
        // Recheck platform tools
        await checkPlatformTools()
      } else {
        setEnvSetupTerminalLines((prev) => [
          ...prev,
          <TerminalOutput key={prev.length}>
            <span style={{ color: '#f44336' }}>❌ Setup failed: {result.error}</span>
          </TerminalOutput>,
        ])
      }
    } catch (error) {
      setEnvSetupTerminalLines((prev) => [
        ...prev,
        <TerminalOutput key={prev.length}>
          <span style={{ color: '#f44336' }}>Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </TerminalOutput>,
      ])
    } finally {
      setToolsStatus((prev: any) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: false } }))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Sheet
        variant="soft"
        color={status.checking ? 'neutral' : status.installed ? 'success' : 'warning'}
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
                Python Environment
              </Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                Includes: Virtual environment, packages, and Playwright browsers
              </Typography>
            </Box>
          </Box>
          {!status.installed && !status.checking && (
            <Button
              size="sm"
              variant="solid"
              color="primary"
              loading={status.installing}
              onClick={handleSetupEnvironment}
              sx={{ minWidth: '100px' }}
            >
              Setup
            </Button>
          )}
        </Box>

        {/* Progress bar during installation */}
        {status.installing && (
          <Box sx={{ width: '100%' }}>
            <LinearProgress
              determinate
              value={envSetupProgress}
              sx={{ mb: 1 }}
            />
            <Typography level="body-xs" textAlign="center" textColor="text.tertiary">
              {envSetupProgress}%
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
              Installation in progress. Expand the terminal below to see detailed progress.
            </Typography>
          </Alert>
        )}

        {/* Terminal output during installation - collapsible */}
        {status.installing && envSetupTerminalLines.length > 0 && (
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
                <Terminal name="Environment Setup" colorMode={ColorMode.Dark}>
                  {envSetupTerminalLines}
                </Terminal>
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Sheet>
    </motion.div>
  )
}
