import { useState } from 'react'
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
        const message = result.message || `Project created at ${result.project.workspaceDir}`
        toast.success('Project Created', { description: message })
        onProjectCreated?.(result.project)
        handleClose()
      } else {
        toast.error('Error', { description: `Failed to create project: ${result.error}` })
      }
    } catch (error) {
      console.error('Error creating project:', error)
      toast.error('Error', { description: 'Failed to create project. Please try again.' })
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
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription className="sr-only">
            Create a new automation project. Enter a project name, optionally select a workspace directory, and choose a platform (Android or Web).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Section 1: Project Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">PROJECT DETAILS</h3>

            <div className="space-y-2">
              <Label htmlFor="projectName">
                Project Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="projectName"
                placeholder="e.g., Instagram Automation"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <p className="text-sm text-muted-foreground">
                The name of the app or website you want to automate.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspaceDir">Workspace Directory (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="workspaceDir"
                  readOnly
                  value={workspaceDir}
                  placeholder="Default: ~/Documents"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleSelectWorkspace}
                  className="shrink-0"
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                The directory where project data and outputs will be stored.
              </p>
            </div>
          </div>

          {/* Section 2: Platform Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">SELECT PLATFORM</h3>

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
                    Android
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
                    Web
                  </h4>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!canCreate() || loading}>
              {loading ? 'Creating...' : (
                <>
                  Create
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
