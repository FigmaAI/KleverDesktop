import { RefreshCw } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ToolStatusCard } from './ToolStatusCard'
import { PythonInstallCard } from './PythonInstallCard'
import { EnvironmentSetup } from './EnvironmentSetup'
import { ToolStatus } from '@/types/setupWizard'

interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

interface PlatformToolsStepProps {
  toolsStatus: PlatformToolsState
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => void
  downloadPython: () => void
}

export function PlatformToolsStep({
  toolsStatus,
  setToolsStatus,
  checkPlatformTools,
  downloadPython,
}: PlatformToolsStepProps) {
  const isMac = window.navigator.platform.toLowerCase().includes('mac')

  return (
    <BlurFade key="step-0" delay={0.1}>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Platform & Runtime Tools Check</CardTitle>
              <CardDescription className="mt-1.5">
                We&apos;re checking if all required tools are installed and configured correctly.
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={checkPlatformTools}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recheck
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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

            {/* Android Studio */}
            <ToolStatusCard
              name="Android Studio"
              status={toolsStatus.androidStudio}
              delay={0.4}
              onInstall={() =>
                window.electronAPI.openExternal('https://developer.android.com/studio')
              }
              installLabel="Install Guide"
            />
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
