import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Button,
  Typography,
  Sheet,
  Stack,
  Stepper,
  Step,
  StepIndicator,
  stepClasses,
  stepIndicatorClasses,
  Radio,
  RadioGroup,
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  CircularProgress,
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  CircleOutlined as CircleOutlinedIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { TerminalOutput } from 'react-terminal-ui'

const steps = [
  { label: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Run integration test' },
]

interface ModelConfig {
  modelType: 'local' | 'api'
  apiBaseUrl: string
  apiKey: string
  apiModel: string
  localBaseUrl: string
  localModel: string
}

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    modelType: 'local',
    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    apiModel: 'gpt-4o-mini',
    localBaseUrl: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen3-vl:4b',
  })
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')

  // Integration test state
  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)
  const [terminalLines, setTerminalLines] = useState<React.ReactNode[]>([])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else if (integrationTestSuccess) {
      navigate('/projects')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleTestConnection = async () => {
    setTestStatus('testing')
    setTestMessage('')

    try {
      const result = await window.electronAPI.testModelConnection({
        modelType: modelConfig.modelType,
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
        apiModel: modelConfig.apiModel,
        localBaseUrl: modelConfig.localBaseUrl,
        localModel: modelConfig.localModel,
      })

      if (result.success) {
        setTestStatus('success')
        setTestMessage(result.message || 'Connection successful!')
      } else {
        setTestStatus('error')
        setTestMessage(result.message || 'Connection failed')
      }
    } catch (error) {
      setTestStatus('error')
      setTestMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  const handleSaveConfig = async () => {
    try {
      await window.electronAPI.saveModelConfig({
        modelType: modelConfig.modelType,
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
        apiModel: modelConfig.apiModel,
        localBaseUrl: modelConfig.localBaseUrl,
        localModel: modelConfig.localModel,
      })
      handleNext()
    } catch (error) {
      setTestStatus('error')
      setTestMessage(error instanceof Error ? error.message : 'Failed to save configuration')
    }
  }

  const handleRunIntegrationTest = async () => {
    setIntegrationTestRunning(true)
    setIntegrationTestComplete(false)
    setIntegrationTestSuccess(false)
    setTerminalLines([])

    try {
      // Start the integration test
      await window.electronAPI.runIntegrationTest()

      // Listen for stdout
      window.electronAPI.onIntegrationTestOutput((data: string) => {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={prev.length}>{data}</TerminalOutput>])
      })

      // Listen for completion
      window.electronAPI.onIntegrationTestComplete((success: boolean) => {
        setIntegrationTestRunning(false)
        setIntegrationTestComplete(true)
        setIntegrationTestSuccess(success)

        if (success) {
          setTerminalLines((prev) => [
            ...prev,
            <TerminalOutput key={prev.length}>
              <span style={{ color: '#4caf50' }}>✓ Integration test completed successfully!</span>
            </TerminalOutput>,
          ])
        } else {
          setTerminalLines((prev) => [
            ...prev,
            <TerminalOutput key={prev.length}>
              <span style={{ color: '#f44336' }}>✗ Integration test failed. Please check the output above.</span>
            </TerminalOutput>,
          ])
        }
      })
    } catch (error) {
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(false)
      setTerminalLines((prev) => [
        ...prev,
        <TerminalOutput key={prev.length}>
          <span style={{ color: '#f44336' }}>Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </TerminalOutput>,
      ])
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.body',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 4, flex: 1 }}>
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography level="h2" fontWeight="bold" sx={{ mb: 0.5 }}>
                Welcome to Klever Desktop
              </Typography>
              <Typography level="body-md" textColor="text.secondary">
                Let&apos;s set up your environment for AI-powered UI automation
              </Typography>
            </Box>
          </motion.div>

          {/* Stepper and Content Layout */}
          <Box sx={{ display: 'flex', gap: 4, flex: 1 }}>
            {/* Vertical Stepper on the left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              style={{ minWidth: 240 }}
            >
              <Stepper
                orientation="vertical"
                sx={(theme) => ({
                  '--Stepper-verticalGap': '2rem',
                  '--StepIndicator-size': '2.5rem',
                  '--Step-gap': '1rem',
                  '--Step-connectorInset': '0.5rem',
                  '--Step-connectorRadius': '1rem',
                  '--Step-connectorThickness': '4px',
                  [`& .${stepClasses.completed}`]: {
                    '&::after': { bgcolor: 'primary.solidBg' },
                  },
                  [`& .${stepClasses.active}`]: {
                    [`& .${stepIndicatorClasses.root}`]: {
                      border: '4px solid',
                      borderColor: theme.vars.palette.primary[500],
                      boxShadow: `0 0 0 1px ${theme.vars.palette.primary[200]}`,
                    },
                  },
                  [`& .${stepClasses.disabled} *`]: {
                    color: 'neutral.softDisabledColor',
                  },
                })}
              >
                {steps.map((step, index) => {
                  const isCompleted = index < currentStep
                  const isActive = index === currentStep

                  return (
                    <Step
                      key={index}
                      completed={isCompleted}
                      active={isActive}
                      disabled={index > currentStep}
                      indicator={
                        <StepIndicator
                          variant={isCompleted ? 'solid' : isActive ? 'solid' : 'outlined'}
                          color={isCompleted ? 'primary' : isActive ? 'primary' : 'neutral'}
                        >
                          {isCompleted ? <CheckCircleIcon /> : index + 1}
                        </StepIndicator>
                      }
                    >
                      <Box>
                        <Typography level="body-sm" fontWeight="md">
                          {step.label}
                        </Typography>
                        <Typography level="body-xs" textColor="text.secondary">
                          {step.description}
                        </Typography>
                      </Box>
                    </Step>
                  )
                })}
              </Stepper>
            </motion.div>

            {/* Step Content on the right */}
            <Box sx={{ flex: 1 }}>
              <AnimatePresence mode="wait">
                {/* Step 0: Platform Tools Check */}
                {currentStep === 0 && (
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
                      <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
                        Platform & Runtime Tools Check
                      </Typography>
                      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                        We&apos;re checking if all required tools are installed and configured correctly.
                      </Typography>

                      <Stack spacing={1.5}>
                        {[
                          { label: 'Python 3.11+', completed: true },
                          { label: 'Python Packages', completed: false },
                          { label: 'ADB (Android Debug Bridge)', completed: false },
                          { label: 'Playwright (Web Automation)', completed: false },
                        ].map((tool, idx) => (
                          <motion.div
                            key={tool.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * (idx + 1) }}
                          >
                            <Sheet
                              variant="soft"
                              color={tool.completed ? 'success' : 'neutral'}
                              sx={{
                                p: 2,
                                borderRadius: 'sm',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                            >
                              {tool.completed ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <CircleOutlinedIcon sx={{ color: 'neutral.400' }} />
                              )}
                              <Typography
                                level="body-sm"
                                fontWeight={tool.completed ? 'md' : 'normal'}
                                textColor={tool.completed ? 'text.primary' : 'text.secondary'}
                              >
                                {tool.label}
                              </Typography>
                            </Sheet>
                          </motion.div>
                        ))}
                      </Stack>
                    </Sheet>
                  </motion.div>
                )}

                {/* Step 1: Model Configuration */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
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
                        Model Configuration
                      </Typography>
                      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                        Choose and configure your AI model provider
                      </Typography>

                      <Stack spacing={3}>
                        {/* Model Type Selection */}
                        <FormControl>
                          <FormLabel>Model Provider</FormLabel>
                          <RadioGroup
                            value={modelConfig.modelType}
                            onChange={(e) =>
                              setModelConfig({ ...modelConfig, modelType: e.target.value as 'local' | 'api' })
                            }
                          >
                            <Radio value="local" label="Local (Ollama)" />
                            <Radio value="api" label="API (OpenAI, OpenRouter, etc.)" />
                          </RadioGroup>
                        </FormControl>

                        {/* Local Configuration */}
                        {modelConfig.modelType === 'local' && (
                          <Stack spacing={2}>
                            <FormControl>
                              <FormLabel>Base URL</FormLabel>
                              <Input
                                value={modelConfig.localBaseUrl}
                                onChange={(e) =>
                                  setModelConfig({ ...modelConfig, localBaseUrl: e.target.value })
                                }
                                placeholder="http://localhost:11434/v1/chat/completions"
                              />
                              <FormHelperText>Ollama API endpoint</FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Model Name</FormLabel>
                              <Input
                                value={modelConfig.localModel}
                                onChange={(e) => setModelConfig({ ...modelConfig, localModel: e.target.value })}
                                placeholder="qwen3-vl:4b"
                              />
                              <FormHelperText>Ollama model with vision support</FormHelperText>
                            </FormControl>
                          </Stack>
                        )}

                        {/* API Configuration */}
                        {modelConfig.modelType === 'api' && (
                          <Stack spacing={2}>
                            <FormControl>
                              <FormLabel>API Base URL</FormLabel>
                              <Input
                                value={modelConfig.apiBaseUrl}
                                onChange={(e) => setModelConfig({ ...modelConfig, apiBaseUrl: e.target.value })}
                                placeholder="https://api.openai.com/v1/chat/completions"
                              />
                              <FormHelperText>OpenAI-compatible API endpoint</FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>API Key</FormLabel>
                              <Input
                                type="password"
                                value={modelConfig.apiKey}
                                onChange={(e) => setModelConfig({ ...modelConfig, apiKey: e.target.value })}
                                placeholder="sk-..."
                              />
                              <FormHelperText>Your API key</FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>Model Name</FormLabel>
                              <Input
                                value={modelConfig.apiModel}
                                onChange={(e) => setModelConfig({ ...modelConfig, apiModel: e.target.value })}
                                placeholder="gpt-4o-mini"
                              />
                              <FormHelperText>Model identifier</FormHelperText>
                            </FormControl>
                          </Stack>
                        )}

                        {/* Test Connection */}
                        <Box>
                          <Button
                            variant="outlined"
                            color="primary"
                            onClick={handleTestConnection}
                            loading={testStatus === 'testing'}
                            fullWidth
                          >
                            Test Connection
                          </Button>
                        </Box>

                        {/* Test Status */}
                        {testStatus !== 'idle' && (
                          <Alert
                            color={testStatus === 'success' ? 'success' : testStatus === 'error' ? 'danger' : 'neutral'}
                            startDecorator={
                              testStatus === 'testing' ? (
                                <CircularProgress size="sm" />
                              ) : testStatus === 'success' ? (
                                <CheckCircleIcon />
                              ) : (
                                <WarningIcon />
                              )
                            }
                          >
                            {testMessage}
                          </Alert>
                        )}
                      </Stack>
                    </Sheet>
                  </motion.div>
                )}

                {/* Step 2: Integration Test */}
                {currentStep === 2 && (
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
                          onClick={handleRunIntegrationTest}
                          fullWidth
                          sx={{ mb: 2 }}
                        >
                          Run Integration Test
                        </Button>
                      )}

                      {/* Terminal Output */}
                      {(integrationTestRunning || integrationTestComplete) && (
                        <Box
                          sx={{
                            bgcolor: '#1e1e1e',
                            borderRadius: 'sm',
                            p: 2,
                            minHeight: 300,
                            maxHeight: 500,
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                          }}
                        >
                          {terminalLines}
                          {integrationTestRunning && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <CircularProgress size="sm" sx={{ color: '#fff' }} />
                              <Typography level="body-sm" sx={{ color: '#fff' }}>
                                Running test...
                              </Typography>
                            </Box>
                          )}
                        </Box>
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
                )}
              </AnimatePresence>
            </Box>
          </Box>

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ pt: 2 }}>
              <Button
                variant="outlined"
                color="neutral"
                onClick={handleBack}
                disabled={currentStep === 0}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              {currentStep === 1 ? (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleSaveConfig}
                  disabled={testStatus !== 'success'}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleNext}
                  disabled={currentStep === 2 && !integrationTestSuccess}
                  sx={{ minWidth: 100 }}
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </Button>
              )}
            </Stack>
          </motion.div>
        </Box>
      </motion.div>
    </Box>
  )
}
