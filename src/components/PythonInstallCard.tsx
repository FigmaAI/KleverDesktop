import { useState, useEffect } from 'react'
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
  const [progress, setProgress] = useState(0)

  // Listen for Python download progress to estimate completion
  useEffect(() => {
    if (!status.installing) return

    let lineCount = 0

    const handleProgress = () => {
      lineCount++
      // Estimate progress based on output lines
      // Download: ~30%, Extract: ~30%, Dependencies: ~40%
      const estimatedProgress = Math.min(95, lineCount * 5)
      setProgress(estimatedProgress)
    }

    window.electronAPI.onPythonProgress(handleProgress)

    return () => {
      window.electronAPI.removeAllListeners('python:progress')
    }
  }, [status.installing])

  // Reset state when installation starts
  useEffect(() => {
    if (status.installing) {
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
              Check the Universal Terminal (top right) for detailed progress.
            </Typography>
          </Alert>
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
