import React, { useState } from 'react'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { ToolStatus } from '@/types/setupWizard'

interface PlatformToolsState {
  python: ToolStatus
  pythonEnv: ToolStatus
  androidStudio: ToolStatus
  homebrew: ToolStatus
}

interface EnvironmentSetupProps {
  status: ToolStatus
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => void
}

export function EnvironmentSetup({
  status,
  setToolsStatus,
  checkPlatformTools,
}: EnvironmentSetupProps) {
  const [envSetupProgress, setEnvSetupProgress] = useState(0)

  const handleSetupEnvironment = async () => {
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true } }))
    setEnvSetupProgress(0)

    try {
      let lineCount = 0
      // Listen for progress to estimate completion
      window.electronAPI.onEnvProgress(() => {
        lineCount++
        // Estimate progress based on typical installation steps
        const estimatedProgress = Math.min(95, lineCount * 2)
        setEnvSetupProgress(estimatedProgress)
      })

      const result = await window.electronAPI.envSetup()

      if (result.success) {
        setEnvSetupProgress(100)
        // Recheck platform tools
        await checkPlatformTools()
      } else {
        // Error will be shown in universal terminal
        console.error('[EnvironmentSetup] Setup failed:', result.error)
      }
    } catch (error) {
      console.error('[EnvironmentSetup] Error:', error)
    } finally {
      setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: false } }))
    }
  }

  const getColorClass = () => {
    if (status.checking) return 'bg-muted'
    return status.installed
      ? 'bg-green-50 dark:bg-green-950'
      : 'bg-yellow-50 dark:bg-yellow-950'
  }

  return (
    <BlurFade delay={0.3}>
      <div className={cn('rounded-md p-3 flex flex-col gap-3', getColorClass())}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {status.checking ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : status.installed ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm',
                  status.installed ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                Playwright Browsers
              </p>
              <p className="text-xs text-muted-foreground">
                Required for web automation (Chromium browser)
              </p>
            </div>
          </div>
          {!status.installed && !status.checking && (
            <Button
              size="sm"
              onClick={handleSetupEnvironment}
              disabled={status.installing}
              className="min-w-[100px]"
            >
              {status.installing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Setup'
              )}
            </Button>
          )}
        </div>

        {/* Progress bar during installation */}
        {status.installing && (
          <div className="space-y-2">
            <Progress value={envSetupProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">{envSetupProgress}%</p>
          </div>
        )}

        {/* Guide message during installation */}
        {status.installing && (
          <Alert>
            <AlertDescription className="text-sm">
              Installation in progress. Check the Universal Terminal (top right) for detailed
              progress.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </BlurFade>
  )
}
