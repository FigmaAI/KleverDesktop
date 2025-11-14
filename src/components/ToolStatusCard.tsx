import { motion } from 'framer-motion'
import { Box, Typography, Sheet, Button, CircularProgress } from '@mui/joy'
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon } from '@mui/icons-material'
import { ToolStatus } from '@/types/setupWizard'

interface ToolStatusCardProps {
  name: string
  subtitle?: string
  status: ToolStatus
  delay: number
  onInstall?: () => void
  installLabel?: string
}

export function ToolStatusCard({
  name,
  subtitle,
  status,
  delay,
  onInstall,
  installLabel = 'Install',
}: ToolStatusCardProps) {
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
          alignItems: 'center',
          gap: 2,
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
          {status.checking ? (
            <CircularProgress size="sm" />
          ) : status.installed ? (
            <CheckCircleIcon color="success" />
          ) : (
            <WarningIcon color="warning" />
          )}
          <Box>
            <Typography
              level="body-sm"
              fontWeight={status.installed ? 'md' : 'normal'}
              textColor={status.installed ? 'text.primary' : 'text.secondary'}
            >
              {name}
            </Typography>
            {status.version && (
              <Typography level="body-xs" textColor="text.tertiary">
                v{status.version}
              </Typography>
            )}
            {subtitle && (
              <Typography level="body-xs" textColor="text.tertiary">
                {subtitle}
              </Typography>
            )}
            {status.error && (
              <Typography level="body-xs" textColor="danger.500">
                {status.error}
              </Typography>
            )}
          </Box>
        </Box>
        {!status.installed && !status.checking && onInstall && (
          <Button
            size="sm"
            variant={installLabel === 'Install' ? 'solid' : 'outlined'}
            color={installLabel === 'Install' ? 'primary' : 'warning'}
            onClick={onInstall}
            loading={status.installing}
            sx={{ minWidth: installLabel === 'Install' ? '100px' : 'auto' }}
          >
            {installLabel}
          </Button>
        )}
      </Sheet>
    </motion.div>
  )
}
