import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, LayoutGrid, List as ListIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/ProjectCard'
import { TaskCard } from '@/components/TaskCard'
// import { TaskCreateDialog, TaskDetailDialog, TaskMarkdownDialog } from '@/components'
import type { Project, Task } from '../types/project'

export function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

  // Dialog states (TODO: implement dialogs)
  const [_createDialogOpen, setCreateDialogOpen] = useState(false)
  const [_markdownDialogOpen, setMarkdownDialogOpen] = useState(false)
  const [_selectedTask, setSelectedTask] = useState<Task | null>(null)

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

  const handleStartTask = async (task: Task) => {
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

  const handleStopTask = async (task: Task) => {
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

  const handleDeleteTask = async (task: Task) => {
    if (!id) return

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

  const handleViewMarkdown = (task: Task) => {
    setSelectedTask(task)
    setMarkdownDialogOpen(true)
    // TODO: Implement markdown dialog
    alert('Markdown dialog not yet implemented')
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
      <div className="container mx-auto flex-1 space-y-6 overflow-auto p-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>

        {/* Project Header */}
        <div className="rounded-lg border bg-card">
          <ProjectCard
            project={project}
            variant="list"
            expand={true}
            clickable={false}
            showDelete={true}
            hideTaskSummary={true}
            onDeleted={() => navigate('/projects')}
          />
        </div>

        {/* Tasks Section Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Tasks</h2>
            <p className="text-sm text-muted-foreground">
              {project.tasks.length} {project.tasks.length === 1 ? 'task' : 'tasks'}
            </p>
          </div>

          <div className="flex gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border">
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-l-none"
              >
                <ListIcon className="h-4 w-4" />
              </Button>
            </div>

            {/* Add Task Button */}
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Tasks Content */}
        {project.tasks.length === 0 ? (
          <div className="flex h-[300px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">No tasks yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Add your first task to start automating
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        ) : (
          <>
            {/* Card View - 3 columns for tasks */}
            {viewMode === 'card' && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {project.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="card"
                    onStart={handleStartTask}
                    onStop={handleStopTask}
                    onDelete={handleDeleteTask}
                    onViewMarkdown={handleViewMarkdown}
                  />
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {project.tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    variant="list"
                    onStart={handleStartTask}
                    onStop={handleStopTask}
                    onDelete={handleDeleteTask}
                    onViewMarkdown={handleViewMarkdown}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* TODO: Implement Dialogs */}
      {/* <TaskCreateDialog ... /> */}
      {/* <TaskDetailDialog ... /> */}
      {/* <TaskMarkdownDialog ... /> */}
    </div>
  )
}
