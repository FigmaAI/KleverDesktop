import { Computer, MemoryStick, Code, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SystemInfo } from '@/hooks/useSettings'
import { cn } from '@/lib/utils'

interface SystemInfoCardProps {
  systemInfo: SystemInfo
}

export function SystemInfoCard({ systemInfo }: SystemInfoCardProps) {
  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0.00 GB'
    const gb = bytes / 1024 ** 3
    return `${gb.toFixed(2)} GB`
  }

  const memoryUsagePercent =
    systemInfo.totalMemory > 0
      ? ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100
      : 0

  const isDataLoaded = systemInfo.platform && systemInfo.platform !== ''

  const getEnvStatusVariant = (status?: string): 'default' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'ready':
        return 'default'
      case 'not_ready':
        return 'destructive'
      case 'checking':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  const getEnvStatusIcon = (status?: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-3 w-3" />
      case 'not_ready':
        return <AlertCircle className="h-3 w-3" />
      case 'checking':
        return <AlertTriangle className="h-3 w-3" />
      default:
        return <AlertTriangle className="h-3 w-3" />
    }
  }

  const getEnvStatusText = (status?: string) => {
    switch (status) {
      case 'ready':
        return 'Ready'
      case 'not_ready':
        return 'Not Ready'
      case 'checking':
        return 'Checking...'
      default:
        return 'Unknown'
    }
  }

  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'bg-destructive'
    if (percent > 70) return 'bg-yellow-500'
    return 'bg-primary'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Information</CardTitle>
        <CardDescription>Current system status and environment details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isDataLoaded && (
          <div className="rounded-md border border-muted bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Loading system information...</p>
          </div>
        )}

        {isDataLoaded && (
          <>
            {/* Platform Info */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Computer className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Platform</h3>
              </div>
              <div className="ml-6 flex flex-wrap gap-2">
                <Badge variant="secondary">{systemInfo.platform || 'Unknown'}</Badge>
                <Badge variant="secondary">{systemInfo.arch || 'Unknown'}</Badge>
                <Badge variant="secondary">
                  {systemInfo.cpus || 0} CPU{systemInfo.cpus !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>

            {/* Memory Info */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <MemoryStick className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Memory</h3>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Used: {formatMemory(systemInfo.totalMemory - systemInfo.freeMemory)}
                  </span>
                  <span className="text-muted-foreground">
                    Total: {formatMemory(systemInfo.totalMemory)}
                  </span>
                </div>
                <div className="relative">
                  <Progress value={memoryUsagePercent} className="h-2" />
                  <div
                    className={cn(
                      'absolute inset-0 h-full rounded-full transition-all',
                      getProgressColor(memoryUsagePercent)
                    )}
                    style={{ width: `${memoryUsagePercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {memoryUsagePercent.toFixed(1)}% used • {formatMemory(systemInfo.freeMemory)} free
                </p>
              </div>
            </div>

            {/* Python Environment */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Python Environment</h3>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">{systemInfo.pythonVersion || 'Not detected'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={getEnvStatusVariant(systemInfo.envStatus)} className="gap-1">
                    {getEnvStatusIcon(systemInfo.envStatus)}
                    {getEnvStatusText(systemInfo.envStatus)}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status Summary */}
            {systemInfo.envStatus === 'not_ready' && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Action Required</AlertTitle>
                <AlertDescription>
                  Python environment is not properly configured. Please run the setup wizard to
                  configure your environment.
                </AlertDescription>
              </Alert>
            )}

            {systemInfo.envStatus === 'ready' && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>All Systems Ready</AlertTitle>
                <AlertDescription>
                  Your environment is properly configured and ready for automation tasks.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
