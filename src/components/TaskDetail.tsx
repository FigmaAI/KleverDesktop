import { useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderOpen, RefreshCw, ExternalLink, Loader2, ArrowLeft, Play, StopCircle, Trash2, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScheduleQuickDialog } from '@/components/ScheduleQuickDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { dispatchRun } from '@/lib/start-run'
import { runVersion } from '@/lib/test-case'
import { TaskLog } from '@/components/TaskLog'
import type { Task, Project } from '@/types/project'

interface TaskDetailProps {
  task: Task
  project: Project
  onBack: () => void
  onProjectsChange: () => void
  onRepeat?: () => void
}

function MarkdownImage({ src, alt, baseDir }: { src?: string; alt?: string; baseDir?: string }) {
  const { t } = useTranslation()
  const [image, setImage] = useState<{ key: string; dataUrl?: string; error?: string }>()
  const key = `${baseDir || ''}/${src || ''}`
  const direct = src?.startsWith('data:') || src?.startsWith('http') ? src : undefined
  useEffect(() => {
    let active = true
    if (!src || direct) return
    void window.electronAPI.fileReadImage(src, baseDir).then((result) => {
      if (active) setImage({ key, dataUrl: result.success ? result.dataUrl : undefined, error: result.success ? undefined : result.error || t('report.imageFailed') })
    }).catch((reason) => { if (active) setImage({ key, error: reason instanceof Error ? reason.message : t('report.imageFailed') }) })
    return () => { active = false }
  }, [src, baseDir, direct, key, t])
  if (!src) return null
  const loaded = image?.key === key ? image : undefined
  if (direct || loaded?.dataUrl) return <img src={direct || loaded?.dataUrl} alt={alt} className="max-w-full max-h-[512px] h-auto object-contain" />
  if (loaded?.error) return <span className="inline-block p-4 border border-destructive rounded-md my-4"><span className="block text-sm text-destructive">{loaded.error}</span><span className="block text-xs text-muted-foreground mt-1">{src}</span></span>
  return <span className="inline-flex items-center gap-2 my-4"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm text-muted-foreground">{t('report.loadingImage')}</span></span>
}

export function TaskDetail({ task, project, onBack, onProjectsChange, onRepeat }: TaskDetailProps) {
  const { t } = useTranslation()
  const [report, setReport] = useState<{ key: string; path: string; content: string; error?: string }>()
  const [refresh, setRefresh] = useState(0)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'report' | 'log'>('report')
  const taskName = task.name || task.goal
  const normalized = (task.resultPath || project.workspaceDir).replace(/\\/g, '/')
  const directoryName = normalized.split('/').filter(Boolean).pop() || ''
  const markdownPath = task.resultPath ? `${normalized}/log_report_${directoryName}.md` : `${normalized}/${taskName.replace(/\s+/g, '_')}.md`
  const markdownDir = markdownPath.slice(0, markdownPath.lastIndexOf('/'))
  const key = `${markdownPath}/${task.updatedAt}/${refresh}`
  const displayed = report?.path === markdownPath ? report : undefined
  const content = displayed?.content || ''
  const loading = report?.key !== key
  const reload = useCallback(() => setRefresh((value) => value + 1), [])

  useEffect(() => {
    let active = true
    const load = async () => {
      const exists = await window.electronAPI.fileExists(markdownPath)
      if (!exists.success) throw new Error(exists.error || t('native.reportFailed'))
      if (!exists.exists) return ''
      const read = await window.electronAPI.fileRead(markdownPath)
      if (!read.success) throw new Error(read.error || t('native.reportFailed'))
      return read.content || ''
    }
    void load().then((value) => { if (active) setReport({ key, path: markdownPath, content: value }) }).catch((reason) => {
      if (active) setReport((current) => ({ key, path: markdownPath, content: current?.path === markdownPath ? current.content : '', error: reason instanceof Error ? reason.message : t('native.reportFailed') }))
    })
    return () => { active = false }
  }, [key, markdownPath, t])
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    const updated = (data: { projectId: string; taskId: string }) => {
      if (data.projectId !== project.id || data.taskId !== task.id) return
      if (pending) clearTimeout(pending)
      pending = setTimeout(reload, 200)
    }
    const cleanups = [window.electronAPI.onTaskProgress(updated), window.electronAPI.onTaskRecorded(updated)]
    return () => { cleanups.forEach((cleanup) => cleanup()); if (pending) clearTimeout(pending) }
  }, [project.id, task.id, reload])
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest?.('[role="dialog"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key === 'r') { event.preventDefault(); if (!loading) reload() }
      if (event.key === 'Escape') { event.preventDefault(); onBack() }
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.key === 'Enter' && task.status === 'pending') { event.preventDefault(); setScheduleOpen(true) }
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [loading, reload, onBack, task.status])

  const openPath = async (file: string, requireExists = false) => {
    try {
      if (requireExists) { const exists = await window.electronAPI.fileExists(file); if (!exists.success || !exists.exists) throw new Error(t('report.notReady')) }
      const result = await window.electronAPI.openPath(file)
      if (!result.success) throw new Error(result.error || t('native.reportFailed'))
    } catch (reason) { toast.error(reason instanceof Error ? reason.message : t('native.reportFailed')) }
  }
  const start = async () => {
    setBusy(true)
    try { await dispatchRun(project.id, task, onProjectsChange, { failed: t('native.startFailed'), saved: t('native.savedForLater'), queued: t('tasks.createDialog.taskQueued'), queueDescription: t('tasks.createDialog.taskQueuedDesc') }) }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : t('native.startFailed')) }
    finally { setBusy(false) }
  }
  const stop = async () => {
    setBusy(true)
    try { const result = await window.electronAPI.taskStop(project.id, task.id); if (!result.success) throw new Error(result.error); onProjectsChange() }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : t('native.startFailed')) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!confirm(t('report.deleteConfirm', { name: taskName }))) return
    try { const result = await window.electronAPI.taskDelete(project.id, task.id); if (!result.success) throw new Error(result.error); onProjectsChange(); onBack() }
    catch (reason) { toast.error(reason instanceof Error ? reason.message : t('report.deleteFailed')) }
  }
  const tabKeys = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="tab"]'))
    const focused = buttons.findIndex((button) => button === document.activeElement)
    const current = focused >= 0 ? focused : mode === 'report' ? 0 : 1
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : (current + (event.key === 'ArrowLeft' ? -1 : 1) + 2) % 2
    setMode(next === 0 ? 'report' : 'log')
    buttons[next]?.focus()
  }

  const version = runVersion(task)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
        <div className="flex items-center gap-3"><Button variant="ghost" size="icon" onClick={onBack} aria-label={t('common.back')} className="shrink-0 h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button><div role="tablist" onKeyDown={tabKeys} aria-label={t('report.viewMode')} className="flex rounded-md border bg-muted/50 p-0.5"><Button id="report-tab" role="tab" tabIndex={mode === 'report' ? 0 : -1} aria-selected={mode === 'report'} aria-controls="report-pane" variant={mode === 'report' ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setMode('report')}>{t('report.tabReport')}</Button><Button id="log-tab" role="tab" tabIndex={mode === 'log' ? 0 : -1} aria-selected={mode === 'log'} aria-controls="log-pane" variant={mode === 'log' ? 'secondary' : 'ghost'} size="sm" className="h-7" onClick={() => setMode('log')}>{t('report.tabLog')}</Button></div><div className="flex-1" />
          <TooltipProvider><div className="flex flex-wrap items-center gap-1">
            <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={reload} disabled={loading} aria-label={t('native.refresh')} className="h-8"><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /></Button></TooltipTrigger><TooltipContent side="bottom">{t('native.refresh')} <kbd className="ml-1 text-xs opacity-60">⌘R</kbd></TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => openPath(markdownPath, true)} aria-label={t('report.openEditor')} className="h-8"><ExternalLink className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">{t('report.openEditor')}</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => openPath(task.resultPath || project.workspaceDir)} aria-label={t('report.openFolder')} className="h-8"><FolderOpen className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">{t('report.openFolder')}</TooltipContent></Tooltip>
            <div className="w-px h-6 bg-border mx-1" />
            {task.status === 'pending' && <><Button size="sm" onClick={start} disabled={busy} className="h-8"><Play className="mr-1 h-3 w-3" />{t('tasks.run')}</Button><Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={() => setScheduleOpen(true)} aria-label={t('scheduleDialog.schedule')} className="h-8"><CalendarClock className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">{t('scheduleDialog.schedule')} <kbd className="ml-1 text-xs opacity-60">⌘⌥↵</kbd></TooltipContent></Tooltip></>}
            {task.status === 'running' && <Button size="sm" variant="destructive" onClick={stop} disabled={busy} className="h-8"><StopCircle className="mr-1 h-3 w-3" />{t('tasks.stop')}</Button>}
            {task.status !== 'pending' && task.status !== 'running' && onRepeat && <Button size="sm" onClick={onRepeat} className="h-8"><Play className="mr-1 h-3 w-3" />{t('native.repeatTest')}</Button>}
            <Tooltip><TooltipTrigger asChild><Button size="sm" variant="outline" onClick={remove} disabled={task.status === 'running'} aria-label={t('common.delete')} className="h-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="bottom">{t('common.delete')}</TooltipContent></Tooltip>
          </div></TooltipProvider>
        </div>
      </div>
      <div className="border-b bg-muted/30 px-6 py-2"><div className="flex flex-wrap items-center gap-6 text-sm"><div className="flex items-center gap-2"><span className="text-muted-foreground">{t('report.status')}:</span><span className="font-medium">{t('tasks.status.' + task.status)}</span></div>{version && <div className="flex items-center gap-2"><span className="text-muted-foreground">{t('history.version')}:</span><span className="font-medium">{version}</span></div>}</div></div>
      {mode === 'log' ? <div id="log-pane" role="tabpanel" aria-labelledby="log-tab" className="flex-1 min-h-0"><TaskLog key={task.id} task={task} projectId={project.id} onClose={() => setMode('report')} /></div> : <div id="report-pane" role="tabpanel" aria-labelledby="report-tab" className="flex-1 overflow-auto" data-testid="markdown-report">
        {loading && !content ? <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div> : displayed?.error && !content ? <div className="p-8 text-center"><p className="text-lg text-destructive mb-4">{displayed.error}</p><p className="text-sm text-muted-foreground">{t('report.errorHelp')}</p></div> : content ? <div className="p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h4>,
                  p: ({ children }) => <p className="mb-4 leading-relaxed text-foreground">{children}</p>,
                  ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">{children}</blockquote>,
                  code: ({ className, children }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                    ) : (
                      <code className={`block bg-muted p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono ${className}`}>{children}</code>
                    )
                  },
                  pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg my-4 overflow-x-auto">{children}</pre>,
                  a: ({ children, href }) => <a href={href} className="text-primary underline hover:text-primary/80" onClick={(event) => { if (href?.startsWith('https://')) { event.preventDefault(); void window.electronAPI.openExternal(href) } }}>{children}</a>,
                  table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-border">{children}</table></div>,
                  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                  th: ({ children }) => <th className="border border-border px-4 py-2 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
                  hr: () => <hr className="my-6 border-border" />,
                  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} baseDir={markdownDir} />,
                }}
              >
                {content}
              </ReactMarkdown>
        </div> : <div className="p-8 text-center"><p className="text-lg text-muted-foreground">{t('native.noReport')}</p><p className="text-sm text-muted-foreground mt-2">{task.error || t('native.noReportHelp')}</p></div>}
      </div>}
      <ScheduleQuickDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSchedule={async (date) => { const result = await window.electronAPI.scheduleAdd(project.id, task.id, date.toISOString()); if (!result.success) throw new Error(result.error || t('native.scheduleFailed')); onProjectsChange() }} />
    </div>
  )
}
