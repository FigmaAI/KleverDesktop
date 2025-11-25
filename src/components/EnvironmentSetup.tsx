import React, { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { ToolStatus, PlatformToolsState } from '@/types/setupWizard'
import { useTerminal } from '@/hooks/useTerminal'

interface EnvironmentSetupProps {
  status: ToolStatus
  setToolsStatus: React.Dispatch<React.SetStateAction<PlatformToolsState>>
  checkPlatformTools: () => Promise<void>
}

export function EnvironmentSetup({
  status,
  setToolsStatus,
  checkPlatformTools,
}: EnvironmentSetupProps) {
  const [envSetupProgress, setEnvSetupProgress] = useState(0)
  const { lines } = useTerminal()

  // Calculate progress based on env log lines
  useEffect(() => {
    if (status.installing) {
      const envLogCount = lines.filter(l => l.source === 'env').length
      // Estimate progress: cap at 95% until complete
      const estimated = Math.min(95, envLogCount * 2)
      setEnvSetupProgress(estimated)
    }
  }, [lines, status.installing])

  const handleSetupEnvironment = async () => {
    setToolsStatus((prev) => ({ ...prev, pythonEnv: { ...prev.pythonEnv, installing: true, error: undefined } }))
    setEnvSetupProgress(0)

    try {
      // No need to listen manually, useTerminal handles it via context
      const result = await window.electronAPI.envSetup()

      if (result && result.success) {
        setEnvSetupProgress(100)
        // Recheck platform tools
        await checkPlatformTools()
      } else {
        // Show error to user
        console.error('[EnvironmentSetup] Setup failed:', result?.error)
        setToolsStatus((prev) => ({
          ...prev,
          pythonEnv: {
            ...prev.pythonEnv,
            installing: false,
            error: result?.error || 'Setup failed. Check Universal Terminal for details.'
          }
        }))
        return
      }
    } catch (error) {
      console.error('[EnvironmentSetup] Error:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setToolsStatus((prev) => ({
        ...prev,
        pythonEnv: {
          ...prev.pythonEnv,
          installing: false,
          error: errorMsg
        }
      }))
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

  const getStatusText = () => {
    if (status.checking) return 'Checking...'
    if (status.installing) return 'Installing... Check Universal Terminal for details'
    if (status.installed) return 'Ready'
    if (status.error) return status.error
    return 'Virtual environment + packages + Playwright browsers'
  }

  return (
    <BlurFade delay={0.3}>
      <div className={cn('rounded-md p-3', getColorClass())}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {status.checking ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground flex-shrink-0" />
            ) : status.installed ? (
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-medium truncate',
                  status.installed ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Python Environment
              </p>
              <p className={cn(
                'text-xs truncate',
                status.error ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {getStatusText()}
              </p>
            </div>
          </div>
          {!status.installed && !status.checking && (
            <Button
              size="sm"
              onClick={handleSetupEnvironment}
              disabled={status.installing}
              className="min-w-[100px] flex-shrink-0"
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
          <div className="mt-3">
            <Progress value={envSetupProgress} className="h-1.5" />
          </div>
        )}
      </div>
    </BlurFade>
  )
}
