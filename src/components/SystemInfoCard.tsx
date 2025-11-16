import {
  Box,
  Typography,
  Sheet,
  Stack,
  Chip,
  LinearProgress,
} from '@mui/joy'
import {
  Computer as ComputerIcon,
  Memory as MemoryIcon,
  Code as CodeIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { SystemInfo } from '@/hooks/useSettings'

interface SystemInfoCardProps {
  systemInfo: SystemInfo
}

export function SystemInfoCard({ systemInfo }: SystemInfoCardProps) {
  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0.00 GB'
    const gb = bytes / (1024 ** 3)
    return `${gb.toFixed(2)} GB`
  }

  const memoryUsagePercent = systemInfo.totalMemory > 0
    ? ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100
    : 0

  const isDataLoaded = systemInfo.platform && systemInfo.platform !== ''

  const getEnvStatusColor = (status?: string) => {
    switch (status) {
      case 'ready':
        return 'success'
      case 'not_ready':
        return 'danger'
      case 'checking':
        return 'neutral'
      default:
        return 'neutral'
    }
  }

  const getEnvStatusIcon = (status?: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircleIcon />
      case 'not_ready':
        return <ErrorIcon />
      case 'checking':
        return <WarningIcon />
      default:
        return <WarningIcon />
    }
  }

  const getEnvStatusText = (status?: string) => {
    switch (status) {
      case 'ready':
        return 'Ready'
      case 'not_ready':
        return 'Not Ready'
      case 'checking':
        return 'Checking...'
      default:
        return 'Unknown'
    }
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 'md',
        bgcolor: 'background.surface',
      }}
    >
      <Typography level="title-lg" sx={{ mb: 1 }}>
        System Information
      </Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
        Current system status and environment details
      </Typography>

      <Stack spacing={2.5}>
        {!isDataLoaded && (
          <Box
            sx={{
              p: 2,
              borderRadius: 'sm',
              bgcolor: 'neutral.softBg',
              border: '1px solid',
              borderColor: 'neutral.outlinedBorder',
              textAlign: 'center',
            }}
          >
            <Typography level="body-sm" textColor="text.secondary">
              Loading system information...
            </Typography>
          </Box>
        )}

        {isDataLoaded && (
          <>
            {/* Platform Info */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <ComputerIcon fontSize="small" color="action" />
                <Typography level="title-sm" fontWeight="bold">
                  Platform
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ ml: 3 }} flexWrap="wrap">
                <Chip size="sm" variant="soft" color="primary">
                  {systemInfo.platform || 'Unknown'}
                </Chip>
                <Chip size="sm" variant="soft" color="primary">
                  {systemInfo.arch || 'Unknown'}
                </Chip>
                <Chip size="sm" variant="soft" color="primary">
                  {systemInfo.cpus || 0} CPU{systemInfo.cpus !== 1 ? 's' : ''}
                </Chip>
              </Stack>
            </Box>

            {/* Memory Info */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <MemoryIcon fontSize="small" color="action" />
                <Typography level="title-sm" fontWeight="bold">
                  Memory
                </Typography>
              </Box>
              <Box sx={{ ml: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography level="body-sm">
                    Used: {formatMemory(systemInfo.totalMemory - systemInfo.freeMemory)}
                  </Typography>
                  <Typography level="body-sm">
                    Total: {formatMemory(systemInfo.totalMemory)}
                  </Typography>
                </Box>
                <LinearProgress
                  determinate
                  value={memoryUsagePercent}
                  color={
                    memoryUsagePercent > 90
                      ? 'danger'
                      : memoryUsagePercent > 70
                        ? 'warning'
                        : 'primary'
                  }
                  sx={{ height: 6, borderRadius: 'sm' }}
                />
                <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>
                  {memoryUsagePercent.toFixed(1)}% used • {formatMemory(systemInfo.freeMemory)} free
                </Typography>
              </Box>
            </Box>

            {/* Python Environment */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CodeIcon fontSize="small" color="action" />
                <Typography level="title-sm" fontWeight="bold">
                  Python Environment
                </Typography>
              </Box>
              <Stack spacing={1} sx={{ ml: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="body-sm">Version</Typography>
                  <Typography level="body-sm" fontFamily="monospace">
                    {systemInfo.pythonVersion || 'Not detected'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="body-sm">Status</Typography>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={getEnvStatusColor(systemInfo.envStatus)}
                    startDecorator={getEnvStatusIcon(systemInfo.envStatus)}
                  >
                    {getEnvStatusText(systemInfo.envStatus)}
                  </Chip>
                </Box>
              </Stack>
            </Box>
            {/* Status Summary */}
            {systemInfo.envStatus === 'not_ready' && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 'sm',
                  bgcolor: 'warning.softBg',
                  border: '1px solid',
                  borderColor: 'warning.outlinedBorder',
                }}
              >
                <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                  Action Required
                </Typography>
                <Typography level="body-xs" textColor="text.secondary">
                  Python environment is not properly configured. Please run the setup wizard to configure your environment.
                </Typography>
              </Box>
            )}

            {systemInfo.envStatus === 'ready' && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 'sm',
                  bgcolor: 'success.softBg',
                  border: '1px solid',
                  borderColor: 'success.outlinedBorder',
                }}
              >
                <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                  All Systems Ready
                </Typography>
                <Typography level="body-xs" textColor="text.secondary">
                  Your environment is properly configured and ready for automation tasks.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Stack>
    </Sheet>
  )
}
