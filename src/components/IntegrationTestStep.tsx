import { motion } from 'framer-motion'
import {
  Box,
  Typography,
  Sheet,
  Button,
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import Terminal, { ColorMode } from 'react-terminal-ui'

interface IntegrationTestStepProps {
  integrationTestRunning: boolean
  integrationTestComplete: boolean
  integrationTestSuccess: boolean
  terminalLines: React.ReactNode[]
  integrationTerminalExpanded: boolean
  setIntegrationTerminalExpanded: (expanded: boolean) => void
  onRunTest: () => void
  onStopTest: () => void
}

export function IntegrationTestStep({
  integrationTestRunning,
  integrationTestComplete,
  integrationTestSuccess,
  terminalLines,
  integrationTerminalExpanded,
  setIntegrationTerminalExpanded,
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

        {/* Terminal Output - Collapsible */}
        {(integrationTestRunning || integrationTestComplete) && (
          <>
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
                    Expand the terminal below to see detailed progress.
                  </Typography>
                </Box>
              </Alert>
            )}

            <Accordion
              expanded={integrationTerminalExpanded}
              onChange={(_, expanded) => setIntegrationTerminalExpanded(expanded)}
              sx={{ mb: 2 }}
            >
              <AccordionSummary indicator={<ExpandMoreIcon />}>
                <Typography level="body-sm">
                  {integrationTerminalExpanded ? 'Hide' : 'Show'} test output
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{
                  overflowX: 'auto',
                  '& .react-terminal-wrapper': {
                    fontSize: '10px !important',
                  },
                  '& .react-terminal-line': {
                    fontSize: '10px !important',
                  }
                }}>
                  <Terminal
                    name="Integration Test"
                    colorMode={ColorMode.Dark}
                  >
                    {terminalLines}
                  </Terminal>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Retry/Stop Button */}
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
          </>
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
