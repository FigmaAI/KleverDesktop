import { useRef, useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PythonInstallCard } from './PythonInstallCard'
import { EnvironmentSetup } from './EnvironmentSetup'
import { ToolStatusCard } from './ToolStatusCard'
import { Terminal, AnimatedSpan } from '@/components/ui/terminal'
import { useTerminal } from '@/hooks/useTerminal'
import { PlatformToolsState } from '@/types/setupWizard'
import { renderAnsi } from '@/utils/ansiParser'
import { cn } from '@/lib/utils'

interface PlatformToolsStepProps {
  toolsStatus: PlatformToolsState
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => Promise<void>
  autoInstallEnabled?: boolean
}

export function PlatformToolsStep({
  toolsStatus,
  setToolsStatus,
  checkPlatformTools,
  autoInstallEnabled = false,
}: PlatformToolsStepProps) {
  const { t } = useTranslation()
  const { lines } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)
  const [autoInstallInProgress, setAutoInstallInProgress] = useState(false)
  const [autoInstallProgress, setAutoInstallProgress] = useState(0)
  const [currentInstallStep, setCurrentInstallStep] = useState('')
  const hasStartedAutoInstall = useRef(false)

  // Filter lines for environment setup logs
  const envLines = lines.filter((line) => line.source === 'env')

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [envLines])

  const downloadPython = async () => {
    setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, installing: true, error: undefined } }))
    try {
      const result = await window.electronAPI.pythonDownload()
      if (result.success) {
        await checkPlatformTools()
      } else {
        setToolsStatus((prev) => ({
          ...prev,
          python: { ...prev.python, error: result.error || 'Download failed' },
        }))
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      setToolsStatus((prev) => ({
        ...prev,
        python: { ...prev.python, error: msg },
      }))
    } finally {
      setToolsStatus((prev) => ({ ...prev, python: { ...prev.python, installing: false } }))
    }
  }

  const setupEnvironment = async () => {
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true, error: undefined } }))
    try {
      const result = await window.electronAPI.envSetup()
      if (result && result.success) {
        await checkPlatformTools()
      } else {
        setToolsStatus((prev) => ({
          ...prev,
          pythonEnv: {
            ...prev.pythonEnv,
            installing: false,
            error: result?.error || 'Setup failed. Check Installation Logs for details.'
          }
        }))
        throw new Error(result?.error || 'Setup failed')
      }
    } finally {
      setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: false } }))
    }
  }

  const installAndroidStudio = async () => {
    setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, installing: true, error: undefined } }))
    try {
      const result = await window.electronAPI.installAndroidStudio()
      if (result.success) {
        await checkPlatformTools()
      } else {
        setToolsStatus((prev) => ({
          ...prev,
          androidStudio: {
            ...prev.androidStudio,
            installing: false,
            error: result.error || 'Installation failed'
          }
        }))
        throw new Error(result.error || 'Installation failed')
      }
    } finally {
      setToolsStatus((prev) => ({ ...prev, androidStudio: { ...prev.androidStudio, installing: false } }))
    }
  }

  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    stepName: string
  ): Promise<T> => {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff: 1s, 2s, 4s
          setCurrentInstallStep(`${stepName} (Retry ${attempt}/${maxRetries - 1} in ${delay/1000}s...)`)
          await new Promise(resolve => setTimeout(resolve, delay))
          setCurrentInstallStep(`${stepName} (Retrying ${attempt}/${maxRetries - 1}...)`)
        }
      }
    }

    throw lastError
  }

  const runAutoInstall = useCallback(async () => {
    if (hasStartedAutoInstall.current) return
    hasStartedAutoInstall.current = true

    setAutoInstallInProgress(true)
    setAutoInstallProgress(0)

    try {
      // Step 1: Install Python (33% progress)
      if (!toolsStatus.python.installed) {
        setCurrentInstallStep('Installing Python runtime...')
        setAutoInstallProgress(10)

        try {
          await retryWithBackoff(downloadPython, 3, 'Installing Python runtime')
          setAutoInstallProgress(33)
          toast.success(t('setup.autoInstall.pythonSuccess'))

          // Wait a bit for the installation to settle
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          toast.error(t('setup.autoInstall.pythonFailed', { error: msg }), {
            description: t('setup.autoInstall.pythonFailedDesc')
          })
          setAutoInstallInProgress(false)
          return
        }
      } else {
        setAutoInstallProgress(33)
      }

      // Step 2: Setup Python Environment (66% progress)
      if (!toolsStatus.pythonEnv.installed) {
        setCurrentInstallStep('Setting up Python environment...')
        setAutoInstallProgress(40)

        try {
          await retryWithBackoff(setupEnvironment, 3, 'Setting up Python environment')
          setAutoInstallProgress(66)
          toast.success(t('setup.autoInstall.envSuccess'))

          // Wait a bit for the installation to settle
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          toast.error(t('setup.autoInstall.envFailed', { error: msg }), {
            description: t('setup.autoInstall.envFailedDesc')
          })
          setAutoInstallInProgress(false)
          return
        }
      } else {
        setAutoInstallProgress(66)
      }

      // Step 3: Install Android SDK (100% progress)
      if (!toolsStatus.androidStudio.installed) {
        setCurrentInstallStep('Installing Android SDK...')
        setAutoInstallProgress(70)

        try {
          await retryWithBackoff(installAndroidStudio, 2, 'Installing Android SDK')
          setAutoInstallProgress(100)
          toast.success(t('setup.autoInstall.sdkSuccess'))
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Installation failed'
          if (msg.includes('needsManualInstall') || msg.includes('Homebrew') || msg.includes('Chocolatey')) {
            toast.warning(t('setup.autoInstall.sdkWarning'), {
              description: t('setup.autoInstall.sdkWarningDesc')
            })
          } else {
            toast.error(t('setup.autoInstall.sdkFailed', { error: msg }), {
              description: t('setup.autoInstall.sdkFailedDesc')
            })
          }
          // Don't return here - Android SDK is less critical, we can continue
        }
      } else {
        setAutoInstallProgress(100)
      }

      setCurrentInstallStep(t('setup.autoInstall.complete'))
      toast.success(t('setup.autoInstall.allComplete'), {
        description: t('setup.autoInstall.allCompleteDesc')
      })

    } finally {
      setAutoInstallInProgress(false)
      await checkPlatformTools()
    }
  }, [toolsStatus.python.installed, toolsStatus.pythonEnv.installed, toolsStatus.androidStudio.installed, checkPlatformTools])

  // Auto-install effect
  useEffect(() => {
    if (autoInstallEnabled && !autoInstallInProgress && !hasStartedAutoInstall.current) {
      // Check if any installation is needed
      const needsInstall = !toolsStatus.python.installed ||
                          !toolsStatus.pythonEnv.installed ||
                          !toolsStatus.androidStudio.installed

      if (needsInstall && !toolsStatus.python.checking && !toolsStatus.pythonEnv.checking && !toolsStatus.androidStudio.checking) {
        runAutoInstall()
      }
    }
  }, [autoInstallEnabled, autoInstallInProgress, toolsStatus, runAutoInstall])

  const isMac = window.navigator.platform.toLowerCase().includes('mac')
  const isWindows = window.navigator.platform.toLowerCase().includes('win')

  return (
    <BlurFade key="step-1" delay={0.1}>
      <Card className="h-full min-h-[480px]">
        <CardContent className="p-6 h-full">
          <div className="grid grid-cols-8 gap-6 h-full">
            {/* Left: Tools List */}
            <div className="col-span-3 space-y-4">
              {/* Auto-Install Progress */}
              {autoInstallInProgress && (
                <BlurFade delay={0.1}>
                  <div className="rounded-lg border bg-primary/5 p-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">{t('setup.autoInstall.inProgress')}</h4>
                        <span className="text-xs text-muted-foreground">{autoInstallProgress}%</span>
                      </div>
                      <Progress value={autoInstallProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground">{currentInstallStep}</p>
                    </div>
                  </div>
                </BlurFade>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Platform Tools</h3>
                  <p className="text-sm text-muted-foreground">
                    Install required tools for Klever Desktop
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {/* Recheck Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={checkPlatformTools}
                    disabled={toolsStatus.pythonEnv.checking || toolsStatus.pythonEnv.installing}
                    title="Recheck Environment"
                  >
                    <RefreshCw className={cn("h-4 w-4", toolsStatus.pythonEnv.checking && "animate-spin")} />
                  </Button>

                  {/* Hard Reset Button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      if (confirm('This will delete the entire ~/.klever-desktop directory and reinstall everything. Continue?')) {
                        try {
                          const result = await window.electronAPI.envReset();
                          if (result && result.success) {
                            await checkPlatformTools();
                          } else {
                            console.error('[Hard Reset] Failed:', result?.error);
                            alert(`Failed to reset environment: ${result?.error || 'Unknown error'}`);
                          }
                        } catch (error) {
                          console.error('[Hard Reset] Error:', error);
                          alert(`Error during reset: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                      }
                    }}
                    disabled={toolsStatus.pythonEnv.checking || toolsStatus.pythonEnv.installing}
                    title="Hard Reset (Delete & Reinstall)"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {/* ===== Required Tools ===== */}
                
                {/* Python 3.11.9 (Post-Install Download) */}
                <PythonInstallCard
                  status={{
                    ...toolsStatus.python,
                    installing: toolsStatus.python.installing || autoInstallInProgress
                  }}
                  onInstall={downloadPython}
                  delay={0.1}
                />

                {/* Playwright Browsers (Chromium for web automation) */}
                <EnvironmentSetup
                  status={{
                    ...toolsStatus.pythonEnv,
                    installing: toolsStatus.pythonEnv.installing || autoInstallInProgress
                  }}
                  setToolsStatus={setToolsStatus}
                  checkPlatformTools={checkPlatformTools}
                />

                {/* Android SDK (ADB & Emulator) */}
                <ToolStatusCard
                  name="Android SDK"
                  subtitle="ADB & Emulator"
                  status={{
                    ...toolsStatus.androidStudio,
                    installing: toolsStatus.androidStudio.installing || autoInstallInProgress
                  }}
                  delay={0.3}
                  onInstall={() => window.electronAPI.installAndroidStudio()}
                  installLabel="Install"
                />

                {/* ===== Optional Tools Divider ===== */}
                <div className="flex items-center gap-2 pt-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">Optional</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Homebrew (macOS only) */}
                {isMac && (
                  <ToolStatusCard
                    name="Homebrew"
                    subtitle="Package Manager"
                    status={toolsStatus.homebrew}
                    delay={0.4}
                    onInstall={() => window.electronAPI.openExternal('https://brew.sh')}
                    installLabel="Install Guide"
                  />
                )}

                {/* Chocolatey (Windows only) */}
                {isWindows && (
                  <ToolStatusCard
                    name="Chocolatey"
                    subtitle="Package Manager"
                    status={toolsStatus.chocolatey}
                    delay={0.4}
                    onInstall={() => window.electronAPI.openExternal('https://chocolatey.org/install')}
                    installLabel="Install Guide"
                  />
                )}

                {/* Ollama (Local AI) */}
                <ToolStatusCard
                  name="Ollama"
                  subtitle="Local AI Runtime"
                  status={toolsStatus.ollama}
                  delay={0.5}
                  onInstall={() => window.electronAPI.openExternal('https://ollama.com/download')}
                  installLabel="Download"
                />
              </div>
            </div>

            {/* Right: Terminal Output */}
            <div className="col-span-5 flex h-full flex-col">
              <div className="flex h-full overflow-hidden rounded-lg border">
                <div ref={outputRef} className="h-full overflow-y-auto w-full">
                  <Terminal
                    sequence={false}
                    className="h-full border-0 rounded-none max-w-none min-h-[400px]"
                    title="Installation Logs"
                  >
                    {envLines.length === 0 ? (
                      <AnimatedSpan className="text-muted-foreground">
                        Ready to install. Click &quot;Install&quot; or &quot;Setup&quot; on the left to start.
                      </AnimatedSpan>
                    ) : (
                      <>
                        {envLines.map((line) => (
                          <AnimatedSpan key={line.id} className="font-mono text-xs">
                            {renderAnsi(line.content)}
                          </AnimatedSpan>
                        ))}
                      </>
                    )}
                  </Terminal>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
