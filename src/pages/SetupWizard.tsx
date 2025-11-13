import React, { useState, useEffect, useCallback } from 'react'
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
  Input,
  FormControl,
  FormLabel,
  FormHelperText,
  Alert,
  CircularProgress,
  Select,
  Option,
  IconButton,
  Autocomplete,
  Accordion,
  AccordionDetails,
  AccordionSummary,
  LinearProgress,
} from '@mui/joy'
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import Checkbox from '@mui/joy/Checkbox'
import Terminal, { ColorMode, TerminalOutput } from 'react-terminal-ui';

const steps = [
  { label: 'Platform Tools', description: 'Check Python, Android Studio, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Run integration test' },
]

interface ModelConfig {
  enableLocal: boolean
  enableApi: boolean
  apiBaseUrl: string
  apiKey: string
  apiModel: string
  localBaseUrl: string
  localModel: string
}

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    enableLocal: true,
    enableApi: false,
    apiBaseUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    apiModel: '',
    localBaseUrl: 'http://localhost:11434/v1/chat/completions',
    localModel: 'qwen3-vl:4b',
  })
  const [localTestStatus, setLocalTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [localTestMessage, setLocalTestMessage] = useState<string>('')
  const [apiTestStatus, setApiTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [apiTestMessage, setApiTestMessage] = useState<string>('')

  // Ollama models state
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaError, setOllamaError] = useState<string>('')
  // Platform tools state
  interface ToolStatus {
    checking: boolean
    installed: boolean
    version?: string
    error?: string
    installing?: boolean
  }

  const [toolsStatus, setToolsStatus] = useState({
    python: { checking: true, installed: false, installing: false } as ToolStatus,
    pythonEnv: { checking: false, installed: false, installing: false } as ToolStatus,
    androidStudio: { checking: true, installed: false, installing: false } as ToolStatus,
    homebrew: { checking: true, installed: false, installing: false } as ToolStatus,
  })

  // Unified environment setup state
  const [envSetupTerminalLines, setEnvSetupTerminalLines] = useState<React.ReactNode[]>([])
  const [envSetupProgress, setEnvSetupProgress] = useState(0)
  const [terminalExpanded, setTerminalExpanded] = useState(false)

  // API models state
  const [apiModels, setApiModels] = useState<string[]>([])
  const [apiModelsLoading, setApiModelsLoading] = useState(false)
  const [apiModelsError, setApiModelsError] = useState<string>('')
  const [detectedProvider, setDetectedProvider] = useState<string>('')

  // Integration test state
  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)
  const [terminalLines, setTerminalLines] = useState<React.ReactNode[]>([])
  const [integrationTerminalExpanded, setIntegrationTerminalExpanded] = useState(false)

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else if (integrationTestSuccess) {
      // Save config before navigating to ensure App.tsx recognizes setup is complete
      try {
        await window.electronAPI.saveModelConfig({
          enableLocal: modelConfig.enableLocal,
          enableApi: modelConfig.enableApi,
          apiBaseUrl: modelConfig.apiBaseUrl,
          apiKey: modelConfig.apiKey,
          apiModel: modelConfig.apiModel,
          localBaseUrl: modelConfig.localBaseUrl,
          localModel: modelConfig.localModel,
        })
        // Reload the page to trigger App.tsx to re-check setup status
        window.location.href = '/projects'
      } catch (error) {
        console.error('Failed to save configuration:', error)
      }
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleTestLocalConnection = async () => {
    setLocalTestStatus('testing')
    setLocalTestMessage('')

    try {
      const result = await window.electronAPI.testModelConnection({
        enableLocal: true,
        enableApi: false,
        apiBaseUrl: '',
        apiKey: '',
        apiModel: '',
        localBaseUrl: modelConfig.localBaseUrl,
        localModel: modelConfig.localModel,
      })

      if (result.success) {
        setLocalTestStatus('success')
        setLocalTestMessage(result.message || 'Connection successful!')
      } else {
        setLocalTestStatus('error')
        setLocalTestMessage(result.message || 'Connection failed')
      }
    } catch (error) {
      setLocalTestStatus('error')
      setLocalTestMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  const handleTestApiConnection = async () => {
    setApiTestStatus('testing')
    setApiTestMessage('')

    try {
      const result = await window.electronAPI.testModelConnection({
        enableLocal: false,
        enableApi: true,
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
        apiModel: modelConfig.apiModel,
        localBaseUrl: '',
        localModel: '',
      })

      if (result.success) {
        setApiTestStatus('success')
        setApiTestMessage(result.message || 'Connection successful!')
      } else {
        setApiTestStatus('error')
        setApiTestMessage(result.message || 'Connection failed')
      }
    } catch (error) {
      setApiTestStatus('error')
      setApiTestMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  const handleSaveConfig = async () => {
    try {
      await window.electronAPI.saveModelConfig({
        enableLocal: modelConfig.enableLocal,
        enableApi: modelConfig.enableApi,
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
        apiModel: modelConfig.apiModel,
        localBaseUrl: modelConfig.localBaseUrl,
        localModel: modelConfig.localModel,
      })
      handleNext()
    } catch (error) {
      setLocalTestStatus('error')
      setLocalTestMessage(error instanceof Error ? error.message : 'Failed to save configuration')
    }
  }

  // Fetch Ollama models
  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    setOllamaError('')

    try {
      const result = await window.electronAPI.checkOllama()
      console.log('Ollama API result:', result)

      if (result.success && result.running && result.models) {
        const modelNames = result.models.map((model: { name?: string } | string) =>
          typeof model === 'string' ? model : (model.name || '')
        )
        console.log('Parsed model names:', modelNames)
        setOllamaModels(modelNames)

        // Auto-select first model if none selected
        if (modelNames.length > 0 && !modelConfig.localModel) {
          setModelConfig((prev) => ({ ...prev, localModel: modelNames[0] }))
        }
      } else {
        console.log('Ollama check failed:', result)
        setOllamaError('Ollama is not running or no models found')
        setOllamaModels([])
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error)
      setOllamaError(error instanceof Error ? error.message : 'Failed to fetch models')
      setOllamaModels([])
    } finally {
      setOllamaLoading(false)
    }
  }, [modelConfig.localModel])

  // Auto-fetch models when local model is enabled
  useEffect(() => {
    if (modelConfig.enableLocal && currentStep === 1) {
      fetchOllamaModels()
    }
  }, [modelConfig.enableLocal, currentStep, fetchOllamaModels])
  // Check platform tools
  const checkPlatformTools = useCallback(async () => {
    // Check Homebrew (macOS only)
    const isMac = window.navigator.platform.toLowerCase().includes('mac')
    if (isMac) {
      setToolsStatus((prev) => ({ ...prev, homebrew: { ...prev.homebrew, checking: true } }))
      try {
        const result = await window.electronAPI.checkHomebrew()
        setToolsStatus((prev) => ({
          ...prev,
          homebrew: { checking: false, installed: result.success, version: result.version, installing: false },
        }))
      } catch {
        setToolsStatus((prev) => ({ ...prev, homebrew: { checking: false, installed: false, installing: false } }))
      }
    } else {
      // Not macOS, skip Homebrew check
      setToolsStatus((prev) => ({ ...prev, homebrew: { checking: false, installed: true, installing: false } }))
    }

    // Check Bundled Python and Virtual Environment
    console.log('[SetupWizard] ========== Checking Python environment ==========')
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, checking: true } }))
    try {
      console.log('[SetupWizard] Calling window.electronAPI.envCheck()')
      const envCheck = await window.electronAPI.envCheck()
      console.log('[SetupWizard] envCheck result:', JSON.stringify(envCheck, null, 2))

      // Check Python (bundled or system)
      const pythonInstalled = envCheck.success && envCheck.bundledPython?.exists
      const pythonVersion = envCheck.bundledPython?.version
      const isBundled = envCheck.bundledPython?.isBundled

      console.log('[SetupWizard] Python analysis:')
      console.log('  - success:', envCheck.success)
      console.log('  - bundledPython.exists:', envCheck.bundledPython?.exists)
      console.log('  - pythonInstalled:', pythonInstalled)
      console.log('  - pythonVersion:', pythonVersion)
      console.log('  - isBundled:', isBundled)

      setToolsStatus((prev) => ({
        ...prev,
        python: {
          checking: false,
          installed: pythonInstalled || false,
          version: pythonVersion ? `Python ${pythonVersion}${isBundled ? ' (Bundled)' : ' (System)'}` : undefined,
          error: pythonInstalled ? undefined : 'Python 3.11+ not found. Please install Python.',
          installing: false,
        },
      }))

      // Check Python environment (venv + packages + playwright)
      const envInstalled = envCheck.success && envCheck.venv?.valid
      console.log('[SetupWizard] Venv installed:', envInstalled)

      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: {
          checking: false,
          installed: envInstalled || false,
          error: envInstalled ? undefined : 'Environment not set up',
          installing: false,
        },
      }))

      console.log('[SetupWizard] ========== Python environment check complete ==========')
    } catch (error) {
      console.error('[SetupWizard] Error checking Python environment:', error)
      setToolsStatus((prev) => ({
        ...prev,
        python: { checking: false, installed: false, installing: false },
        pythonEnv: { checking: false, installed: false, installing: false },
      }))
    }

    // Check Android Studio
    setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, checking: true } }))
    try {
      const result = await window.electronAPI.checkAndroidStudio()
      console.log('Android Studio Check Result:', result)
      setToolsStatus((prev) => ({
        ...prev,
        androidStudio: { checking: false, installed: result.success, error: result.error, installing: false },
      }))
    } catch {
      setToolsStatus((prev) => ({ ...prev, androidStudio: { checking: false, installed: false, installing: false } }))
    }
  }, [])

  // Auto-check platform tools on Step 0
  useEffect(() => {
    if (currentStep === 0) {
      checkPlatformTools()
    }
  }, [currentStep, checkPlatformTools])

  // Fetch API models from provider
  const fetchApiModels = useCallback(async () => {
    if (!modelConfig.apiBaseUrl) {
      setApiModelsError('Please enter API Base URL first')
      return
    }

    if (!modelConfig.apiKey) {
      setApiModelsError('Please enter API Key first')
      return
    }

    setApiModelsLoading(true)
    setApiModelsError('')
    setApiModels([])

    try {
      const result = await window.electronAPI.fetchApiModels({
        apiBaseUrl: modelConfig.apiBaseUrl,
        apiKey: modelConfig.apiKey,
      })

      if (result.success && result.models) {
        setApiModels(result.models)
        setDetectedProvider(result.provider || 'unknown')
      } else {
        setApiModelsError(result.error || 'Failed to fetch models')
        setDetectedProvider(result.provider || 'unknown')
      }
    } catch (error) {
      console.error('Error fetching API models:', error)
      setApiModelsError(error instanceof Error ? error.message : 'Failed to fetch models')
    } finally {
      setApiModelsLoading(false)
    }
  }, [modelConfig.apiBaseUrl, modelConfig.apiKey])

  // Auto-fetch API models when URL or key changes
  useEffect(() => {
    if (modelConfig.enableApi && modelConfig.apiBaseUrl && currentStep === 1) {
      const timeoutId = window.setTimeout(() => {
        fetchApiModels()
      }, 500) // Debounce API calls

      return () => window.clearTimeout(timeoutId)
    }
  }, [modelConfig.enableApi, modelConfig.apiBaseUrl, modelConfig.apiKey, currentStep, fetchApiModels])


  // Unified environment setup
  const handleSetupEnvironment = async () => {
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true } }))
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
      setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: false } }))
    }
  }

  const handleRunIntegrationTest = async () => {
    setIntegrationTestRunning(true)
    setIntegrationTestComplete(false)
    setIntegrationTestSuccess(false)
    setTerminalLines([])

    try {
      // Start the integration test with model config
      await window.electronAPI.runIntegrationTest(modelConfig)

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, md: 3 }, p: { xs: 2, sm: 3, md: 4 }, flex: 1 }}>
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Box sx={{ mb: { xs: 1, md: 2 } }}>
              <Typography level="h2" fontWeight="bold" sx={{ mb: 0.5, fontSize: { xs: '1.5rem', md: '2rem' } }}>
                Welcome to Klever Desktop
              </Typography>
              <Typography level="body-md" textColor="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                Let&apos;s set up your environment for AI-powered UI automation
              </Typography>
            </Box>
          </motion.div>

          {/* Stepper and Content Layout */}
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2, md: 4 }, flex: 1 }}>
            {/* Vertical Stepper on the left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              style={{ minWidth: 'fit-content' }}
            >
              <Stepper
                orientation="vertical"
                sx={(theme) => ({
                  '--Stepper-verticalGap': { xs: '1rem', md: '2rem' },
                  '--StepIndicator-size': { xs: '2rem', md: '2.5rem' },
                  '--Step-gap': { xs: '0.5rem', md: '1rem' },
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
                      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
                        {window.navigator.platform.toLowerCase().includes('mac') && (
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                          >
                            <Sheet
                              variant="soft"
                              color={
                                toolsStatus.homebrew.checking
                                  ? 'neutral'
                                  : toolsStatus.homebrew.installed
                                    ? 'success'
                                    : 'warning'
                              }
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
                                {toolsStatus.homebrew.checking ? (
                                  <CircularProgress size="sm" />
                                ) : toolsStatus.homebrew.installed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <WarningIcon color="warning" />
                                )}
                                <Box>
                                  <Typography
                                    level="body-sm"
                                    fontWeight={toolsStatus.homebrew.installed ? 'md' : 'normal'}
                                    textColor={toolsStatus.homebrew.installed ? 'text.primary' : 'text.secondary'}
                                  >
                                    Homebrew
                                  </Typography>
                                  {toolsStatus.homebrew.version && (
                                    <Typography level="body-xs" textColor="text.tertiary">
                                      v{toolsStatus.homebrew.version}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                              {!toolsStatus.homebrew.installed && !toolsStatus.homebrew.checking && (
                                <Button
                                  size="sm"
                                  variant="outlined"
                                  color="warning"
                                  onClick={() => window.electronAPI.openExternal('https://brew.sh')}
                                >
                                  Install Guide
                                </Button>
                              )}
                            </Sheet>
                          </motion.div>
                        )}

                        {/* Python 3.11+ */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Sheet
                            variant="soft"
                            color={
                              toolsStatus.python.checking ? 'neutral' : toolsStatus.python.installed ? 'success' : 'warning'
                            }
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
                              {toolsStatus.python.checking ? (
                                <CircularProgress size="sm" />
                              ) : toolsStatus.python.installed ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <WarningIcon color="warning" />
                              )}
                              <Box>
                                <Typography
                                  level="body-sm"
                                  fontWeight={toolsStatus.python.installed ? 'md' : 'normal'}
                                  textColor={toolsStatus.python.installed ? 'text.primary' : 'text.secondary'}
                                >
                                  Python 3.11+
                                </Typography>
                                {toolsStatus.python.version && (
                                  <Typography level="body-xs" textColor="text.tertiary">
                                    v{toolsStatus.python.version}
                                  </Typography>
                                )}
                                {toolsStatus.python.error && (
                                  <Typography level="body-xs" textColor="danger.500">
                                    {toolsStatus.python.error}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Sheet>
                        </motion.div>

                        {/* Python Environment (venv + packages + Playwright) */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Sheet
                            variant="soft"
                            color={
                              toolsStatus.pythonEnv.checking
                                ? 'neutral'
                                : toolsStatus.pythonEnv.installed
                                  ? 'success'
                                  : 'warning'
                            }
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
                                {toolsStatus.pythonEnv.checking ? (
                                  <CircularProgress size="sm" />
                                ) : toolsStatus.pythonEnv.installed ? (
                                  <CheckCircleIcon color="success" />
                                ) : (
                                  <WarningIcon color="warning" />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Typography
                                    level="body-sm"
                                    fontWeight={toolsStatus.pythonEnv.installed ? 'md' : 'normal'}
                                    textColor={toolsStatus.pythonEnv.installed ? 'text.primary' : 'text.secondary'}
                                  >
                                    Python Environment
                                  </Typography>
                                  <Typography level="body-xs" textColor="text.tertiary">
                                    Includes: Virtual environment, packages, and Playwright browsers
                                  </Typography>
                                </Box>
                              </Box>
                              {!toolsStatus.pythonEnv.installed && !toolsStatus.pythonEnv.checking && (
                                <Button
                                  size="sm"
                                  variant="solid"
                                  color="primary"
                                  loading={toolsStatus.pythonEnv.installing}
                                  onClick={handleSetupEnvironment}
                                  sx={{ minWidth: '100px' }}
                                >
                                  Setup
                                </Button>
                              )}
                            </Box>

                            {/* Progress bar during installation */}
                            {toolsStatus.pythonEnv.installing && (
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
                            {toolsStatus.pythonEnv.installing && (
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
                            {toolsStatus.pythonEnv.installing && envSetupTerminalLines.length > 0 && (
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

                        {/* Android Studio */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Sheet
                            variant="soft"
                            color={toolsStatus.androidStudio.checking ? 'neutral' : toolsStatus.androidStudio.installed ? 'success' : 'warning'}
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
                              {toolsStatus.androidStudio.checking ? (
                                <CircularProgress size="sm" />
                              ) : toolsStatus.androidStudio.installed ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <WarningIcon color="warning" />
                              )}
                              <Typography
                                level="body-sm"
                                fontWeight={toolsStatus.androidStudio.installed ? 'md' : 'normal'}
                                textColor={toolsStatus.androidStudio.installed ? 'text.primary' : 'text.secondary'}
                              >
                                Android Studio
                              </Typography>
                            </Box>
                            {!toolsStatus.androidStudio.installed && !toolsStatus.androidStudio.checking && (
                              // <Button
                              //   size="sm"
                              //   variant="outlined"
                              //   color="warning"
                              //   loading={toolsStatus.androidStudio.installing}
                              //   onClick={async () => {
                              //     setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, installing: true } }))
                              //     try {
                              //       const result = await window.electronAPI.installAndroidStudio()
                              //       if (result.success) {
                              //         // Recheck after installation
                              //         await checkPlatformTools()
                              //       }
                              //     } catch (error) {
                              //       console.error('Failed to install Android Studio:', error)
                              //     } finally {
                              //       setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, installing: false } }))
                              //     }
                              //   }}
                              // >
                              //   Install
                              // </Button>
                              <Button
                                size="sm"
                                variant="outlined"
                                color="warning"
                                onClick={() => window.electronAPI.openExternal('https://developer.android.com/studio')}
                              >
                                Install Guide
                              </Button>
                            )}
                          </Sheet>
                        </motion.div>

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
                        {/* Helper text */}
                        {!modelConfig.enableLocal && !modelConfig.enableApi && (
                          <Alert color="warning" variant="soft">
                            Please select at least one model provider
                          </Alert>
                        )}

                        {/* Local Model Card */}
                        <Sheet
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 'md',
                            border: modelConfig.enableLocal ? '2px solid' : '1px solid',
                            borderColor: modelConfig.enableLocal ? 'primary.500' : 'neutral.outlinedBorder',
                            bgcolor: modelConfig.enableLocal ? 'primary.softBg' : 'background.surface',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: modelConfig.enableLocal ? 'primary.600' : 'neutral.outlinedHoverBorder',
                            },
                          }}
                        >
                          <Box sx={{ mb: 2 }}>
                            <Checkbox
                              label={
                                <Typography level="title-md" fontWeight="bold">
                                  Local Model (Ollama)
                                </Typography>
                              }
                              checked={modelConfig.enableLocal}
                              onChange={(e) =>
                                setModelConfig({ ...modelConfig, enableLocal: e.target.checked })
                              }
                              sx={{ mb: 0.5 }}
                            />
                            <Typography level="body-sm" textColor="text.secondary" sx={{ ml: 4 }}>
                              Use locally hosted Ollama models for privacy and offline access
                            </Typography>
                          </Box>

                          <Stack spacing={2}>
                            <FormControl>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                <FormLabel>Select Model</FormLabel>
                                <IconButton
                                  size="sm"
                                  variant="plain"
                                  color="primary"
                                  onClick={fetchOllamaModels}
                                  disabled={!modelConfig.enableLocal || ollamaLoading}
                                >
                                  <RefreshIcon />
                                </IconButton>
                              </Box>
                              {ollamaLoading ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5 }}>
                                  <CircularProgress size="sm" />
                                  <Typography level="body-sm">Loading models...</Typography>
                                </Box>
                              ) : ollamaError ? (
                                <Alert color="warning" variant="soft" size="sm">
                                  {ollamaError}
                                </Alert>
                              ) : (
                                <Select
                                  value={modelConfig.localModel}
                                  onChange={(_, value) => setModelConfig({ ...modelConfig, localModel: value || '' })}
                                  disabled={!modelConfig.enableLocal || ollamaModels.length === 0}
                                  placeholder={ollamaModels.length === 0 ? 'No models found' : 'Select a model'}
                                >
                                  {ollamaModels.map((model) => (
                                    <Option key={model} value={model}>
                                      {model}
                                    </Option>
                                  ))}
                                </Select>
                              )}
                              <FormHelperText>
                                {ollamaModels.length > 0
                                  ? `${ollamaModels.length} model(s) available`
                                  : 'Install models using: ollama pull <model-name>'}
                              </FormHelperText>
                            </FormControl>

                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={handleTestLocalConnection}
                              loading={localTestStatus === 'testing'}
                              disabled={!modelConfig.enableLocal}
                              fullWidth
                            >
                              Test Connection
                            </Button>

                            {localTestStatus !== 'idle' && localTestStatus !== 'testing' && (
                              <Alert
                                color={localTestStatus === 'success' ? 'success' : 'danger'}
                                startDecorator={localTestStatus === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
                              >
                                {localTestMessage}
                              </Alert>
                            )}
                          </Stack>
                        </Sheet>

                        {/* API Model Card */}
                        <Sheet
                          variant="outlined"
                          sx={{
                            p: 3,
                            borderRadius: 'md',
                            border: modelConfig.enableApi ? '2px solid' : '1px solid',
                            borderColor: modelConfig.enableApi ? 'primary.500' : 'neutral.outlinedBorder',
                            bgcolor: modelConfig.enableApi ? 'primary.softBg' : 'background.surface',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              borderColor: modelConfig.enableApi ? 'primary.600' : 'neutral.outlinedHoverBorder',
                            },
                          }}
                        >
                          <Box sx={{ mb: 2 }}>
                            <Checkbox
                              label={
                                <Typography level="title-md" fontWeight="bold">
                                  API Model (OpenAI, OpenRouter, etc.)
                                </Typography>
                              }
                              checked={modelConfig.enableApi}
                              onChange={(e) =>
                                setModelConfig({ ...modelConfig, enableApi: e.target.checked })
                              }
                              sx={{ mb: 0.5 }}
                            />
                            <Typography level="body-sm" textColor="text.secondary" sx={{ ml: 4 }}>
                              Connect to cloud-based AI services for powerful performance
                            </Typography>
                          </Box>

                          <Stack spacing={2}>
                            <FormControl>
                              <FormLabel>API Base URL</FormLabel>
                              <Input
                                value={modelConfig.apiBaseUrl}
                                onChange={(e) => setModelConfig({ ...modelConfig, apiBaseUrl: e.target.value })}
                                placeholder="https://api.openai.com/v1/chat/completions"
                                disabled={!modelConfig.enableApi}
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
                                disabled={!modelConfig.enableApi}
                              />
                              <FormHelperText>Your API key</FormHelperText>
                            </FormControl>

                            <FormControl>
                              <FormLabel>
                                Model Name
                                {detectedProvider && ` (${detectedProvider})`}
                              </FormLabel>
                              <Stack direction="row" spacing={1}>
                                <Autocomplete
                                  placeholder="gpt-4o-mini"
                                  value={modelConfig.apiModel}
                                  onChange={(_, newValue) => {
                                    setModelConfig({ ...modelConfig, apiModel: newValue || '' })
                                  }}
                                  onInputChange={(_, newValue) => {
                                    setModelConfig({ ...modelConfig, apiModel: newValue })
                                  }}
                                  options={apiModels}
                                  freeSolo
                                  disabled={!modelConfig.enableApi || !modelConfig.apiKey}
                                  loading={apiModelsLoading}
                                  sx={{ flex: 1 }}
                                />
                                <IconButton
                                  onClick={fetchApiModels}
                                  disabled={!modelConfig.enableApi || !modelConfig.apiBaseUrl || !modelConfig.apiKey || apiModelsLoading}
                                  variant="outlined"
                                  color="neutral"
                                >
                                  <RefreshIcon />
                                </IconButton>
                              </Stack>
                              <FormHelperText>
                                {apiModelsError
                                  ? 'Unable to fetch models - please check details below'
                                  : apiModels.length > 0
                                    ? `${apiModels.length} models available`
                                    : 'Enter model name or fetch from API'}
                              </FormHelperText>
                            </FormControl>

                            <Button
                              variant="outlined"
                              color="primary"
                              onClick={handleTestApiConnection}
                              loading={apiTestStatus === 'testing'}
                              disabled={!modelConfig.enableApi}
                              fullWidth
                            >
                              Test Connection
                            </Button>

                            {apiModelsError && (
                              <Alert
                                color="warning"
                                startDecorator={<WarningIcon />}
                                variant="soft"
                              >
                                <Box>
                                  <Typography level="title-sm" fontWeight="bold">Model Fetch Error</Typography>
                                  <Typography level="body-sm">{apiModelsError}</Typography>
                                </Box>
                              </Alert>
                            )}

                            {apiTestStatus !== 'idle' && apiTestStatus !== 'testing' && (
                              <Alert
                                color={apiTestStatus === 'success' ? 'success' : 'danger'}
                                startDecorator={apiTestStatus === 'success' ? <CheckCircleIcon /> : <WarningIcon />}
                              >
                                {apiTestMessage}
                              </Alert>
                            )}
                          </Stack>
                        </Sheet>
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
                            onClick={integrationTestRunning ? async () => {
                              await window.electronAPI.stopIntegrationTest();
                            } : handleRunIntegrationTest}
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
              {currentStep === 0 ? (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleNext}
                  disabled={
                    !toolsStatus.python.installed ||
                    !toolsStatus.pythonEnv.installed ||
                    !toolsStatus.androidStudio.installed ||
                    (window.navigator.platform.toLowerCase().includes('mac') && !toolsStatus.homebrew.installed)
                  }
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              ) : currentStep === 1 ? (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleSaveConfig} disabled={
                    (!modelConfig.enableLocal && !modelConfig.enableApi) ||
                    (modelConfig.enableLocal && localTestStatus !== 'success') ||
                    (modelConfig.enableApi && apiTestStatus !== 'success')
                  }
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
