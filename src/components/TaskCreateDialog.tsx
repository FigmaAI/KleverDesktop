import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { RunDeviceSelect } from '@/components/RunDeviceSelect'
import { AppSourceFields } from '@/components/AppSourceFields'
import { ScheduleQuickDialog } from '@/components/ScheduleQuickDialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { validAppSource } from '@/lib/test-case'
import { dispatchRun } from '@/lib/start-run'
import type { ApkSource, Project, Task, TestCase } from '@/types/project'

interface TaskCreateDialogProps {
  open: boolean
  onClose: () => void
  projects: Project[]
  selectedProjectId?: string
  testCase?: TestCase
  onCaseSaved: (testCase: TestCase) => void
  onRunCreated: (run: Task) => void
  onProjectsChange: () => void
  onCreateProject?: () => void
}

export function TaskCreateDialog({ open, onClose, projects, selectedProjectId, testCase, onCaseSaved, onRunCreated, onProjectsChange, onCreateProject }: TaskCreateDialogProps) {
  const { t } = useTranslation()
  const [projectId, setProjectId] = useState('')
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [source, setSource] = useState<ApkSource>({ type: 'installed_package' })
  const [deviceSerial, setDeviceSerial] = useState('')
  const [deviceRequired, setDeviceRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const initialized = useRef<string | null>(null)

  useEffect(() => {
    if (!open) { initialized.current = null; return }
    const key = testCase?.id || 'new'
    if (initialized.current === key) return
    initialized.current = key
    const initialProjectId = testCase?.projectId || selectedProjectId || projects[0]?.id || ''
    const project = projects.find((item) => item.id === initialProjectId)
    setProjectId(initialProjectId)
    setName(testCase?.name || '')
    setGoal(testCase?.goal || '')
    setSource(testCase?.apkSource || project?.lastApkSource || { type: 'installed_package' })
    setScheduleOpen(false)
    setDeviceSerial('')
  }, [open, testCase, selectedProjectId, projects])

  const valid = !!projectId && !!goal.trim() && validAppSource(source) && !loading
  const canRun = valid && (!deviceRequired || !!deviceSerial)
  const close = () => { if (!loading) onClose() }

  const save = async (action: 'save' | 'run' | 'schedule', scheduledAt?: Date) => {
    if (!valid || (action !== 'save' && !canRun)) return
    setLoading(true)
    let savedCase: TestCase | undefined
    try {
      const input = { name: name.trim() || goal.trim().split('\n')[0].slice(0, 80), goal: goal.trim(), apkSource: source }
      const saved = testCase
        ? await window.electronAPI.testCaseUpdate(projectId, testCase.id, input)
        : await window.electronAPI.testCaseCreate({ projectId, ...input })
      if (!saved.success || !saved.testCase) throw new Error(saved.error || t('native.createFailed'))
      savedCase = saved.testCase
      onCaseSaved(savedCase)
      if (!testCase || action !== 'save') {
        const created = await window.electronAPI.testCaseRun(projectId, savedCase.id, { deviceSerial: deviceSerial || undefined, scheduledAt: scheduledAt?.toISOString() })
        if (!created.success || !created.task) throw new Error(created.error || t('native.createFailed'))
        onRunCreated(created.task)
        if (action === 'run') await dispatchRun(projectId, created.task, onProjectsChange, {
          failed: t('native.startFailed'), saved: t('native.savedForLater'), queued: t('tasks.createDialog.taskQueued'), queueDescription: t('tasks.createDialog.taskQueuedDesc'),
        })
      }
      onProjectsChange()
      setScheduleOpen(false)
      onClose()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t('native.createFailed'), { description: savedCase ? t('history.courseSaved') : undefined })
      if (savedCase) { setScheduleOpen(false); onClose() }
      throw reason
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{t(testCase ? 'history.editCourse' : 'history.newCourse')}</DialogTitle><DialogDescription>{t('history.courseDescription')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="courseProject">{t('tasks.createDialog.project')}</Label><Select value={projectId} disabled={!!testCase || loading} onValueChange={(value) => {
              if (value === '__create_new__') onCreateProject?.()
              else { setProjectId(value); setSource(projects.find((item) => item.id === value)?.lastApkSource || { type: 'installed_package' }) }
            }}><SelectTrigger id="courseProject"><SelectValue placeholder={t('tasks.createDialog.selectProject')} /></SelectTrigger><SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}{onCreateProject && <SelectItem value="__create_new__"><span className="flex items-center gap-2"><Plus className="h-4 w-4" />{t('tasks.createDialog.createNewProject')}</span></SelectItem>}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="courseName">{t('history.courseName')}</Label><Input id="courseName" autoFocus disabled={loading} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('history.courseNamePlaceholder')} /></div>
            <AppSourceFields source={source} onChange={setSource} idPrefix="course" disabled={loading} />
            {!testCase && <RunDeviceSelect open={open} value={deviceSerial} onChange={setDeviceSerial} onRequiredChange={setDeviceRequired} id="course-device" disabled={loading} />}
            <div className="space-y-2"><Label htmlFor="courseGoal">{t('history.courseGoal')}</Label><Textarea id="courseGoal" disabled={loading} value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} placeholder={t('history.courseGoalPlaceholder')} /></div>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={close} disabled={loading}>{t('common.cancel')}</Button>{!testCase && <Button variant="outline" disabled={!canRun} onClick={() => setScheduleOpen(true)}><CalendarClock className="mr-2 h-4 w-4" />{t('scheduleDialog.schedule')}</Button>}<Button disabled={!valid} onClick={() => void save('save').catch(() => {})}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('native.saveTest')}</Button>{!testCase && <Button disabled={!canRun} onClick={() => void save('run').catch(() => {})}>{t('history.saveAndRun')}</Button>}</div>
          </div>
        </DialogContent>
      </Dialog>
      <ScheduleQuickDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSchedule={(date) => save('schedule', date)} />
    </>
  )
}
