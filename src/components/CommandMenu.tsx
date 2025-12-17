"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()
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
      <CommandInput placeholder={t('search.searchProjectsTasks')} />
      <CommandList>
        {loading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        ) : (
          <>
            <CommandEmpty>{t('search.noResults')}</CommandEmpty>

            {projects.length > 0 && (
              <>
                <CommandGroup heading={t('search.projects')}>
                  {projects.map((project) => (
                    <CommandItem
                      key={project.id}
                      value={`project-${project.name}`}
                      onSelect={() => handleSelectProject(project)}
                    >
                      <FolderKanban className="mr-2 h-4 w-4" />
                      <span>{project.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t('search.tasksCount', { count: project.tasks.length })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {allTasks.length > 0 && (
              <CommandGroup heading={t('search.tasks')}>
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
                          {t('search.inProject', { name: task.projectName })}
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
