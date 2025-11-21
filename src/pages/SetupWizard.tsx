import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Typography, Stack, Button } from '@mui/joy'
import { SetupStepper } from '@/components/SetupStepper'
import { PlatformToolsStep } from '@/components/PlatformToolsStep'
import { PlatformConfigStep } from '@/components/PlatformConfigStep'
import { ModelConfigStep } from '@/components/ModelConfigStep'
import { IntegrationTestStep } from '@/components/IntegrationTestStep'
import { TerminalButton } from '@/components/UniversalTerminal'
import { usePlatformTools } from '@/hooks/usePlatformTools'
import { useModelConfig } from '@/hooks/useModelConfig'
import { useIntegrationTest } from '@/hooks/useIntegrationTest'
import { StepConfig } from '@/types/setupWizard'

const steps: StepConfig[] = [
  { label: 'Platform Tools', description: 'Check Python, Android Studio, Playwright' },
  { label: 'Platform Config', description: 'Configure Android SDK path' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Run integration test' },
]

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [animateTerminalButton, setAnimateTerminalButton] = useState(false)

  // Platform tools hook
  const { toolsStatus, setToolsStatus, checkPlatformTools, downloadPython, androidSdkPath, setAndroidSdkPath } = usePlatformTools()

  // Model configuration hook
  const {
    modelConfig,
    setModelConfig,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
    apiModels,
    apiModelsLoading,
    apiModelsError,
    detectedProvider,
    fetchApiModels,
  } = useModelConfig(currentStep)

  // Integration test hook
  const {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  } = useIntegrationTest()

  // Auto-check platform tools on Step 0
  useEffect(() => {
    if (currentStep === 0) {
      checkPlatformTools()
    }
  }, [currentStep, checkPlatformTools])

  // Animate terminal button when integration test starts
  useEffect(() => {
    if (integrationTestRunning) {
      setAnimateTerminalButton(true)
      const timer = setTimeout(() => {
        setAnimateTerminalButton(false)
      }, 3000) // Animate for 3 seconds
      return () => clearTimeout(timer)
    }
  }, [integrationTestRunning])

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      // If moving from Step 0 (Platform Tools), validate Python is installed
      if (currentStep === 0) {
        if (!toolsStatus.python.installed) {
          alert('Please install Python before continuing. Click the "Download Python" button in Step 0.')
          return
        }
      }

      // If moving from Step 2 (Model Config) to Step 3 (Integration Test), save config first
      if (currentStep === 2) {
        try {
          await handleSaveConfig()
          // Config saved successfully, move to next step
          setCurrentStep(currentStep + 1)
        } catch {
          // Error already handled in handleSaveConfig (alert shown)
          console.error('[SetupWizard] Failed to save config, staying on current step')
        }
      } else {
        setCurrentStep(currentStep + 1)
      }
    } else if (integrationTestSuccess) {
      // Already saved config in step 2, restart app to reload setup status
      await window.electronAPI.appRestart()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSaveConfig = async () => {
    try {
      // Build complete config.json with all settings
      const config = {
        version: '1.0',
        model: {
          enableLocal: modelConfig.enableLocal,
          enableApi: modelConfig.enableApi,
          api: {
            provider: modelConfig.apiProvider,
            baseUrl: modelConfig.apiBaseUrl,
            key: modelConfig.apiKey,
            model: modelConfig.apiModel,
          },
          local: {
            baseUrl: modelConfig.localBaseUrl,
            model: modelConfig.localModel,
          },
        },
        execution: {
          maxTokens: 4096,
          temperature: 0.0,
          requestInterval: 10,
          maxRounds: 20,
        },
        android: {
          screenshotDir: '/sdcard/Pictures',
          xmlDir: '/sdcard/Documents',
          sdkPath: androidSdkPath || '',
        },
        web: {
          browserType: 'chromium' as const,
          headless: false,
          viewportWidth: 1280,
          viewportHeight: 720,
        },
        image: {
          maxWidth: 512,
          maxHeight: 512,
          quality: 85,
          optimize: true,
        },
        preferences: {
          darkMode: false,
          minDist: 30,
          docRefine: false,
        },
      }

      const result = await window.electronAPI.configSave(config)

      if (result.success) {
        // Note: Navigation is handled by caller (either step progression or final navigation)
      } else {
        console.error('[SetupWizard] Failed to save config:', result.error)
        alert(`Failed to save configuration: ${result.error}`)
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[SetupWizard] Error saving configuration:', error)
      alert('Failed to save configuration')
      throw error
    }
  }

  const canProceedFromStep0 = () => {
    const isMac = window.navigator.platform.toLowerCase().includes('mac')
    return (
      toolsStatus.python.installed &&
      toolsStatus.pythonEnv.installed &&
      toolsStatus.androidStudio.installed &&
      (!isMac || toolsStatus.homebrew.installed)
    )
  }

  const canProceedFromStep1 = () => {
    // Android SDK path is optional but recommended
    return true
  }

  const canProceedFromStep2 = () => {
    // At least one provider must be enabled
    if (!modelConfig.enableLocal && !modelConfig.enableApi) return false
    
    // If local is enabled, must have a model selected
    if (modelConfig.enableLocal && !modelConfig.localModel) return false
    
    // If API is enabled, must have provider, key, and model
    if (modelConfig.enableApi && (!modelConfig.apiProvider || !modelConfig.apiKey || !modelConfig.apiModel)) return false
    
    return true
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
            <Box sx={{ mb: { xs: 1, md: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <Box>
                <Typography level="h2" fontWeight="bold" sx={{ mb: 0.5, fontSize: { xs: '1.5rem', md: '2rem' } }}>
                  Welcome to Klever Desktop
                </Typography>
                <Typography level="body-md" textColor="text.secondary" sx={{ fontSize: { xs: '0.875rem', md: '1rem' } }}>
                  Let&apos;s set up your environment for AI-powered UI automation
                </Typography>
              </Box>
              <TerminalButton animateAttention={animateTerminalButton} />
            </Box>
          </motion.div>

          {/* Stepper and Content Layout */}
          <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2, md: 4 }, flex: 1 }}>
            {/* Vertical Stepper on the left */}
            <SetupStepper steps={steps} currentStep={currentStep} />

            {/* Step Content on the right */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <AnimatePresence mode="wait">
                {/* Step 0: Platform Tools Check */}
                {currentStep === 0 && (
                  <PlatformToolsStep
                    toolsStatus={toolsStatus}
                    setToolsStatus={setToolsStatus}
                    checkPlatformTools={checkPlatformTools}
                    downloadPython={downloadPython}
                  />
                )}

                {/* Step 1: Platform Configuration */}
                {currentStep === 1 && (
                  <PlatformConfigStep
                    androidSdkPath={androidSdkPath}
                    setAndroidSdkPath={setAndroidSdkPath}
                  />
                )}

                {/* Step 2: Model Configuration */}
                {currentStep === 2 && (
                  <ModelConfigStep
                    modelConfig={modelConfig}
                    setModelConfig={setModelConfig}
                    ollamaModels={ollamaModels}
                    ollamaLoading={ollamaLoading}
                    ollamaError={ollamaError}
                    fetchOllamaModels={fetchOllamaModels}
                    apiModels={apiModels}
                    apiModelsLoading={apiModelsLoading}
                    apiModelsError={apiModelsError}
                    detectedProvider={detectedProvider}
                    fetchApiModels={fetchApiModels}
                  />
                )}

                {/* Step 3: Integration Test */}
                {currentStep === 3 && (
                  <IntegrationTestStep
                    integrationTestRunning={integrationTestRunning}
                    integrationTestComplete={integrationTestComplete}
                    integrationTestSuccess={integrationTestSuccess}
                    onRunTest={() => handleRunIntegrationTest(modelConfig)}
                    onStopTest={handleStopIntegrationTest}
                  />
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
                  disabled={!canProceedFromStep0()}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              ) : currentStep === 1 ? (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleNext}
                  disabled={!canProceedFromStep1()}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              ) : currentStep === 2 ? (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleNext}
                  disabled={!canProceedFromStep2()}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleNext}
                  disabled={!integrationTestSuccess}
                  sx={{ minWidth: 100 }}
                >
                  Get Started
                </Button>
              )}
            </Stack>
          </motion.div>
        </Box>
      </motion.div>
    </Box>
  )
}
