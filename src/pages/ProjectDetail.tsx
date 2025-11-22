import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Play,
  StopCircle,
  Trash2,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  XCircle,
  FolderOpen,
  Circle,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { Badge } from '@/components/ui/badge'
import { AnimatedList } from '@/components/ui/animated-list'
import { BlurFade } from '@/components/magicui/blur-fade'
import { PageHeader } from '@/components/PageHeader'
import { TaskCreateDialog, TaskMarkdownDialog } from '@/components'
import type { Project, Task } from '../types/project'
import { cn } from '@/lib/utils'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [markdownDialogOpen, setMarkdownDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const loadProject = useCallback(async () => {
    if (!id) return

    setLoading(true)
    try {
      const result = await window.electronAPI.projectGet(id)
      if (result.success && result.project) {
        setProject(result.project)
      }
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadProject()
  }, [id, loadProject])

  // Keyboard shortcut for creating task (Cmd+Shift+N or Ctrl+Shift+N)
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (
        e.key === 'n' &&
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault()
        setCreateDialogOpen(true)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleStartTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return

    try {
      const result = await window.electronAPI.taskStart(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to start task')
      }
    } catch (error) {
      console.error('Error starting task:', error)
      alert('Failed to start task')
    }
  }

  const handleStopTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return

    try {
      const result = await window.electronAPI.taskStop(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }

  const handleDeleteTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!id) return
    if (!confirm(`Are you sure you want to delete "${task.name || task.goal}"?`)) return

    try {
      const result = await window.electronAPI.taskDelete(id, task.id)
      if (result.success) {
        loadProject()
      } else {
        alert(result.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleViewMarkdown = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedTask(task)
    setMarkdownDialogOpen(true)
  }

  const handleOpenCommandMenu = () => {
    // Trigger Cmd+K / Ctrl+K keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: typeof window !== 'undefined' && window.navigator.platform.includes('Mac'),
      ctrlKey: typeof window !== 'undefined' && !window.navigator.platform.includes('Mac'),
      bubbles: true
    })
    document.dispatchEvent(event)
  }

  const handleTaskCreated = () => {
    loadProject()
  }

  const handleOpenWorkDir = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!project) return

    const sanitizedName = project.name.replace(/ /g, '')
    const workDir = `${project.workspaceDir}/apps/${sanitizedName}`

    try {
      const result = await window.electronAPI.openFolder(workDir)
      if (!result.success) {
        alert(`Failed to open folder: ${result.error}`)
      }
    } catch (error) {
      console.error('Exception opening folder:', error)
      alert('Failed to open folder')
    }
  }

  const handleDeleteProject = async () => {
    if (!project) return
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const result = await window.electronAPI.projectDelete(project.id)
      if (result.success) {
        navigate('/projects')
      } else {
        alert(`Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }

  const getStatusConfig = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Scheduled', icon: Clock, variant: 'secondary' as const, color: 'text-muted-foreground' }
      case 'running':
        return { label: 'Running', icon: Play, variant: 'default' as const, color: 'text-primary' }
      case 'completed':
        return { label: 'Finished', icon: CheckCircle, variant: 'default' as const, color: 'text-green-500' }
      case 'failed':
        return { label: 'Error', icon: AlertCircle, variant: 'destructive' as const, color: 'text-destructive' }
      case 'cancelled':
        return { label: 'Stopped', icon: XCircle, variant: 'secondary' as const, color: 'text-muted-foreground' }
      default:
        return { label: 'Unknown', icon: Clock, variant: 'secondary' as const, color: 'text-muted-foreground' }
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Project not found</p>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={project.name}
        subtitle={`${project.platform} • ${project.tasks.length} ${project.tasks.length === 1 ? 'task' : 'tasks'}`}
        backButton={
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
        actions={
          <>
            <Button onClick={handleOpenCommandMenu} variant="outline" size="sm">
              <Search className="h-4 w-4" />
              Search
              <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>K
              </kbd>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenWorkDir}
              title="Open workspace folder"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteProject}
              title="Delete Project"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        }
      />
      <div className="container mx-auto flex-1 space-y-6 overflow-auto p-8">
        {/* Tasks Content */}
        {project.tasks.length === 0 ? (
          <BlurFade delay={0.2}>
            <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
              <h3 className="mb-2 text-lg font-semibold">No tasks yet</h3>
              <p className="mb-6 text-sm text-muted-foreground">
                Add your first task to start automating
              </p>
              <RainbowButton onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Task
                <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘⇧N' : 'Ctrl⇧N'}
                </kbd>
              </RainbowButton>
            </div>
          </BlurFade>
        ) : (
          <>
            {/* Add Task Button */}
            <div className="flex items-center justify-end mb-4">
              <RainbowButton onClick={() => setCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4" />
                Add Task
              </RainbowButton>
            </div>

            <AnimatedList delay={100}>
              {project.tasks.map((task) => {
                const statusConfig = getStatusConfig(task.status)
                const StatusIcon = statusConfig.icon

                return (
                  <div
                    key={task.id}
                    className={cn(
                      'group flex items-start gap-4 rounded-lg border bg-card p-4 transition-all duration-200',
                      'hover:shadow-lg hover:border-primary/30'
                    )}
                  >
                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-1">
                      <StatusIcon className={cn('h-5 w-5', statusConfig.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Description/Goal */}
                      <p className="text-sm leading-relaxed">
                        {task.goal || task.description || 'No description'}
                      </p>

                      {/* Status & Model */}
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 text-xs">
                          {statusConfig.label}
                        </Badge>
                        {task.model && (
                          <Badge variant="outline" className="text-xs">
                            {task.model}
                          </Badge>
                        )}
                        {task.status === 'running' && (
                          <div className="flex items-center gap-1.5">
                            <Circle className="h-2 w-2 fill-primary text-primary animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {task.startedAt
                          ? `Started ${new Date(task.startedAt).toLocaleString()}`
                          : `Created ${new Date(task.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {task.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={(e) => handleStartTask(task, e)}
                          className="h-8"
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Start
                        </Button>
                      )}

                      {task.status === 'running' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => handleStopTask(task, e)}
                          className="h-8"
                        >
                          <StopCircle className="mr-1 h-3 w-3" />
                          Stop
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleViewMarkdown(task, e)}
                        disabled={!task.resultPath}
                        title="View Results"
                        className="h-8 w-8"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => handleDeleteTask(task, e)}
                        disabled={task.status === 'running'}
                        title="Delete Task"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </AnimatedList>
          </>
        )}
      </div>

      {/* Task Create Dialog */}
      {project && (
        <TaskCreateDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          projectId={project.id}
          projectName={project.name}
          platform={project.platform}
          onTaskCreated={handleTaskCreated}
        />
      )}

      {/* Task Markdown Dialog */}
      {selectedTask && (
        <TaskMarkdownDialog
          open={markdownDialogOpen}
          onClose={() => {
            setMarkdownDialogOpen(false)
            setSelectedTask(null)
          }}
          projectId={project?.id || ''}
          taskId={selectedTask.id}
          taskName={selectedTask.name || selectedTask.goal}
        />
      )}
    </div>
  )
}
