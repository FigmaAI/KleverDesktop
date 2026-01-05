import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cloud,
  Cpu,
  Zap,
  DollarSign,
  Trophy,
  CheckCircle,
  Target,
  Clock,
} from 'lucide-react'
import { formatModelName } from '@/lib/model-utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BlurFade } from '@/components/magicui/blur-fade'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Project, Task } from '@/types/project'
import type { StatisticsSection } from '@/components/app-sidebar'

interface StatisticsProps {
  projects: Project[]
  section: StatisticsSection
}

interface ModelStatistics {
  modelKey: string
  modelName: string
  modelDisplayName: string
  modelProvider: string
  isLocal: boolean
  taskCount: number
  completedCount: number
  failedCount: number
  successRate: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  estimatedCost: number  // For tooltip display
  totalRounds: number
  averageRounds: number
  avgTokensPerSecond: number
  avgDurationMs: number
}

type SortField = 'taskCount' | 'successRate' | 'averageRounds' | 'totalTokens' | 'avgTokensPerSecond'
type SortDirection = 'asc' | 'desc'

// Utility function to format token count
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return tokens.toString()
}

// Utility function to format cost for display (tooltip only)
function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return '< $0.01'
  if (cost < 1) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

// Utility function to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

// Check if a task used a local model
function isLocalModel(task: Task): boolean {
  return task.modelProvider === 'ollama' || task.metrics?.isLocalModel === true
}

// Sort icon component
function SortIcon({
  field,
  sortField,
  sortDirection,
}: {
  field: SortField
  sortField: SortField
  sortDirection: SortDirection
}) {
  if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
  return sortDirection === 'asc' ? (
    <ArrowUp className="ml-2 h-4 w-4" />
  ) : (
    <ArrowDown className="ml-2 h-4 w-4" />
  )
}

export function Statistics({ projects, section }: StatisticsProps) {
  const { t } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('taskCount')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Aggregate statistics by model
  const modelStats = useMemo(() => {
    const statsMap = new Map<string, ModelStatistics>()

    // Iterate through all projects and tasks
    projects.forEach((project) => {
      project.tasks.forEach((task) => {
        // Skip tasks without model info or pending/running/cancelled status
        if (!task.modelName) return
        if (task.status === 'pending' || task.status === 'running') return

        const isLocal = isLocalModel(task)

        // Filter by section (API vs Local)
        if (section === 'api' && isLocal) return
        if (section === 'local' && !isLocal) return

        const provider = task.modelProvider || 'unknown'
        const modelKey = `${provider}/${task.modelName}`

        // Get or create stats entry
        let stats = statsMap.get(modelKey)
        if (!stats) {
          stats = {
            modelKey,
            modelName: task.modelName,
            modelDisplayName: formatModelName(task.modelName),
            modelProvider: provider,
            isLocal,
            taskCount: 0,
            completedCount: 0,
            failedCount: 0,
            successRate: 0,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCost: 0,
            totalRounds: 0,
            averageRounds: 0,
            avgTokensPerSecond: 0,
            avgDurationMs: 0,
          }
          statsMap.set(modelKey, stats)
        }

        // Update counts
        stats.taskCount++
        if (task.status === 'completed') stats.completedCount++
        if (task.status === 'failed') stats.failedCount++

        // Update metrics if available
        if (task.metrics) {
          stats.totalTokens += task.metrics.tokens || 0
          stats.inputTokens += task.metrics.inputTokens || 0
          stats.outputTokens += task.metrics.outputTokens || 0
          stats.totalRounds += task.metrics.rounds || 0
          stats.estimatedCost += task.metrics.estimatedCost || 0

          // Track duration and speed for averaging
          if (task.metrics.durationMs) {
            stats.avgDurationMs += task.metrics.durationMs
          }
          if (task.metrics.tokensPerSecond) {
            stats.avgTokensPerSecond += task.metrics.tokensPerSecond
          }
        }
      })
    })

    // Calculate averages and success rates
    statsMap.forEach((stats) => {
      const finishedTasks = stats.completedCount + stats.failedCount
      if (finishedTasks > 0) {
        stats.successRate = (stats.completedCount / finishedTasks) * 100
      }
      if (stats.taskCount > 0) {
        stats.averageRounds = stats.totalRounds / stats.taskCount
        stats.avgDurationMs = stats.avgDurationMs / stats.taskCount
        stats.avgTokensPerSecond = stats.avgTokensPerSecond / stats.taskCount
      }
    })

    return Array.from(statsMap.values())
  }, [projects, section])

  // Best models for highlight cards
  const bestModels = useMemo(() => {
    if (modelStats.length === 0) return null

    // Filter models with at least 1 completed task for meaningful stats
    const modelsWithData = modelStats.filter(m => m.taskCount > 0)
    if (modelsWithData.length === 0) return null

    // Most used model (highest task count)
    const mostUsed = [...modelsWithData].sort((a, b) => b.taskCount - a.taskCount)[0]

    // Most reliable (highest success rate, minimum 1 finished task)
    const modelsWithFinished = modelsWithData.filter(m => m.completedCount + m.failedCount > 0)
    const mostReliable = modelsWithFinished.length > 0
      ? [...modelsWithFinished].sort((a, b) => b.successRate - a.successRate)[0]
      : null

    // Most efficient (lowest average rounds, minimum 1 task with rounds data)
    const modelsWithRounds = modelsWithData.filter(m => m.averageRounds > 0)
    const mostEfficient = modelsWithRounds.length > 0
      ? [...modelsWithRounds].sort((a, b) => a.averageRounds - b.averageRounds)[0]
      : null

    // Most tokens (highest total token usage)
    const mostTokens = modelsWithData.length > 0
      ? [...modelsWithData].sort((a, b) => b.totalTokens - a.totalTokens)[0]
      : null

    // Fastest (highest tokens per second, for local models)
    const modelsWithSpeed = modelsWithData.filter(m => m.avgTokensPerSecond > 0)
    const fastest = modelsWithSpeed.length > 0
      ? [...modelsWithSpeed].sort((a, b) => b.avgTokensPerSecond - a.avgTokensPerSecond)[0]
      : null

    return { mostUsed, mostReliable, mostEfficient, mostTokens, fastest }
  }, [modelStats])

  // Sort and paginate
  const sortedStats = useMemo(() => {
    return [...modelStats].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'taskCount':
          comparison = a.taskCount - b.taskCount
          break
        case 'successRate':
          comparison = a.successRate - b.successRate
          break
        case 'averageRounds':
          comparison = a.averageRounds - b.averageRounds
          break
        case 'totalTokens':
          comparison = a.totalTokens - b.totalTokens
          break
        case 'avgTokensPerSecond':
          comparison = a.avgTokensPerSecond - b.avgTokensPerSecond
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [modelStats, sortField, sortDirection])

  const totalPages = Math.ceil(sortedStats.length / rowsPerPage)
  const paginatedStats = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage
    return sortedStats.slice(startIndex, startIndex + rowsPerPage)
  }, [sortedStats, currentPage, rowsPerPage])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Empty state
  if (modelStats.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <BlurFade delay={0.1}>
          <div className="flex flex-col items-center justify-center text-center max-w-md">
            <div className="mb-6 rounded-full bg-primary/10 p-6">
              {section === 'api' ? (
                <Cloud className="h-12 w-12 text-primary" />
              ) : (
                <Cpu className="h-12 w-12 text-primary" />
              )}
            </div>
            <h2 className="mb-2 text-2xl font-semibold">{t('statistics.empty')}</h2>
            <p className="text-muted-foreground">
              {section === 'api'
                ? t('statistics.emptyApiDesc')
                : t('statistics.emptyLocalDesc')}
            </p>
          </div>
        </BlurFade>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-6">
      {/* Best Models Cards */}
      {bestModels && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Most Used */}
          <BlurFade delay={0.1}>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Trophy className="h-4 w-4" />
                <span className="text-sm">{t('statistics.best.mostUsed')}</span>
              </div>
              <p className="text-lg font-bold truncate" title={bestModels.mostUsed?.modelName}>
                {bestModels.mostUsed?.modelDisplayName || '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {bestModels.mostUsed ? `${bestModels.mostUsed.taskCount} ${t('statistics.best.tasks')}` : ''}
              </p>
            </div>
          </BlurFade>

          {/* Most Reliable */}
          <BlurFade delay={0.15}>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">{t('statistics.best.mostReliable')}</span>
              </div>
              <p className="text-lg font-bold truncate" title={bestModels.mostReliable?.modelName}>
                {bestModels.mostReliable?.modelDisplayName || '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {bestModels.mostReliable ? `${bestModels.mostReliable.successRate.toFixed(1)}% ${t('statistics.best.success')}` : ''}
              </p>
            </div>
          </BlurFade>

          {/* Most Efficient */}
          <BlurFade delay={0.2}>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                <span className="text-sm">{t('statistics.best.mostEfficient')}</span>
              </div>
              <p className="text-lg font-bold truncate" title={bestModels.mostEfficient?.modelName}>
                {bestModels.mostEfficient?.modelDisplayName || '-'}
              </p>
              <p className="text-xs text-muted-foreground">
                {bestModels.mostEfficient ? `${bestModels.mostEfficient.averageRounds.toFixed(1)} ${t('statistics.best.avgRounds')}` : ''}
              </p>
            </div>
          </BlurFade>

          {/* Most Tokens (API) or Fastest (Local) */}
          {section === 'api' ? (
            <BlurFade delay={0.25}>
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm">{t('statistics.best.mostTokens')}</span>
                </div>
                <p className="text-lg font-bold truncate" title={bestModels.mostTokens?.modelName}>
                  {bestModels.mostTokens?.modelDisplayName || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bestModels.mostTokens ? `${formatTokens(bestModels.mostTokens.totalTokens)} ${t('statistics.best.totalTokens')}` : ''}
                </p>
              </div>
            </BlurFade>
          ) : (
            <BlurFade delay={0.25}>
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Zap className="h-4 w-4" />
                  <span className="text-sm">{t('statistics.best.fastest')}</span>
                </div>
                <p className="text-lg font-bold truncate" title={bestModels.fastest?.modelName}>
                  {bestModels.fastest?.modelDisplayName || '-'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {bestModels.fastest ? `${Math.round(bestModels.fastest.avgTokensPerSecond)} tok/s` : ''}
                </p>
              </div>
            </BlurFade>
          )}
        </div>
      )}

      {/* Statistics Table */}
      <div className="rounded-md border flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">{t('statistics.table.model')}</TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('taskCount')}
                >
                  {t('statistics.table.tasks')}
                  <SortIcon field="taskCount" sortField={sortField} sortDirection={sortDirection} />
                </Button>
              </TableHead>
              <TableHead className="w-[130px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('successRate')}
                >
                  {t('statistics.table.successRate')}
                  <SortIcon field="successRate" sortField={sortField} sortDirection={sortDirection} />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('totalTokens')}
                >
                  {t('statistics.table.tokens')}
                  <SortIcon field="totalTokens" sortField={sortField} sortDirection={sortDirection} />
                </Button>
              </TableHead>
              {section === 'local' && (
                <>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8"
                      onClick={() => handleSort('avgTokensPerSecond')}
                    >
                      {t('statistics.table.avgSpeed')}
                      <SortIcon field="avgTokensPerSecond" sortField={sortField} sortDirection={sortDirection} />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[110px]">{t('statistics.table.avgDuration')}</TableHead>
                </>
              )}
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8"
                  onClick={() => handleSort('averageRounds')}
                >
                  {t('statistics.table.avgRounds')}
                  <SortIcon field="averageRounds" sortField={sortField} sortDirection={sortDirection} />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedStats.map((stats) => (
              <TableRow key={stats.modelKey}>
                <TableCell>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate" title={stats.modelName}>
                      {stats.modelDisplayName}
                    </span>
                    <span className="text-xs text-muted-foreground capitalize truncate">
                      {stats.modelProvider}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-medium cursor-help">{stats.taskCount}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t('statistics.tooltip.completed')}: {stats.completedCount}</p>
                        <p>{t('statistics.tooltip.failed')}: {stats.failedCount}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell>
                  <span
                    className={
                      stats.successRate >= 80
                        ? 'text-green-500'
                        : stats.successRate >= 50
                          ? 'text-amber-500'
                          : 'text-red-500'
                    }
                  >
                    {stats.successRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {section === 'api' ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium cursor-help">{formatTokens(stats.totalTokens)}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <p className="text-blue-400">{t('statistics.tooltip.inputTokens')}: {formatTokens(stats.inputTokens)}</p>
                            <p className="text-purple-400">{t('statistics.tooltip.outputTokens')}: {formatTokens(stats.outputTokens)}</p>
                            {stats.estimatedCost > 0 && (
                              <p className="text-amber-400 border-t border-muted pt-1">
                                {t('statistics.tooltip.estimatedCost')}: {formatCost(stats.estimatedCost)}
                              </p>
                            )}
                            <p className="text-muted-foreground text-[10px] italic">
                              {t('statistics.tooltip.costDisclaimer')}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span>{formatTokens(stats.totalTokens)}</span>
                  )}
                </TableCell>
                {section === 'local' && (
                  <>
                    <TableCell className="text-sm">
                      {stats.avgTokensPerSecond > 0 ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <Zap className="h-3 w-3" />
                          {Math.round(stats.avgTokensPerSecond)} tok/s
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {stats.avgDurationMs > 0 ? (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(stats.avgDurationMs)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell className="text-sm">{stats.averageRounds.toFixed(1)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          {t('statistics.pagination.modelsTotal', { count: sortedStats.length })}
        </div>
        <div className="flex items-center gap-6 lg:gap-8">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{t('tasks.pagination.rowsPerPage')}</p>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => {
                setRowsPerPage(Number(value))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={String(rowsPerPage)} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page info */}
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            {t('tasks.pagination.pageOf', { current: currentPage, total: totalPages || 1 })}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">{t('tasks.pagination.goToFirst')}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">{t('tasks.pagination.goToPrevious')}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">{t('tasks.pagination.goToNext')}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">{t('tasks.pagination.goToLast')}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

