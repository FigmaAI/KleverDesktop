import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ToolStatus } from '@/types/setupWizard'

interface ToolStatusCardProps {
  name: string
  subtitle?: string
  status: ToolStatus
  delay: number
  onInstall?: () => void
  installLabel?: string
}

export function ToolStatusCard({
  name,
  subtitle,
  status,
  delay,
  onInstall,
  installLabel = 'Install',
}: ToolStatusCardProps) {
  const getColorClass = () => {
    if (status.checking) return 'bg-muted'
    return status.installed ? 'bg-green-50 dark:bg-green-950' : 'bg-yellow-50 dark:bg-yellow-950'
  }

  const getStatusText = () => {
    if (status.checking) return 'Checking...'
    if (status.installing) return 'Installing...'
    if (status.error) return status.error
    if (status.version) return `v${status.version}`
    if (subtitle) return subtitle
    if (status.installed) return 'Ready'
    return 'Not installed'
  }

  return (
    <BlurFade delay={delay}>
      <div
        className={cn(
          'rounded-md p-3 flex items-center justify-between gap-3',
          getColorClass()
        )}
      >
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
              {name}
            </p>
            <p className={cn(
              'text-xs truncate',
              status.error ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {getStatusText()}
            </p>
          </div>
        </div>
        {!status.installed && !status.checking && onInstall && (
          <Button
            size="sm"
            variant={installLabel === 'Install' ? 'default' : 'outline'}
            onClick={onInstall}
            disabled={status.installing}
            className={cn(installLabel === 'Install' && 'min-w-[100px]', 'flex-shrink-0')}
          >
            {status.installing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              installLabel
            )}
          </Button>
        )}
      </div>
    </BlurFade>
  )
}
