import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Smartphone, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Platform } from '../types/project'

export function ProjectCreate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // Form state
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
        alert(message)
        navigate(`/projects/${result.project.id}`)
      } else {
        alert(`Failed to create project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="container mx-auto max-w-3xl flex-1 space-y-6 p-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground">
            A project contains a set of automation tasks for a specific app or website.
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="space-y-8 pt-6">
            {/* Section 1: Project Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">1. Project Details</h3>

              <div className="space-y-2">
                <Label htmlFor="projectName">
                  Project Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="projectName"
                  placeholder="e.g., Instagram Automation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
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
              <h3 className="text-lg font-semibold">2. Select Platform</h3>

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

            {/* Action Button */}
            <div className="flex justify-end pt-4">
              <Button
                size="lg"
                onClick={handleCreate}
                disabled={!canCreate() || loading}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
