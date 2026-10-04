import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { RunDeviceSelect } from '@/components/RunDeviceSelect'
import { AppSourceFields } from '@/components/AppSourceFields'
import { ScheduleQuickDialog } from '@/components/ScheduleQuickDialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validAppSource } from '@/lib/test-case'
import { dispatchRun } from '@/lib/start-run'
import type { ApkSource, Task, TestCase } from '@/types/project'

interface TestRunDialogProps {
  open: boolean
  testCase: TestCase | null
  onClose: () => void
  onRunCreated: (run: Task) => void
  onProjectsChange: () => void
}

export function TestRunDialog({ open, testCase, onClose, onRunCreated, onProjectsChange }: TestRunDialogProps) {
  const { t } = useTranslation()
  const [source, setSource] = useState<ApkSource>({ type: 'installed_package' })
  const [buildLabel, setBuildLabel] = useState('')
  const [deviceSerial, setDeviceSerial] = useState('')
  const [deviceRequired, setDeviceRequired] = useState(false)
  const [loading, setLoading] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const initialized = useRef<string | null>(null)

  useEffect(() => {
    if (!open) { initialized.current = null; return }
    if (!testCase || initialized.current === testCase.id) return
    initialized.current = testCase.id
    setSource(testCase.apkSource || { type: 'installed_package' })
    setBuildLabel('')
    setDeviceSerial('')
    setScheduleOpen(false)
  }, [open, testCase])

  const valid = !!testCase && validAppSource(source) && (!deviceRequired || !!deviceSerial) && !loading
  const create = async (scheduledAt?: Date) => {
    if (!valid || !testCase) return
    setLoading(true)
    let createdRun: Task | undefined
    try {
      const created = await window.electronAPI.testCaseRun(testCase.projectId, testCase.id, { apkSource: source, deviceSerial: deviceSerial || undefined, buildLabel: buildLabel.trim() || undefined, scheduledAt: scheduledAt?.toISOString() })
      if (!created.success || !created.task) throw new Error(created.error || t('native.createFailed'))
      createdRun = created.task
      onRunCreated(createdRun)
      if (!scheduledAt) await dispatchRun(testCase.projectId, createdRun, onProjectsChange, {
        failed: t('native.startFailed'), saved: t('native.savedForLater'), queued: t('tasks.createDialog.taskQueued'), queueDescription: t('tasks.createDialog.taskQueuedDesc'),
      })
      onProjectsChange()
      setScheduleOpen(false)
      onClose()
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : t('native.startFailed'), { description: createdRun ? t('native.savedForLater') : undefined })
      if (createdRun) { setScheduleOpen(false); onClose() }
      throw reason
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && !loading && onClose()}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{t('history.runCourse', { name: testCase?.name })}</DialogTitle><DialogDescription>{t('history.runDescription')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <AppSourceFields source={source} onChange={setSource} idPrefix="run" disabled={loading} />
            <RunDeviceSelect open={open} value={deviceSerial} onChange={setDeviceSerial} onRequiredChange={setDeviceRequired} id="run-device" disabled={loading} />
            <div className="space-y-2"><Label htmlFor="buildLabel">{t('history.buildLabel')}</Label><Input id="buildLabel" disabled={loading} value={buildLabel} onChange={(event) => setBuildLabel(event.target.value)} placeholder={t('history.buildLabelPlaceholder')} /><p className="text-xs text-muted-foreground">{t('history.versionDetected')}</p></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button><Button variant="outline" disabled={!valid} onClick={() => setScheduleOpen(true)}><CalendarClock className="mr-2 h-4 w-4" />{t('scheduleDialog.schedule')}</Button><Button disabled={!valid} onClick={() => void create().catch(() => {})}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('tasks.run')}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
      <ScheduleQuickDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSchedule={create} />
    </>
  )
}
