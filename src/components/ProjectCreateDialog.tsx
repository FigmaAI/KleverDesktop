import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FolderOpen, Smartphone, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Platform, Project } from '../types/project'
import { Analytics } from '@/utils/analytics'

interface ProjectCreateDialogProps {
  open: boolean
  onClose: () => void
  onProjectCreated?: (project: Project) => void
}

export function ProjectCreateDialog({
  open,
  onClose,
  onProjectCreated,
}: ProjectCreateDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [platform, setPlatform] = useState<Platform>('android')
  const [projectName, setProjectName] = useState('')
  const [workspaceDir, setWorkspaceDir] = useState('')
  
  const canCreate = () => {
    return projectName.trim() !== ''
  }

  const handleSelectWorkspace = async () => {
    const path = await window.electronAPI.showFolderSelectDialog()
    if (path) {
      setWorkspaceDir(path)
    }
  }

  const handleCreate = async () => {
    if (!canCreate()) return

    setLoading(true)
    try {
      const result = await window.electronAPI.projectCreate({
        name: projectName,
        platform,
        workspaceDir: workspaceDir || undefined,
      })

      if (result.success && result.project) {
        // Track project creation
        Analytics.projectCreated(platform, !!workspaceDir);

        const message = result.message || `Project created at ${result.project.workspaceDir}`
        toast.success(t('projects.createDialog.projectCreated'), { description: message })
        onProjectCreated?.(result.project)
        handleClose()
      } else {
        toast.error(t('common.error'), { description: `${t('projects.createDialog.createFailed')}: ${result.error}` })
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error(t('common.error'), { description: t('projects.createDialog.createFailedRetry') })
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleCreate()
    }
  }

  const handleClose = () => {
    setPlatform('android')
    setProjectName('')
    setWorkspaceDir('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl" showClose={false} onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>{t('projects.createDialog.title')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('projects.createDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section 1: Project Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('projects.createDialog.projectDetails')}</h3>

            <div className="space-y-2">
              <Label htmlFor="projectName">
                {t('projects.createDialog.projectName')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                placeholder={t('projects.createDialog.projectNamePlaceholder')}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <p className="text-sm text-muted-foreground">
                {t('projects.createDialog.projectNameDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceDir">{t('projects.createDialog.workspaceDir')}</Label>
              <div className="flex gap-2">
                <Input
                  id="workspaceDir"
                  readOnly
                  value={workspaceDir}
                  placeholder={t('projects.createDialog.workspaceDirPlaceholder')}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSelectWorkspace}
                  className="shrink-0"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('projects.createDialog.browse')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('projects.createDialog.workspaceDirDesc')}
              </p>
            </div>
          </div>

          {/* Section 2: Platform Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">{t('projects.createDialog.selectPlatform')}</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Android Platform Card */}
              <Card
                className={cn(
                  'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg',
                  platform === 'android'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setPlatform('android')}
              >
                <CardContent className="flex flex-col items-center justify-center space-y-3 p-8">
                  <div
                    className={cn(
                      'rounded-full p-4',
                      platform === 'android' ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Smartphone
                      className={cn(
                        'h-8 w-8',
                        platform === 'android' ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <h4
                    className={cn(
                      'text-lg font-semibold',
                      platform === 'android' ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {t('projects.platform.android')}
                  </h4>
                </CardContent>
              </Card>

              {/* Web Platform Card */}
              <Card
                className={cn(
                  'cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg',
                  platform === 'web'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setPlatform('web')}
              >
                <CardContent className="flex flex-col items-center justify-center space-y-3 p-8">
                  <div
                    className={cn(
                      'rounded-full p-4',
                      platform === 'web' ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <Globe
                      className={cn(
                        'h-8 w-8',
                        platform === 'web' ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <h4
                    className={cn(
                      'text-lg font-semibold',
                      platform === 'web' ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {t('projects.platform.web')}
                  </h4>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={!canCreate() || loading}>
              {loading ? t('projects.createDialog.creating') : (
                <>
                  {t('common.create')}
                  <span className="ml-2 text-xs opacity-60">⌘⏎</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
