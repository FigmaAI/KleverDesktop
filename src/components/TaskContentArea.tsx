import { useMemo, useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  FolderKanban,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  PlusCircle,
  Check,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { Badge } from '@/components/ui/badge'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { getTaskStatusConfig } from '@/lib/task-status'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BlurFade } from '@/components/magicui/blur-fade'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Project, Task, TaskMetrics } from '@/types/project'
import { cn } from '@/lib/utils'

interface TaskContentAreaProps {
  project: Project | null
  onTaskClick: (task: Task) => void
  onCreateTask: () => void
  onProjectsChange: () => void
  focusArea?: 'sidebar' | 'content'
}

type SortField = 'status' | 'createdAt'
type SortDirection = 'asc' | 'desc'

// Sort icon component - declared outside to avoid recreating during render
function SortIcon({
  field,
  sortField,
  sortDirection
}: {
  field: SortField
  sortField: SortField
  sortDirection: SortDirection
}) {
  if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4" />
  return sortDirection === 'asc'
    ? <ArrowUp className="ml-2 h-4 w-4" />
    : <ArrowDown className="ml-2 h-4 w-4" />
}

export function TaskContentArea({
  project,
  onTaskClick,
  onCreateTask,
  onProjectsChange,
  focusArea = 'content',
}: TaskContentAreaProps) {
  const { t } = useTranslation()
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0)

  // Filter state
  const [statusFilter, setStatusFilter] = useState<Set<Task['status']>>(new Set())

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Real-time task progress metrics (keyed by taskId)
  const [liveMetrics, setLiveMetrics] = useState<Map<string, TaskMetrics>>(new Map())

  const handleDeleteTask = useCallback(async (task: Task) => {
    if (!project) return
    if (!confirm(`Are you sure you want to delete "${task.name || task.goal}"?`)) return

    try {
      const result = await window.electronAPI.taskDelete(project.id, task.id)
      if (result.success) {
        onProjectsChange()
      } else {
        alert(result.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }, [project, onProjectsChange])

  const handleStopTask = useCallback(async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation() // Prevent row click
    if (!project) return

    try {
      const result = await window.electronAPI.taskStop(project.id, task.id)
      if (result.success) {
        onProjectsChange()
      } else {
        alert(result.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }, [project, onProjectsChange])


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Filter and sort tasks
  const sortedTasks = useMemo(() => {
    if (!project) return []

    // Apply status filter
    let filtered = [...project.tasks]
    if (statusFilter.size > 0) {
      filtered = filtered.filter(task => statusFilter.has(task.status))
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'status':
          comparison = getTaskStatusConfig(a.status).priority - getTaskStatusConfig(b.status).priority
          break
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [project, sortField, sortDirection, statusFilter])

  // Status options for filter
  const statusOptions: { value: Task['status']; labelKey: string; icon: React.ElementType }[] = [
    { value: 'pending', labelKey: 'tasks.status.scheduled', icon: Clock },
    { value: 'running', labelKey: 'tasks.status.running', icon: Play },
    { value: 'completed', labelKey: 'tasks.status.finished', icon: CheckCircle },
    { value: 'failed', labelKey: 'tasks.status.error', icon: AlertCircle },
    { value: 'cancelled', labelKey: 'tasks.status.stopped', icon: XCircle },
  ]

  // Get status counts for filter badges
  const statusCounts = useMemo(() => {
    if (!project) return new Map<Task['status'], number>()
    const counts = new Map<Task['status'], number>()
    project.tasks.forEach(task => {
      counts.set(task.status, (counts.get(task.status) || 0) + 1)
    })
    return counts
  }, [project])

  // Pagination
  const totalPages = Math.ceil(sortedTasks.length / rowsPerPage)
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage
    return sortedTasks.slice(startIndex, startIndex + rowsPerPage)
  }, [sortedTasks, currentPage, rowsPerPage])

  // Keyboard navigation for task list (only when focused on content area)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Only handle keyboard when focus is on content area
      if (focusArea !== 'content') return
      if (sortedTasks.length === 0) return

      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).closest('[role="dialog"]')
      ) {
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedTaskIndex((prev) => Math.min(prev + 1, sortedTasks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedTaskIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && sortedTasks[selectedTaskIndex]) {
        e.preventDefault()
        onTaskClick(sortedTasks[selectedTaskIndex])
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sortedTasks[selectedTaskIndex]) {
        // Delete selected task
        e.preventDefault()
        const task = sortedTasks[selectedTaskIndex]
        if (task.status !== 'running') {
          handleDeleteTask(task)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedTasks, selectedTaskIndex, onTaskClick, focusArea, handleDeleteTask])

  // Ensure selectedTaskIndex is always valid (bounded to list length)
  const validSelectedIndex = useMemo(() =>
    Math.min(selectedTaskIndex, Math.max(0, sortedTasks.length - 1)),
    [selectedTaskIndex, sortedTasks.length]
  )

  // Subscribe to task progress events for real-time updates
  useEffect(() => {
    const projectId = project?.id
    const handleProgress = (data: { projectId: string; taskId: string; metrics: TaskMetrics }) => {
      // Only update if this project matches
      if (projectId && data.projectId === projectId) {
        setLiveMetrics(prev => {
          const newMap = new Map(prev)
          newMap.set(data.taskId, data.metrics)
          return newMap
        })
      }
    }

    const cleanup = window.electronAPI.onTaskProgress(handleProgress)

    return cleanup
  }, [project?.id])

  // Detect platform for keyboard shortcuts
  const isMac = typeof window !== 'undefined' && window.navigator.platform.includes('Mac')
  const modKey = isMac ? '⌘' : 'Ctrl'

  // No project selected - show welcome screen with keyboard shortcuts
  if (!project) {
    const shortcuts = [
      {
        categoryKey: 'keyboard.navigation', items: [
          { keys: [modKey, '1'], descriptionKey: 'keyboard.goToProjects' },
          { keys: [modKey, '2'], descriptionKey: 'keyboard.goToScheduledTasks' },
          { keys: [modKey, '3'], descriptionKey: 'keyboard.goToStatistics' },
          { keys: [modKey, ','], descriptionKey: 'keyboard.goToSettings' },
          { keys: ['Esc'], descriptionKey: 'keyboard.goBack' },
        ]
      },
      {
        categoryKey: 'keyboard.actions', items: [
          { keys: [modKey, 'N'], descriptionKey: 'keyboard.newProject' },
          { keys: [modKey, 'T'], descriptionKey: 'keyboard.newTask' },
          { keys: [modKey, 'K'], descriptionKey: 'keyboard.search' },
          { keys: [modKey, 'S'], descriptionKey: 'keyboard.saveSettings' },
        ]
      },
      {
        categoryKey: 'keyboard.view', items: [
          { keys: ['Ctrl', 'Shift', '`'], descriptionKey: 'keyboard.toggleTerminal' },
          { keys: [modKey, '\\'], descriptionKey: 'keyboard.toggleTheme' },
          { keys: [modKey, 'G'], descriptionKey: 'keyboard.openGitHub' },
        ]
      },
      {
        categoryKey: 'keyboard.listNavigation', items: [
          { keys: ['↑', '↓'], descriptionKey: 'keyboard.navigateItems' },
          { keys: ['Enter'], descriptionKey: 'keyboard.selectItem' },
          { keys: ['Delete'], descriptionKey: 'keyboard.deleteItem' },
        ]
      },
    ]

    return (
      <div className="flex h-full flex-col items-center justify-center p-8 overflow-auto">
        <BlurFade delay={0.1}>
          <div className="flex flex-col items-center justify-center text-center max-w-2xl">
            <div className="mb-6 rounded-full bg-primary/10 p-6">
              <FolderKanban className="h-12 w-12 text-primary" />
            </div>
            <h2 className="mb-2 text-2xl font-semibold">{t('projects.selectProject')}</h2>
            <p className="mb-8 text-muted-foreground">
              {t('projects.selectProjectDesc')}
            </p>

            {/* Keyboard Shortcuts */}
            <div className="w-full rounded-lg border bg-card p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">{t('keyboard.title')}</h3>
              <div className="grid grid-cols-2 gap-6 text-left">
                {shortcuts.map((section) => (
                  <div key={section.categoryKey}>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">{t(section.categoryKey)}</h4>
                    <div className="space-y-2">
                      {section.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-foreground">{t(item.descriptionKey)}</span>
                          <div className="flex items-center gap-0.5">
                            {item.keys.map((key, keyIdx) => (
                              <kbd
                                key={keyIdx}
                                className="inline-flex h-5 min-w-[20px] select-none items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </BlurFade>
      </div>
    )
  }

  // Project selected - show task table
  return (
    <div className="flex h-full flex-col p-6">
      {project.tasks.length === 0 ? (
        <BlurFade delay={0.2}>
          <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">{t('tasks.empty')}</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              {t('tasks.emptyDesc')}
            </p>
            <RainbowButton onClick={onCreateTask}>
              <Plus className="h-4 w-4" />
              {t('tasks.addTask')}
              <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">{modKey}</span>
                <span className="text-xs">T</span>
              </kbd>
            </RainbowButton>
          </div>
        </BlurFade>
      ) : (
        <>
          {/* Toolbar with filters and Add Task */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* Status Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 border-dashed">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t('tasks.filter.status')}
                    {statusFilter.size > 0 && (
                      <>
                        <Separator orientation="vertical" className="mx-2 h-4" />
                        <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                          {statusFilter.size}
                        </Badge>
                        <div className="hidden space-x-1 lg:flex">
                          {statusFilter.size > 2 ? (
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                              {statusFilter.size} {t('tasks.filter.selected')}
                            </Badge>
                          ) : (
                            Array.from(statusFilter).map((status) => {
                              const option = statusOptions.find(o => o.value === status)
                              return (
                                <Badge key={status} variant="secondary" className="rounded-sm px-1 font-normal">
                                  {option ? t(option.labelKey) : ''}
                                </Badge>
                              )
                            })
                          )}
                        </div>
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('tasks.filter.status')} />
                    <CommandList>
                      <CommandEmpty>{t('tasks.filter.noResults')}</CommandEmpty>
                      <CommandGroup>
                        {statusOptions.map((option) => {
                          const isSelected = statusFilter.has(option.value)
                          const count = statusCounts.get(option.value) || 0
                          return (
                            <CommandItem
                              key={option.value}
                              onSelect={() => {
                                const newFilter = new Set(statusFilter)
                                if (isSelected) {
                                  newFilter.delete(option.value)
                                } else {
                                  newFilter.add(option.value)
                                }
                                setStatusFilter(newFilter)
                                setCurrentPage(1) // Reset pagination when filter changes
                              }}
                            >
                              <div
                                className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}
                              >
                                <Check className="h-4 w-4" />
                              </div>
                              <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                              <span>{t(option.labelKey)}</span>
                              {count > 0 && (
                                <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                                  {count}
                                </span>
                              )}
                            </CommandItem>
                          )
                        })}
                      </CommandGroup>
                      {statusFilter.size > 0 && (
                        <>
                          <CommandSeparator />
                          <CommandGroup>
                            <CommandItem
                              onSelect={() => setStatusFilter(new Set())}
                              className="justify-center text-center"
                            >
                              {t('tasks.filter.clearFilters')}
                            </CommandItem>
                          </CommandGroup>
                        </>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Clear all filters button */}
              {statusFilter.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 lg:px-3"
                  onClick={() => setStatusFilter(new Set())}
                >
                  {t('tasks.filter.reset')}
                  <XCircle className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>

            <RainbowButton onClick={onCreateTask} size="sm">
              <Plus className="h-4 w-4" />
              {t('tasks.addTask')}
              <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50">
                <span className="text-xs">{modKey}</span>
                <span className="text-xs">T</span>
              </kbd>
            </RainbowButton>
          </div>

          {/* Task Table */}
          <div className="rounded-md border flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[300px]">{t('tasks.table.task')}</TableHead>
                  <TableHead className="w-[120px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('status')}
                    >
                      {t('tasks.table.status')}
                      <SortIcon field="status" sortField={sortField} sortDirection={sortDirection} />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[160px]">{t('tasks.table.progress')}</TableHead>
                  <TableHead className="w-[180px]">{t('tasks.table.model')}</TableHead>
                  <TableHead className="w-[100px]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8 data-[state=open]:bg-accent"
                      onClick={() => handleSort('createdAt')}
                    >
                      {t('tasks.table.date')}
                      <SortIcon field="createdAt" sortField={sortField} sortDirection={sortDirection} />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.map((task, index) => {
                  // Calculate actual index for keyboard navigation
                  const actualIndex = (currentPage - 1) * rowsPerPage + index
                  const isSelected = actualIndex === validSelectedIndex

                  return (
                    <TableRow
                      key={task.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isSelected && 'bg-muted/50'
                      )}
                      onClick={() => onTaskClick(task)}
                    >
                      <TableCell>
                        <span className="font-medium line-clamp-1">
                          {task.goal || task.description || t('tasks.noDescription')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <TaskStatusBadge
                          status={task.status}
                          showStopOnHover={task.status === 'running'}
                          onStop={(e) => handleStopTask(e, task)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(() => {
                          // Use live metrics for running tasks, otherwise use stored metrics
                          const metrics = task.status === 'running'
                            ? liveMetrics.get(task.id) || task.metrics
                            : task.metrics

                          if (!metrics?.rounds) return '-'

                          const roundsText = metrics.maxRounds
                            ? `${metrics.rounds}/${metrics.maxRounds}`
                            : `${metrics.rounds}`

                          // Determine if this is a local model
                          const isLocal = task.modelProvider === 'ollama' || metrics.isLocalModel

                          // Format secondary metric based on model type
                          let secondaryMetric: React.ReactNode = null

                          if (isLocal) {
                            // For local models: show "Local" badge or execution speed
                            if (metrics.tokensPerSecond) {
                              secondaryMetric = (
                                <span className="text-emerald-500 flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {metrics.tokensPerSecond.toLocaleString()} tok/s
                                </span>
                              )
                            } else if (metrics.durationMs) {
                              const seconds = (metrics.durationMs / 1000).toFixed(1)
                              secondaryMetric = (
                                <span className="text-emerald-500 flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {seconds}s
                                </span>
                              )
                            } else {
                              secondaryMetric = (
                                <span className="text-emerald-500 flex items-center gap-1">
                                  <Zap className="h-3 w-3" />
                                  {t('tasks.table.local')}
                                </span>
                              )
                            }
                          } else {
                            // For API models: show input/output tokens
                            if (metrics.inputTokens !== undefined && metrics.outputTokens !== undefined) {
                              secondaryMetric = (
                                <span className="text-blue-500 text-xs">
                                  {metrics.inputTokens.toLocaleString()} in / {metrics.outputTokens.toLocaleString()} out
                                </span>
                              )
                            } else if (metrics.tokens) {
                              // Fallback: show total tokens
                              secondaryMetric = (
                                <span className="text-muted-foreground">
                                  {metrics.tokens.toLocaleString()} {t('tasks.table.tokens')}
                                </span>
                              )
                            }
                          }

                          return (
                            <div className="flex flex-col">
                              <span className="font-medium">{roundsText} {t('tasks.table.rounds')}</span>
                              {secondaryMetric}
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {(() => {
                          if (!task.modelName) return '-'
                          // modelName contains full LiteLLM model string (e.g., "openrouter/openai/gpt-4.1-mini")
                          // modelProvider contains the provider ID (e.g., "openrouter")
                          const provider = task.modelProvider || ''
                          // Extract display name from modelName (remove provider prefix if present)
                          let displayName = task.modelName
                          if (provider && task.modelName.startsWith(`${provider}/`)) {
                            displayName = task.modelName.slice(provider.length + 1)
                          }

                          return (
                            <div className="flex flex-col">
                              <span className="font-medium truncate max-w-[160px]" title={displayName}>
                                {displayName}
                              </span>
                              <span className="text-muted-foreground capitalize">{provider}</span>
                            </div>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(task.startedAt || task.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              {t('tasks.pagination.tasksTotal', { count: sortedTasks.length })}
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
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">{t('tasks.pagination.goToPrevious')}</span>
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
        </>
      )}
    </div>
  )
}
