import { useEffect, useState, useCallback, useMemo } from 'react'
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
  Search,
} from 'lucide-react'
import { ShineBorder } from '@/components/ui/shine-border'
import { Button } from '@/components/ui/button'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { Badge } from '@/components/ui/badge'
import { AnimatedList } from '@/components/ui/animated-list'
import { BlurFade } from '@/components/magicui/blur-fade'
import { PageHeader } from '@/components/PageHeader'
import { TaskCreateDialog, TaskMarkdownDialog } from '@/components'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  const [sortBy, setSortBy] = useState<'latest' | 'oldest'>('latest')
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0)

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

  // Keyboard shortcut for creating task (Cmd+T or Ctrl+T)
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (
        e.key === 't' &&
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
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

  const handleViewMarkdown = (task: Task, e: React.SyntheticEvent) => {
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

  const sortedTasks = useMemo(() => {
    if (!project) return []
    const sorted = [...project.tasks]
    switch (sortBy) {
      case 'latest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      default:
        return sorted
    }
  }, [project, sortBy])

  // Keyboard navigation for task list (up/down arrows)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (sortedTasks.length === 0) return

      // Prevent navigation if user is typing in an input or dialog is open
      if (
        createDialogOpen ||
        markdownDialogOpen ||
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).closest('[role="dialog"]')
      ) {
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedTaskIndex((prev) => Math.min(prev + 1, sortedTasks.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedTaskIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && sortedTasks[selectedTaskIndex]) {
        e.preventDefault()
        const task = sortedTasks[selectedTaskIndex]
        if (task.resultPath) {
          setSelectedTask(task)
          setMarkdownDialogOpen(true)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedTasks, selectedTaskIndex, createDialogOpen, markdownDialogOpen])

  // Reset selected index when tasks change
  useEffect(() => {
    setSelectedTaskIndex(0)
  }, [sortedTasks.length])

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
              <div className="flex items-center gap-3">
                <RainbowButton onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Task
                  <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                    <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>
                    <span className="text-xs">T</span>
                  </kbd>
                </RainbowButton>
                <Button
                  variant="ghost"
                  onClick={handleDeleteProject}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </Button>
              </div>
            </div>
          </BlurFade>
        ) : (
          <>
            {/* Filter and Add Task Button */}
            <div className="flex items-center justify-between mb-4">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'latest' | 'oldest')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest</SelectItem>
                  <SelectItem value="oldest">Oldest</SelectItem>
                </SelectContent>
              </Select>

              <RainbowButton onClick={() => setCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4" />
                Add Task
                <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50">
                  <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>
                  <span className="text-xs">T</span>
                </kbd>
              </RainbowButton>
            </div>

            <AnimatedList delay={100}>
              {sortedTasks.map((task, index) => {
                const statusConfig = getStatusConfig(task.status)
                const StatusIcon = statusConfig.icon
                const isSelected = index === selectedTaskIndex

                return (
                  <div
                    key={task.id}
                    tabIndex={0}
                    onClick={(e) => {
                      // Don't trigger if clicking on buttons
                      if ((e.target as HTMLElement).closest('button')) return
                      handleViewMarkdown(task, e)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if ((e.target as HTMLElement).closest('button')) return
                        handleViewMarkdown(task, e)
                      }
                    }}
                    className={cn(
                      'group relative flex items-start gap-4 rounded-lg border bg-card p-4 transition-all duration-200',
                      'hover:shadow-lg hover:border-primary/30',
                      'cursor-pointer outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    )}
                  >
                    {task.status === 'running' && (
                      <ShineBorder
                        className="rounded-lg"
                        shineColor={["#A07CFE", "#FE8FB5", "#FFBE7B"]}
                      />
                    )}

                    {/* Status Icon */}
                    <div className="flex-shrink-0 mt-1 z-10">
                      <StatusIcon className={cn('h-5 w-5', statusConfig.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2 z-10">
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
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {task.startedAt
                          ? `Started ${new Date(task.startedAt).toLocaleString()}`
                          : `Created ${new Date(task.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 z-10">
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
      {selectedTask && project && (
        <TaskMarkdownDialog
          open={markdownDialogOpen}
          onClose={() => {
            setMarkdownDialogOpen(false)
            setSelectedTask(null)
          }}
          workspaceDir={project.workspaceDir}
          taskResultPath={selectedTask.resultPath}
          taskName={selectedTask.name || selectedTask.goal}
        />
      )}
    </div>
  )
}
