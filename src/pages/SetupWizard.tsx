import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { PlatformToolsStep } from '@/components/PlatformToolsStep'
import { PlatformConfigStep } from '@/components/PlatformConfigStep'
import { ModelConfigStep } from '@/components/ModelConfigStep'
import { IntegrationTestStep } from '@/components/IntegrationTestStep'
import { PageHeader } from '@/components/PageHeader'
import { usePlatformTools } from '@/hooks/usePlatformTools'
import { useModelConfig } from '@/hooks/useModelConfig'
import { useIntegrationTest } from '@/hooks/useIntegrationTest'
import { StepConfig } from '@/types/setupWizard'
import { cn } from '@/lib/utils'
import logoImg from '@/assets/logo.png'

const steps: StepConfig[] = [
  { label: 'Platform Tools', description: 'Check Python, Android Studio, Playwright' },
  { label: 'Platform Config', description: 'Configure Android SDK path' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Run integration test' },
]

export function SetupWizard() {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)

  // Platform tools hook
  const { toolsStatus, setToolsStatus, checkPlatformTools, androidSdkPath, setAndroidSdkPath } = usePlatformTools()

  // Model configuration hook (simplified)
  const {
    modelConfig,
    setModelConfig,
    ollamaModels,
    ollamaLoading,
    ollamaError,
    fetchOllamaModels,
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

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      // If moving from Step 0 (Platform Tools), validate Python is installed
      if (currentStep === 0) {
        if (!toolsStatus.python.installed) {
          toast.error(t('setup.pythonRequired'))
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
      // Cleanup integration test project before completing setup
      try {
        await window.electronAPI.cleanupIntegrationTest()
      } catch (error) {
        console.error('[SetupWizard] Failed to cleanup integration test project:', error)
      }
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
      // Build complete config.json with multi-provider model format
      const config = {
        version: '3.0',
        model: {
          providers: [
            {
              id: modelConfig.provider,
              apiKey: modelConfig.apiKey,
              preferredModel: modelConfig.model,
              baseUrl: modelConfig.baseUrl || undefined,
            },
          ],
          lastUsed: {
            provider: modelConfig.provider,
            model: modelConfig.model,
          },
        },
        execution: {
          maxTokens: 4096,
          temperature: 0.0,
          requestInterval: 10,
          maxRounds: 20,
        },
        android: {
          screenshotDir: '/sdcard',
          xmlDir: '/sdcard',
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
        toast.error(t('setup.configSaveFailedWithError', { error: result.error }))
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('[SetupWizard] Error saving configuration:', error)
      toast.error(t('setup.configSaveFailed'))
      throw error
    }
  }

  const canProceedFromStep0 = () => {
    return (
      toolsStatus.python.installed &&
      toolsStatus.pythonEnv.installed &&
      toolsStatus.androidStudio.installed
    )
  }

  const canProceedFromStep1 = () => {
    // Android SDK path is optional but recommended
    return true
  }

  const canProceedFromStep2 = () => {
    // Must have provider and model selected
    if (!modelConfig.provider || !modelConfig.model) return false

    // For non-Ollama providers, API key is required
    if (modelConfig.provider !== 'ollama' && !modelConfig.apiKey) return false

    return true
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <PageHeader
        logo={<img src={logoImg} alt="Klever Desktop" className="h-8 w-8" />}
        title="Setup Wizard"
        subtitle="Configure your environment for AI-powered UI automation"
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Horizontal Stepper at top */}
        <div className="border-b bg-background px-6 py-4">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                {/* Step Circle */}
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                      index < currentStep
                        ? 'bg-primary text-primary-foreground'
                        : index === currentStep
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={cn(
                      'hidden text-sm font-medium sm:inline',
                      index === currentStep
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 w-8 sm:w-12',
                      index < currentStep ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-6">
          <div className="flex-1 overflow-auto">
            <BlurFade delay={0.1} inView>
              {/* Step 0: Platform Tools Check */}
              {currentStep === 0 && (
                <PlatformToolsStep
                  toolsStatus={toolsStatus}
                  setToolsStatus={setToolsStatus}
                  checkPlatformTools={checkPlatformTools}
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
            </BlurFade>
          </div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
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
        </div>
      </div>
    </div>
  )
}
