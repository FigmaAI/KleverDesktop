import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { PlatformToolsStep } from '@/components/PlatformToolsStep'
import { PlatformConfigStep } from '@/components/PlatformConfigStep'
import { ModelConfigStep } from '@/components/ModelConfigStep'
import { LocalModelSetupStep } from '@/components/LocalModelSetupStep'
import { PageHeader } from '@/components/PageHeader'
import { usePlatformTools } from '@/hooks/usePlatformTools'
import { useModelConfig } from '@/hooks/useModelConfig'
import { useRecommendedModelSetup } from '@/hooks/useRecommendedModelSetup'
import { StepConfig } from '@/types/setupWizard'
import { cn } from '@/lib/utils'
import logoImg from '@/assets/logo.png'



export function SetupWizard() {
  const { t } = useTranslation()
  const [currentStep, setCurrentStep] = useState(0)
  const [isModelVerified, setIsModelVerified] = useState(false)

  const steps: StepConfig[] = [
    { label: t('setup.steps.platformTools'), description: t('setup.steps.platformToolsDesc') },
    { label: t('setup.steps.platformConfig'), description: t('setup.steps.platformConfigDesc') },
    { label: t('setup.steps.localFirst'), description: t('setup.steps.localFirstDesc') },
    { label: t('setup.steps.modelSetup'), description: t('setup.steps.modelSetupDesc') },
  ]

  // Constants
  const GELAB_ZERO_ID = 'ahmadwaqar/gelab-zero-4b-preview:q8_0'

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
  // Local Model Setup hook
  const {
    isInstalling: isLocalModelInstalling,
    isSuccess: isLocalModelSuccess,
    ollamaInstalled,
    startInstall: startLocalModelInstall,
  } = useRecommendedModelSetup(GELAB_ZERO_ID)

  // Handle local model install with Ollama not installed fallback
  const handleLocalModelInstall = (modelId: string) => {
    startLocalModelInstall(modelId, () => {
      // Ollama is not installed - show toast and redirect to Step 0
      toast.error(t('setup.ollamaNotInstalled'), {
        description: t('setup.ollamaNotInstalledDesc'),
        duration: 5000,
      })
      setCurrentStep(0)
    })
  }

  // ... (useEffects)

  // ... (render)



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

      // If moving from Step 2 (Local Model Setup), just proceed
      setCurrentStep(currentStep + 1)
    } else {
      // Final step completed (Model Config)
      try {
        await handleSaveConfig()
        // Config saved successfully, reload to trigger App checkSetup
        window.location.reload()
      } catch {
        console.error('[SetupWizard] Failed to save config')
        // Error toast already shown in handleSaveConfig
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
      // Build complete config.json with multi-provider model format
      const config = {
        version: '3.0',
        model: {
          providers: modelConfig.providers,
          lastUsed: modelConfig.lastUsed,
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
    // Step 2: Local Model Setup
    // It's optional, but we disable Next while installing to prevent state issues
    return !isLocalModelInstalling
  }

  const canProceedFromStep3 = () => {
    // Step 3: Model Configuration
    // At least one valid provider must be configured and validated
    return isModelVerified
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

              {/* Step 2: Local Model Setup (Optional) */}
              {currentStep === 2 && (
                <LocalModelSetupStep
                  recommendedModel={{
                    name: t('setup.localModelStep.modelName'),
                    description: t('setup.localModelStep.modelDescription'),
                    id: GELAB_ZERO_ID
                  }}
                  isInstalling={isLocalModelInstalling}
                  isSuccess={isLocalModelSuccess}
                  ollamaInstalled={ollamaInstalled}
                  onInstall={handleLocalModelInstall}
                />
              )}

              {/* Step 3: Model Configuration */}
              {currentStep === 3 && (
                <ModelConfigStep
                  modelConfig={modelConfig}
                  setModelConfig={setModelConfig}
                  ollamaModels={ollamaModels}
                  ollamaLoading={ollamaLoading}
                  ollamaError={ollamaError}
                  fetchOllamaModels={fetchOllamaModels}
                  onVerified={setIsModelVerified}
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
                disabled={!canProceedFromStep3() || !isModelVerified}
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
