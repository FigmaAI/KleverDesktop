import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FolderOpen } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { Project } from '@/types/project'

interface ProjectCreateDialogProps {
  open: boolean
  onClose: () => void
  onProjectCreated?: (project: Project) => void
}

export function ProjectCreateDialog({ open, onClose, onProjectCreated }: ProjectCreateDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [workspaceDir, setWorkspaceDir] = useState('')

  const close = () => {
    if (loading) return
    setName('')
    setWorkspaceDir('')
    onClose()
  }

  const create = async () => {
    if (!name.trim() || loading) return
    setLoading(true)
    try {
      const result = await window.electronAPI.projectCreate({ name: name.trim(), platform: 'android', workspaceDir: workspaceDir || undefined })
      if (!result.success || !result.project) throw new Error(result.error || t('projects.createDialog.createFailed'))
      onProjectCreated?.(result.project)
      setName('')
      setWorkspaceDir('')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('projects.createDialog.createFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault()
          void create()
        }
      }}>
        <DialogHeader>
          <DialogTitle>{t('projects.createDialog.title')}</DialogTitle>
          <DialogDescription>{t('native.projectDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="projectName">{t('projects.createDialog.projectName')}</Label>
            <Input id="projectName" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder={t('projects.createDialog.projectNamePlaceholder')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workspaceDir">{t('native.resultsFolder')}</Label>
            <div className="flex gap-2">
              <Input id="workspaceDir" readOnly value={workspaceDir} placeholder={t('projects.createDialog.workspaceDirPlaceholder')} />
              <Button variant="outline" onClick={async () => {
                const path = await window.electronAPI.showFolderSelectDialog()
                if (path) setWorkspaceDir(path)
              }} aria-label={t('projects.createDialog.browse')}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={close} disabled={loading}>{t('common.cancel')}</Button>
            <Button onClick={create} disabled={!name.trim() || loading}>{loading ? t('projects.createDialog.creating') : t('common.create')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
