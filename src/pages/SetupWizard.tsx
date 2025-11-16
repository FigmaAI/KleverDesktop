import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Typography, Stack, Button } from '@mui/joy'
import { SetupStepper } from '@/components/SetupStepper'
import { PlatformToolsStep } from '@/components/PlatformToolsStep'
import { ModelConfigStep } from '@/components/ModelConfigStep'
import { IntegrationTestStep } from '@/components/IntegrationTestStep'
import { usePlatformTools } from '@/hooks/usePlatformTools'
import { useModelConfig } from '@/hooks/useModelConfig'
import { useIntegrationTest } from '@/hooks/useIntegrationTest'
import { StepConfig } from '@/types/setupWizard'

const steps: StepConfig[] = [
  { label: 'Platform Tools', description: 'Check Python, Android Studio, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Run integration test' },
]

export function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0)

  // Platform tools hook
  const { toolsStatus, setToolsStatus, checkPlatformTools, androidSdkPath } = usePlatformTools()

  // Model configuration hook
  const {
    modelConfig,
    setModelConfig,
    localTestStatus,
    localTestMessage,
    apiTestStatus,
    apiTestMessage,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
    apiModels,
    apiModelsLoading,
    apiModelsError,
    detectedProvider,
    fetchApiModels,
    handleTestLocalConnection,
    handleTestApiConnection,
  } = useModelConfig(currentStep)

  // Integration test hook
  const {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    terminalLines,
    integrationTerminalExpanded,
    setIntegrationTerminalExpanded,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  } = useIntegrationTest()

  // Auto-check platform tools on Step 0
  useEffect(() => {
    if (currentStep === 0) {
      checkPlatformTools()
    }
  }, [currentStep, checkPlatformTools])

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

  const handleSaveConfig = async () => {
    try {
      // Build complete config.json with all settings
      const config = {
        version: '1.0',
        model: {
          enableLocal: modelConfig.enableLocal,
          enableApi: modelConfig.enableApi,
          api: {
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

      console.log('[SetupWizard] Saving config.json:', config)
      const result = await window.electronAPI.configSave(config)

      if (result.success) {
        console.log('[SetupWizard] config.json saved successfully')
        handleNext()
      } else {
        console.error('[SetupWizard] Failed to save config:', result.error)
        alert(`Failed to save configuration: ${result.error}`)
      }
    } catch (error) {
      console.error('[SetupWizard] Error saving configuration:', error)
      alert('Failed to save configuration')
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

  const canProceedFromStep2 = () => {
    return (
      (modelConfig.enableLocal || modelConfig.enableApi) &&
      (!modelConfig.enableLocal || localTestStatus === 'success') &&
      (!modelConfig.enableApi || apiTestStatus === 'success')
    )
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
                  />
                )}

                {/* Step 1: Model Configuration */}
                {currentStep === 1 && (
                  <ModelConfigStep
                    modelConfig={modelConfig}
                    setModelConfig={setModelConfig}
                    ollamaModels={ollamaModels}
                    ollamaLoading={ollamaLoading}
                    ollamaError={ollamaError}
                    fetchOllamaModels={fetchOllamaModels}
                    localTestStatus={localTestStatus}
                    localTestMessage={localTestMessage}
                    onTestLocalConnection={handleTestLocalConnection}
                    apiModels={apiModels}
                    apiModelsLoading={apiModelsLoading}
                    apiModelsError={apiModelsError}
                    detectedProvider={detectedProvider}
                    fetchApiModels={fetchApiModels}
                    apiTestStatus={apiTestStatus}
                    apiTestMessage={apiTestMessage}
                    onTestApiConnection={handleTestApiConnection}
                  />
                )}

                {/* Step 2: Integration Test */}
                {currentStep === 2 && (
                  <IntegrationTestStep
                    integrationTestRunning={integrationTestRunning}
                    integrationTestComplete={integrationTestComplete}
                    integrationTestSuccess={integrationTestSuccess}
                    terminalLines={terminalLines}
                    integrationTerminalExpanded={integrationTerminalExpanded}
                    setIntegrationTerminalExpanded={setIntegrationTerminalExpanded}
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
                  onClick={handleSaveConfig}
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
