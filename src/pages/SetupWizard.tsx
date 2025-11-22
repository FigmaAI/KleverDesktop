import { useState, useEffect } from 'react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
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
      // Already saved config in step 2, reload to trigger App checkSetup
      window.location.reload()
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
    <div className="min-h-screen flex flex-col bg-background">
      <BlurFade delay={0.1} className="w-full h-full flex flex-col">
        <div className="flex flex-col gap-2 md:gap-3 p-2 sm:p-3 md:p-4 flex-1">
          {/* Header Section */}
          <BlurFade delay={0.2}>
            <div className="mb-1 md:mb-2 flex justify-between items-start">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold mb-1">
                  Welcome to Klever Desktop
                </h2>
                <p className="text-sm md:text-base text-muted-foreground">
                  Let&apos;s set up your environment for AI-powered UI automation
                </p>
              </div>
              <TerminalButton animateAttention={animateTerminalButton} />
            </div>
          </BlurFade>

          {/* Stepper and Content Layout */}
          <div className="flex gap-1 sm:gap-2 md:gap-4 flex-1">
            {/* Vertical Stepper on the left */}
            <SetupStepper steps={steps} currentStep={currentStep} />

            {/* Step Content on the right */}
            <div className="flex-1 min-w-0">
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
            </div>
          </div>

          {/* Navigation Buttons */}
          <BlurFade delay={0.4}>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="min-w-[100px]"
              >
                Back
              </Button>
              {currentStep === 0 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedFromStep0()}
                  className="min-w-[100px]"
                >
                  Next
                </Button>
              ) : currentStep === 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedFromStep1()}
                  className="min-w-[100px]"
                >
                  Next
                </Button>
              ) : currentStep === 2 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedFromStep2()}
                  className="min-w-[100px]"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={!integrationTestSuccess}
                  className="min-w-[100px]"
                >
                  Get Started
                </Button>
              )}
            </div>
          </BlurFade>
        </div>
      </BlurFade>
    </div>
  )
}
