import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FolderKanban, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import { getTaskStatusConfig } from '@/lib/task-status'
import type { Project, Task, TaskMetrics, TaskStatus } from '@/types/project'

interface TaskContentAreaProps {
  project: Project | null
  onTaskClick: (task: Task) => void
  onCreateTask: () => void
  onCreateProject: () => void
  onOpenSettings: () => void
  onProjectsChange: () => void
  focusArea?: 'sidebar' | 'content'
}

type SortField = 'status' | 'createdAt'
const statuses: TaskStatus[] = ['pending', 'running', 'completed', 'failed', 'cancelled']

function taskDate(task: Task): number {
  const timestamp = Date.parse(task.startedAt || task.createdAt)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function duration(task: Task, metrics?: TaskMetrics): number | undefined {
  if (metrics?.durationMs !== undefined && Number.isFinite(metrics.durationMs)) return Math.max(0, metrics.durationMs)
  if (!task.startedAt || !task.completedAt) return undefined
  const elapsed = Date.parse(task.completedAt) - Date.parse(task.startedAt)
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : undefined
}

export function TaskContentArea({ project, onTaskClick, onCreateTask, onCreateProject, onOpenSettings, onProjectsChange, focusArea = 'content' }: TaskContentAreaProps) {
  const { t, i18n } = useTranslation()
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [liveMetrics, setLiveMetrics] = useState<Record<string, TaskMetrics>>({})
  const [stoppingTaskId, setStoppingTaskId] = useState<string>()
  const [actionError, setActionError] = useState<string>()
  const taskButtons = useRef(new Map<string, HTMLButtonElement>())
  const locale = (i18n.resolvedLanguage || i18n.language || 'en').replace('_', '-')

  const sortedTasks = useMemo(() => {
    const tasks = (project?.tasks || []).filter((task) => statusFilter === 'all' || task.status === statusFilter)
    return tasks.sort((left, right) => {
      const difference = sortField === 'status'
        ? getTaskStatusConfig(left.status).priority - getTaskStatusConfig(right.status).priority
        : taskDate(left) - taskDate(right)
      return (sortDirection === 'asc' ? difference : -difference) || taskDate(right) - taskDate(left)
    })
  }, [project?.tasks, statusFilter, sortField, sortDirection])

  const totalPages = Math.max(1, Math.ceil(sortedTasks.length / rowsPerPage))
  const page = Math.min(currentPage, totalPages)
  const paginatedTasks = sortedTasks.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  useEffect(() => {
    const projectId = project?.id
    if (!projectId) return
    return window.electronAPI.onTaskProgress((data) => {
      if (data.projectId === projectId && data.metrics) {
        setLiveMetrics((previous) => ({ ...previous, [data.taskId]: data.metrics }))
      }
    })
  }, [project?.id])

  function sortBy(field: SortField) {
    setSortDirection(sortField === field && sortDirection === 'desc' ? 'asc' : 'desc')
    setSortField(field)
    setCurrentPage(1)
  }

  function navigateTasks(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (focusArea !== 'content' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    let nextIndex: number
    switch (event.key) {
      case 'ArrowDown': nextIndex = Math.min(index + 1, paginatedTasks.length - 1); break
      case 'ArrowUp': nextIndex = Math.max(index - 1, 0); break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = paginatedTasks.length - 1; break
      default: return
    }
    event.preventDefault()
    taskButtons.current.get(paginatedTasks[nextIndex].id)?.focus()
  }

  async function stopTask(task: Task) {
    if (!project) return
    setStoppingTaskId(task.id)
    setActionError(undefined)
    try {
      const result = await window.electronAPI.taskStop(project.id, task.id)
      if (result.success) onProjectsChange()
      else setActionError(result.error || t('tasks.stopFailed'))
    } catch {
      setActionError(t('tasks.stopFailed'))
    } finally {
      setStoppingTaskId(undefined)
    }
  }

  if (!project) return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <FolderKanban className="mb-4 h-10 w-10 text-primary" aria-hidden="true" />
      <h1 className="mb-2 text-2xl font-semibold">{t('native.appTagline')}</h1>
      <p className="max-w-md text-muted-foreground">{t('native.projectDescription')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onCreateProject}><Plus aria-hidden="true" />{t('sidebar.newProject')}</Button>
        <Button variant="outline" onClick={onOpenSettings}>{t('native.openSettings')}</Button>
      </div>
      <p className="mt-6 max-w-md text-sm text-muted-foreground">{t('native.settingsIntro')}</p>
    </div>
  )

  const sortIcon = (field: SortField) => {
    const Icon = sortField !== field ? ArrowUpDown : sortDirection === 'asc' ? ArrowUp : ArrowDown
    return <Icon aria-hidden="true" />
  }
  const ariaSort = (field: SortField) => sortField !== field ? 'none' : sortDirection === 'asc' ? 'ascending' : 'descending'

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {project.tasks.length > 0 ? (
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as TaskStatus | 'all'); setCurrentPage(1) }}>
            <SelectTrigger className="w-[180px]" aria-label={t('tasks.filter.status')}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('tasks.filter.allStatuses')}</SelectItem>
              {statuses.map((status) => <SelectItem key={status} value={status}>{t('tasks.status.' + status)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : <span />}
        <Button onClick={onCreateTask}><Plus aria-hidden="true" />{t('tasks.addTask')}</Button>
      </div>
      {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}

      {project.tasks.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-md border p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold">{t('tasks.empty')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('tasks.emptyDesc')}</p>
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table aria-label={project.name}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="min-w-[280px]">{t('tasks.table.task')}</TableHead>
                  <TableHead scope="col" className="w-[180px]" aria-sort={ariaSort('status')}>
                    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => sortBy('status')}>{t('tasks.table.status')}{sortIcon('status')}</Button>
                  </TableHead>
                  <TableHead scope="col" className="w-[150px]">{t('tasks.table.progress')}</TableHead>
                  <TableHead scope="col" className="w-[130px]" aria-sort={ariaSort('createdAt')}>
                    <Button variant="ghost" size="sm" className="-ml-3" onClick={() => sortBy('createdAt')}>{t('tasks.table.date')}{sortIcon('createdAt')}</Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTasks.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{t('tasks.filter.noResults')}</TableCell></TableRow>
                ) : paginatedTasks.map((task, index) => {
                  const metrics = task.status === 'running' ? liveMetrics[task.id] || task.metrics : task.metrics
                  const elapsed = duration(task, metrics)
                  const goal = task.goal || task.description || task.name || t('tasks.noDescription')
                  const maxRounds = metrics?.maxRounds || task.maxRounds
                  return (
                    <TableRow key={task.id} className="cursor-pointer focus-within:bg-muted/50" onClick={() => onTaskClick(task)}>
                      <TableCell>
                        <Button
                          variant="link"
                          className="h-auto w-full justify-start whitespace-normal p-0 text-left text-foreground"
                          title={goal}
                          ref={(element) => { if (element) taskButtons.current.set(task.id, element); else taskButtons.current.delete(task.id) }}
                          onClick={(event) => { event.stopPropagation(); onTaskClick(task) }}
                          onKeyDown={(event) => navigateTasks(event, index)}
                        ><span className="line-clamp-2">{goal}</span></Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TaskStatusBadge status={task.status} />
                          {task.status === 'running' && <Button variant="ghost" size="sm" aria-label={`${t('tasks.stop')}: ${goal}`} disabled={stoppingTaskId === task.id} onClick={(event) => { event.stopPropagation(); void stopTask(task) }}>{t('tasks.stop')}</Button>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {metrics?.rounds !== undefined || elapsed !== undefined ? (
                          <div className="flex flex-col gap-1">
                            {metrics?.rounds !== undefined && <span>{metrics.rounds}{maxRounds ? `/${maxRounds}` : ''} {t('tasks.table.rounds')}</span>}
                            {elapsed !== undefined && <span>{new Intl.NumberFormat(locale, { style: 'unit', unit: elapsed < 60000 ? 'second' : 'minute', unitDisplay: 'narrow', maximumFractionDigits: 1 }).format(elapsed / (elapsed < 60000 ? 1000 : 60000))}</span>}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {taskDate(task) ? <time dateTime={task.startedAt || task.createdAt} title={new Date(taskDate(task)).toLocaleString(locale)}>{new Date(taskDate(task)).toLocaleDateString(locale)}</time> : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">{t('tasks.pagination.tasksTotal', { count: sortedTasks.length })}</p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('tasks.pagination.rowsPerPage')}</span>
                <Select value={String(rowsPerPage)} onValueChange={(value) => { setRowsPerPage(Number(value)); setCurrentPage(1) }}>
                  <SelectTrigger className="h-8 w-[70px]" aria-label={t('tasks.pagination.rowsPerPage')}><SelectValue /></SelectTrigger>
                  <SelectContent side="top">{[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <span>{t('tasks.pagination.pageOf', { current: page, total: totalPages })}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setCurrentPage(1)} aria-label={t('tasks.pagination.goToFirst')}><ChevronsLeft aria-hidden="true" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setCurrentPage(page - 1)} aria-label={t('tasks.pagination.goToPrevious')}><ChevronLeft aria-hidden="true" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setCurrentPage(page + 1)} aria-label={t('tasks.pagination.goToNext')}><ChevronRight aria-hidden="true" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setCurrentPage(totalPages)} aria-label={t('tasks.pagination.goToLast')}><ChevronsRight aria-hidden="true" /></Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
