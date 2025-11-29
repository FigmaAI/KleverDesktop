"use client"

import * as React from "react"
import { FileText, FolderKanban } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import type { Project, Task } from "@/types/project"

interface CommandMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProject?: (project: Project) => void
  onSelectTask?: (task: Task, project: Project) => void
}

export function CommandMenu({ open, onOpenChange, onSelectProject, onSelectTask }: CommandMenuProps) {
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.projectList()
      if (result.success && result.projects) {
        setProjects(result.projects)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProject = (project: Project) => {
    onSelectProject?.(project)
    onOpenChange(false)
  }

  const handleSelectTask = (task: Task & { projectId: string }, project: Project) => {
    onSelectTask?.(task, project)
    onOpenChange(false)
  }

  // Flatten all tasks with project info
  const allTasks = React.useMemo(() => {
    return projects.flatMap((project) =>
      project.tasks.map((task) => ({
        ...task,
        projectId: project.id,
        projectName: project.name,
      }))
    )
  }, [projects])

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search projects and tasks..." />
      <CommandList>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <>
            <CommandEmpty>No results found.</CommandEmpty>
            
            {projects.length > 0 && (
              <>
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project-${project.name}`}
                      onSelect={() => handleSelectProject(project)}
                    >
                      <FolderKanban className="mr-2 h-4 w-4" />
                      <span>{project.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {project.tasks.length} tasks
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {allTasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {allTasks.map((task) => {
                  const project = projects.find(p => p.id === task.projectId)
                  if (!project) return null
                  return (
                    <CommandItem
                      key={task.id}
                      value={`task-${task.goal || task.description || task.name}-${task.projectName}`}
                      onSelect={() => handleSelectTask(task, project)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {task.goal || task.description || task.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          in {task.projectName}
                        </span>
                      </div>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
