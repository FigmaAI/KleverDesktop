import { Smartphone, Globe, Trash2, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Project } from '../types/project'

interface ProjectCardProps {
  project: Project
  variant?: 'card' | 'list'
  expand?: boolean
  clickable?: boolean
  showDelete?: boolean
  hideTaskSummary?: boolean
  onDeleted?: () => void
  onClick?: (projectId: string) => void
}

export function ProjectCard({
  project,
  variant = 'card',
  expand = false,
  clickable = true,
  showDelete = true,
  hideTaskSummary = false,
  onDeleted,
  onClick,
}: ProjectCardProps) {
  const getTaskStatusSummary = () => {
    const total = project.tasks.length
    const completed = project.tasks.filter((t) => t.status === 'completed').length
    const running = project.tasks.filter((t) => t.status === 'running').length
    const failed = project.tasks.filter((t) => t.status === 'failed').length
    return { total, completed, running, failed }
  }

  // Sanitize app name to match Python behavior (remove spaces)
  const getSanitizedAppName = (name: string) => {
    return name.replace(/ /g, '')
  }

  const statusSummary = getTaskStatusSummary()

  const handleClick = () => {
    if (clickable && onClick) {
      onClick(project.id)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const result = await window.electronAPI.projectDelete(project.id)
      if (result.success) {
        if (onDeleted) {
          onDeleted()
        }
      } else {
        alert(`Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }

  const handleOpenWorkDir = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const workDir = `${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`

    try {
      const result = await window.electronAPI.openFolder(workDir)
      if (!result.success) {
        alert(`Failed to open folder: ${result.error}`)
      }
    } catch (error) {
      console.error('[ProjectCard] Exception opening folder:', error)
      alert('Failed to open folder')
    }
  }

  const PlatformIcon = project.platform === 'android' ? Smartphone : Globe

  // Card View
  if (variant === 'card') {
    return (
      <Card
        className={cn(
          'group relative min-h-[240px] transition-all duration-300 hover:shadow-xl',
          clickable && 'cursor-pointer hover:border-primary/50'
        )}
        onClick={handleClick}
      >
        {/* Platform Badge - Top Right Corner */}
        <div className="absolute right-4 top-4">
          <Badge
            variant={project.platform === 'android' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {project.platform}
          </Badge>
        </div>

        <CardContent className="flex h-full flex-col justify-between pt-6">
          {/* Top Section: Icon and Name */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <PlatformIcon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{project.name}</h3>
            </div>
          </div>

          {/* Bottom Section: Timestamp and Actions */}
          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </p>

            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {expand && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleOpenWorkDir}
                  title={`${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`}
                  className="h-8 w-8"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              )}
              {showDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDelete}
                  title="Delete Project"
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>

        {/* Footer: Task Summary */}
        {!hideTaskSummary && (
          <CardFooter className="border-t bg-muted/50 py-3">
            <p className="text-sm text-muted-foreground">
              {statusSummary.running > 0
                ? `${statusSummary.running} running / ${statusSummary.total} total`
                : statusSummary.total > 0
                ? `${statusSummary.total} ${statusSummary.total === 1 ? 'task' : 'tasks'}`
                : 'No tasks'}
            </p>
          </CardFooter>
        )}
      </Card>
    )
  }

  // List View (Simplified for now)
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-4 transition-colors',
        clickable && 'cursor-pointer hover:bg-accent'
      )}
      onClick={handleClick}
    >
      <div className="flex items-center gap-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <PlatformIcon className="h-5 w-5 text-primary" />
        </div>

        <div>
          <h4 className="font-semibold">{project.name}</h4>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant={project.platform === 'android' ? 'default' : 'secondary'}
              className="text-xs capitalize"
            >
              {project.platform}
            </Badge>
            {!hideTaskSummary && (
              <p className="text-sm text-muted-foreground">
                {statusSummary.running > 0
                  ? `${statusSummary.running} running / ${statusSummary.total} total`
                  : statusSummary.total > 0
                  ? `${statusSummary.total} ${statusSummary.total === 1 ? 'task' : 'tasks'}`
                  : 'No tasks'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {new Date(project.createdAt).toLocaleDateString()}
        </p>

        <div className="flex gap-1">
          {expand && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleOpenWorkDir}
              title={`${project.workspaceDir}/apps/${getSanitizedAppName(project.name)}`}
              className="h-8 w-8"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          )}
          {showDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDelete}
              title="Delete Project"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
