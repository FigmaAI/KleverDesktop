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
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { ToolStatus } from '@/types/setupWizard'

interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

interface EnvironmentSetupProps {
  status: ToolStatus
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => void
}

export function EnvironmentSetup({
  status,
  setToolsStatus,
  checkPlatformTools,
}: EnvironmentSetupProps) {
  const [envSetupProgress, setEnvSetupProgress] = useState(0)

  const handleSetupEnvironment = async () => {
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true } }))
    setEnvSetupProgress(0)

    try {
      let lineCount = 0
      // Listen for progress to estimate completion
      window.electronAPI.onEnvProgress(() => {
        lineCount++
        // Estimate progress based on typical installation steps
        const estimatedProgress = Math.min(95, lineCount * 2)
        setEnvSetupProgress(estimatedProgress)
      })

      const result = await window.electronAPI.envSetup()

      if (result.success) {
        setEnvSetupProgress(100)
        // Recheck platform tools
        await checkPlatformTools()
      } else {
        // Error will be shown in universal terminal
        console.error('[EnvironmentSetup] Setup failed:', result.error)
      }
    } catch (error) {
      console.error('[EnvironmentSetup] Error:', error)
    } finally {
      setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: false } }))
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
                Playwright Browsers
              </Typography>
              <Typography level="body-xs" textColor="text.tertiary">
                Required for web automation (Chromium browser)
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
              Installation in progress. Check the Universal Terminal (top right) for detailed progress.
            </Typography>
          </Alert>
        )}
      </Sheet>
    </motion.div>
  )
}
