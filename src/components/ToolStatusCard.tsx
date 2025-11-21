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
              {name}
            </p>
            {status.version && (
              <p className="text-xs text-muted-foreground">v{status.version}</p>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {status.error && <p className="text-xs text-destructive">{status.error}</p>}
          </div>
        </div>
        {!status.installed && !status.checking && onInstall && (
          <Button
            size="sm"
            variant={installLabel === 'Install' ? 'default' : 'outline'}
            onClick={onInstall}
            disabled={status.installing}
            className={cn(installLabel === 'Install' && 'min-w-[100px]')}
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
