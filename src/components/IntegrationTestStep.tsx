import { motion } from 'framer-motion'
import {
  Box,
  Typography,
  Sheet,
  Button,
  Alert,
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'

interface IntegrationTestStepProps {
  integrationTestRunning: boolean
  integrationTestComplete: boolean
  integrationTestSuccess: boolean
  onRunTest: () => void
  onStopTest: () => void
}

export function IntegrationTestStep({
  integrationTestRunning,
  integrationTestComplete,
  integrationTestSuccess,
  onRunTest,
  onStopTest,
}: IntegrationTestStepProps) {
  return (
    <motion.div
      key="step-2"
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
        <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Final Integration Test
        </Typography>
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
          Run the integration test to verify your setup
        </Typography>

        {!integrationTestRunning && !integrationTestComplete && (
          <Button
            variant="solid"
            color="primary"
            onClick={onRunTest}
            fullWidth
            sx={{ mb: 2 }}
          >
            Run Integration Test
          </Button>
        )}

        {/* Guide message when test is running */}
        {integrationTestRunning && (
          <Alert
            color="primary"
            variant="soft"
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                Test in progress...
              </Typography>
              <Typography level="body-sm">
                Please wait while the browser opens and closes.
                The terminal below will show detailed progress.
              </Typography>
            </Box>
          </Alert>
        )}

        {/* Retry/Stop Button */}
        {(integrationTestRunning || integrationTestComplete) && (
          <Button
            variant="outlined"
            color={integrationTestRunning ? "danger" : "neutral"}
            onClick={integrationTestRunning ? onStopTest : onRunTest}
            fullWidth
            sx={{ mb: 2 }}
            startDecorator={integrationTestRunning ? null : <RefreshIcon />}
          >
            {integrationTestRunning ? "Stop Test" : "Retry Test"}
          </Button>
        )}

        {integrationTestComplete && integrationTestSuccess && (
          <Alert color="success" startDecorator={<CheckCircleIcon />} sx={{ mt: 2 }}>
            Setup complete! All tests passed successfully.
          </Alert>
        )}

        {integrationTestComplete && !integrationTestSuccess && (
          <Alert color="danger" startDecorator={<WarningIcon />} sx={{ mt: 2 }}>
            Integration test failed. Please review the output and fix any issues.
          </Alert>
        )}
      </Sheet>
    </motion.div>
  )
}
