import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List as ListIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/ProjectCard'
import type { Project } from '../types/project'

export function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')

  useEffect(() => {
    loadProjects()
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

  return (
    <div className="flex h-full flex-col">
      <div className="container mx-auto flex-1 space-y-6 p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">Manage your automation projects</p>
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

            {/* New Project Button */}
            <Button onClick={() => navigate('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex h-[400px] items-center justify-center rounded-lg border bg-card">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border bg-card p-8 text-center">
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="mb-6 text-sm text-muted-foreground">
              Create your first project to get started with UI automation
            </p>
            <Button onClick={() => navigate('/projects/new')} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </div>
        ) : (
          <>
            {/* Card View - Wide Layout (2 columns) */}
            {viewMode === 'card' && (
              <div className="grid gap-6 md:grid-cols-2">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    variant="card"
                    expand={true}
                    clickable={true}
                    showDelete={true}
                    onDeleted={loadProjects}
                    onClick={(id) => navigate(`/projects/${id}`)}
                  />
                ))}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    variant="list"
                    expand={true}
                    clickable={true}
                    showDelete={true}
                    onDeleted={loadProjects}
                    onClick={(id) => navigate(`/projects/${id}`)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
