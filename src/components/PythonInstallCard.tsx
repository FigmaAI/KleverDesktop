import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { ToolStatus } from '@/types/setupWizard'

interface PythonInstallCardProps {
  status: ToolStatus
  onInstall: () => void
  delay: number
}

export function PythonInstallCard({
  status,
  onInstall,
  delay,
}: PythonInstallCardProps) {
  const [progress, setProgress] = useState(0)

  // Listen for Python download progress to estimate completion
  useEffect(() => {
    if (!status.installing) return

    let lineCount = 0

    const handleProgress = () => {
      lineCount++
      // Estimate progress based on output lines
      // Download: ~30%, Extract: ~30%, Dependencies: ~40%
      const estimatedProgress = Math.min(95, lineCount * 5)
      setProgress(estimatedProgress)
    }

    const cleanup = window.electronAPI.onPythonProgress(handleProgress)

    return cleanup
  }, [status.installing])

  // Reset state when installation starts
  useEffect(() => {
    if (status.installing) {
      setProgress(0)
    }
  }, [status.installing])

  // Set progress to 100% when installed successfully
  useEffect(() => {
    if (status.installed && !status.installing) {
      setProgress(100)
    }
  }, [status.installed, status.installing])

  const getColorClass = () => {
    if (status.checking) return 'bg-muted'
    return status.installed
      ? 'bg-green-50 dark:bg-green-950'
      : 'bg-yellow-50 dark:bg-yellow-950'
  }

  const getStatusText = () => {
    if (status.checking) return 'Checking...'
    if (status.installing) return 'Downloading & Installing...'
    if (status.installed) return 'v3.11.9'

    // Handle "not found" errors as "Not installed" state
    if (status.error && (
      status.error.includes('not found') ||
      status.error.includes('not installed')
    )) {
      return 'Not installed (Will be installed to ~/.klever-desktop/python/)'
    }

    if (status.error) return status.error
    return 'Not installed (Will be installed to ~/.klever-desktop/python/)'
  }

  const isRealError = status.error &&
    !status.error.includes('not found') &&
    !status.error.includes('not installed');

  return (
    <BlurFade delay={delay}>
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
                Python 3.11.9
              </p>
              <p className={cn(
                'text-xs truncate',
                isRealError ? 'text-destructive' : 'text-muted-foreground'
              )}>
                {getStatusText()}
              </p>
            </div>
          </div>
          {!status.installed && !status.checking && (
            <Button
              size="sm"
              onClick={onInstall}
              disabled={status.installing}
              className="min-w-[100px] flex-shrink-0"
            >
              {status.installing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Installing...
                </>
              ) : isRealError ? (
                'Retry'
              ) : (
                'Install'
              )}
            </Button>
          )}
        </div>

        {/* Progress bar during installation */}
        {status.installing && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </div>
    </BlurFade>
  )
}
