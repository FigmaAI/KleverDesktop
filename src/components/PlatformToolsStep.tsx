import { motion } from 'framer-motion'
import { Box, Typography, Sheet, Stack, Button } from '@mui/joy'
import { Refresh as RefreshIcon } from '@mui/icons-material'
import { ToolStatusCard } from './ToolStatusCard'
import { EnvironmentSetup } from './EnvironmentSetup'
import { ToolStatus } from '@/types/setupWizard'

interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

interface PlatformToolsStepProps {
  toolsStatus: PlatformToolsState
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => void
}

export function PlatformToolsStep({
  toolsStatus,
  setToolsStatus,
  checkPlatformTools,
}: PlatformToolsStepProps) {
  const isMac = window.navigator.platform.toLowerCase().includes('mac')

  return (
    <motion.div
      key="step-0"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Sheet
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 'md',
          bgcolor: 'background.surface',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography level="h4" fontWeight="bold">
            Platform & Runtime Tools Check
          </Typography>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            onClick={checkPlatformTools}
            startDecorator={<RefreshIcon />}
          >
            Recheck
          </Button>
        </Box>
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
          We&apos;re checking if all required tools are installed and configured correctly.
        </Typography>

        <Stack spacing={1.5}>
          {/* Homebrew (macOS only) */}
          {isMac && (
            <ToolStatusCard
              name="Homebrew"
              status={toolsStatus.homebrew}
              delay={0.1}
              onInstall={() => window.electronAPI.openExternal('https://brew.sh')}
              installLabel="Install Guide"
            />
          )}

          {/* Python 3.11+ */}
          <ToolStatusCard
            name="Python 3.11+"
            status={toolsStatus.python}
            delay={0.2}
          />

          {/* Python Environment (venv + packages + Playwright) */}
          <EnvironmentSetup
            status={toolsStatus.pythonEnv}
            setToolsStatus={setToolsStatus}
            checkPlatformTools={checkPlatformTools}
          />

          {/* Android Studio */}
          <ToolStatusCard
            name="Android Studio"
            status={toolsStatus.androidStudio}
            delay={0.4}
            onInstall={() => window.electronAPI.openExternal('https://developer.android.com/studio')}
            installLabel="Install Guide"
          />
        </Stack>
      </Sheet>
    </motion.div>
  )
}
