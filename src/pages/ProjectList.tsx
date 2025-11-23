import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Smartphone, Globe, Trash2, FolderOpen, Circle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RainbowButton } from '@/components/ui/rainbow-button'
import { Badge } from '@/components/ui/badge'
import { AnimatedList } from '@/components/ui/animated-list'
import { PageHeader, GitHubLink, ProjectCreateDialog } from '@/components'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project } from '../types/project'
import { cn } from '@/lib/utils'
import logoImg from '@/assets/logo.png'

type SortOption = 'latest' | 'oldest' | 'a-z' | 'z-a'

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('latest')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [hasAnimated, setHasAnimated] = useState(() => {
    // Check if animation has already been shown in this session
    return sessionStorage.getItem('projectListAnimated') === 'true'
  })
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    // Mark animation as shown after projects load
    if (!loading && projects.length > 0 && !hasAnimated) {
      setHasAnimated(true)
      sessionStorage.setItem('projectListAnimated', 'true')
    }
  }, [loading, projects.length, hasAnimated])

  // Keyboard shortcut for new project
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        setCreateDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadProjects = async () => {
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

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const result = await window.electronAPI.projectDelete(projectId)
      if (result.success) {
        loadProjects()
      } else {
        alert(`Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }

  const handleOpenWorkDir = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
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

  const getTaskStatusSummary = (project: Project) => {
    const total = project.tasks.length
    const running = project.tasks.filter((t) => t.status === 'running').length
    return { total, running }
  }

  // Sort projects based on selected option
  const sortedProjects = useMemo(() => {
    const sorted = [...projects]

    switch (sortBy) {
      case 'latest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'a-z':
        return sorted.sort((a, b) => a.name.localeCompare(b.name))
      case 'z-a':
        return sorted.sort((a, b) => b.name.localeCompare(a.name))
      default:
        return sorted
    }
  }, [projects, sortBy])

  // Keyboard navigation for project list (up/down arrows)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (sortedProjects.length === 0) return

      // Prevent navigation if user is typing in an input or dialog is open
      if (
        createDialogOpen ||
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).closest('[role="dialog"]')
      ) {
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, sortedProjects.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && sortedProjects[selectedIndex]) {
        e.preventDefault()
        navigate(`/projects/${sortedProjects[selectedIndex].id}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedProjects, selectedIndex, navigate, createDialogOpen])

  // Reset selected index when projects change
  useEffect(() => {
    setSelectedIndex(0)
  }, [sortedProjects.length])

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

  const handleProjectCreated = (project: Project) => {
    loadProjects()
    navigate(`/projects/${project.id}`)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        logo={
          <img
            src={logoImg}
            alt="Klever Desktop"
            className="h-8 w-8"
          />
        }
        title="Projects"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleOpenCommandMenu} variant="outline" size="sm">
              <Search className="h-4 w-4" />
              Search
              <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>K
              </kbd>
            </Button>
            <GitHubLink />
          </div>
        }
      />
      <div className="container mx-auto flex-1 space-y-6 p-8">

        {/* Content */}
        {loading ? (
          <div className="flex h-[400px] items-center justify-center">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create your first project to get started with UI automation
            </p>
            <RainbowButton onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Project <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50">
                <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>N
              </kbd>
            </RainbowButton>
          </div>
        ) : (
          <>
            {/* Filter and Create Button */}
            <div className="flex items-center justify-between mb-4">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="a-z">Name (A-Z)</SelectItem>
                  <SelectItem value="z-a">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>

              <RainbowButton onClick={() => setCreateDialogOpen(true)} size="sm">
                <Plus className="h-4 w-4" />
                New Project
                <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-50">
                  <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>N
                </kbd>
              </RainbowButton>
            </div>

            {hasAnimated ? (
              // Static list (no animation on subsequent visits)
              <div className="grid gap-3">
                {sortedProjects.map((project, index) => {
                  const PlatformIcon = project.platform === 'android' ? Smartphone : Globe
                  const statusSummary = getTaskStatusSummary(project)
                  const isSelected = index === selectedIndex

                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className={cn(
                        'group relative flex items-center gap-4 rounded-lg border bg-card p-4 transition-all duration-200',
                        'hover:shadow-lg hover:border-primary/50 cursor-pointer',
                        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      )}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                        <PlatformIcon className="h-6 w-6 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">{project.name}</h3>
                          <Badge
                            variant={project.platform === 'android' ? 'default' : 'secondary'}
                            className="capitalize flex-shrink-0"
                          >
                            {project.platform}
                          </Badge>
                          {statusSummary.running > 0 && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Circle className="h-2 w-2 fill-primary text-primary animate-pulse" />
                              <span className="text-xs text-primary font-medium">
                                {statusSummary.running} running
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>
                            {statusSummary.total} {statusSummary.total === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleOpenWorkDir(project, e)}
                          title="Open workspace folder"
                          className="h-8 w-8"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(project.id, e)}
                          title="Delete Project"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              // Animated list (first visit only)
              <AnimatedList delay={150}>
                {sortedProjects.map((project, index) => {
                  const PlatformIcon = project.platform === 'android' ? Smartphone : Globe
                  const statusSummary = getTaskStatusSummary(project)
                  const isSelected = index === selectedIndex

                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      className={cn(
                        'group relative flex items-center gap-4 rounded-lg border bg-card p-4 transition-all duration-200',
                        'hover:shadow-lg hover:border-primary/50 cursor-pointer',
                        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                      )}
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 rounded-lg bg-primary/10 p-3">
                        <PlatformIcon className="h-6 w-6 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">{project.name}</h3>
                          <Badge
                            variant={project.platform === 'android' ? 'default' : 'secondary'}
                            className="capitalize flex-shrink-0"
                          >
                            {project.platform}
                          </Badge>
                          {statusSummary.running > 0 && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Circle className="h-2 w-2 fill-primary text-primary animate-pulse" />
                              <span className="text-xs text-primary font-medium">
                                {statusSummary.running} running
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>
                            {statusSummary.total} {statusSummary.total === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleOpenWorkDir(project, e)}
                          title="Open workspace folder"
                          className="h-8 w-8"
                        >
                          <FolderOpen className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => handleDelete(project.id, e)}
                          title="Delete Project"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </AnimatedList>
            )}
          </>
        )}
      </div>

      {/* Project Create Dialog */}
      <ProjectCreateDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onProjectCreated={handleProjectCreated}
      />
    </div>
  )
}
