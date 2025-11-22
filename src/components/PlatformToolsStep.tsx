import { useRef, useEffect } from 'react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent } from '@/components/ui/card'
import { PythonInstallCard } from './PythonInstallCard'
import { EnvironmentSetup } from './EnvironmentSetup'
import { ToolStatusCard } from './ToolStatusCard'
import { Terminal, AnimatedSpan } from '@/components/ui/terminal'
import { useTerminal } from '@/hooks/useTerminal'
import { ToolStatus, PlatformToolsState } from '@/types/setupWizard'
import { renderAnsi } from '@/utils/ansiParser'

interface PlatformToolsStepProps {
  toolsStatus: PlatformToolsState
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => Promise<void>
}

export function PlatformToolsStep({
  toolsStatus,
  setToolsStatus,
  checkPlatformTools,
}: PlatformToolsStepProps) {
  const { lines } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)

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

  const isMac = window.navigator.platform.toLowerCase().includes('mac')

  return (
    <BlurFade key="step-1" delay={0.1}>
      <Card className="h-full min-h-[480px]">
        <CardContent className="p-6 h-full">
          <div className="grid grid-cols-8 gap-6 h-full">
            {/* Left: Tools List */}
            <div className="col-span-3 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Platform Tools</h3>
                <p className="text-sm text-muted-foreground">
                  Install required tools for Klever Desktop
                </p>
              </div>

              <div className="space-y-3">
                {/* Homebrew (macOS only) */}
                {isMac && (
                  <ToolStatusCard
                    name="Homebrew"
                    status={toolsStatus.homebrew}
                    delay={0.1}
                    onInstall={() => window.electronAPI.openExternal('https://brew.sh')}
                    installLabel="Install Guide"
                  />
                )}

                {/* Python 3.11.9 (Post-Install Download) */}
                <PythonInstallCard
                  status={toolsStatus.python}
                  onInstall={downloadPython}
                  delay={0.2}
                />

                {/* Playwright Browsers (Chromium for web automation) */}
                <EnvironmentSetup
                  status={toolsStatus.pythonEnv}
                  setToolsStatus={setToolsStatus}
                  checkPlatformTools={checkPlatformTools}
                />

                {/* Android SDK (ADB & Emulator) */}
                <ToolStatusCard
                  name="Android SDK"
                  subtitle="ADB & Emulator"
                  status={toolsStatus.androidStudio}
                  delay={0.4}
                  onInstall={() => window.electronAPI.installAndroidStudio()}
                  installLabel="Install"
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
                        Ready to install. Click "Install" or "Setup" on the left to start.
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
