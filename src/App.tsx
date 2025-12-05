import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Save, Search } from 'lucide-react'
import { Toaster } from '@/components/ui/sonner'
import { LoadingScreen } from './components/LoadingScreen'
import { TerminalProvider } from './contexts/TerminalContext'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { AppSidebar, type SettingsSection } from '@/components/app-sidebar'
import { CommandMenu } from '@/components/CommandMenu'
import { TerminalHeader } from '@/components/UniversalTerminal/TerminalHeader'
import { TerminalOutput } from '@/components/UniversalTerminal/TerminalOutput'
import { ProjectCreateDialog } from '@/components/ProjectCreateDialog'
import { TaskCreateDialog } from '@/components/TaskCreateDialog'
import { SetupWizard } from './pages/SetupWizard'
import { Settings } from './pages/Settings'
import { useTerminal } from '@/hooks/useTerminal'
import { TaskContentArea } from '@/components/TaskContentArea'
import { TaskDetail } from '@/components/TaskDetail'
import { GitHubLink } from '@/components/GitHubLink'
import type { Project, Task } from '@/types/project'

type AppView = 'projects' | 'settings'

// Settings section labels for breadcrumb
const settingsSectionLabels: Record<SettingsSection, string> = {
  model: 'Model',
  platform: 'Platform',
  agent: 'Agent',
  image: 'Image',
  danger: 'Danger Zone',
}

function MainApp() {
  const [commandOpen, setCommandOpen] = useState(false)
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false)
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const { isOpen: terminalOpen, setIsOpen: setTerminalOpen } = useTerminal()
  
  // App state
  const [currentView, setCurrentView] = useState<AppView>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  
  // Keyboard navigation state
  const [focusArea, setFocusArea] = useState<'sidebar' | 'content'>('sidebar')
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0)
  
  // Settings state
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection>('model')
  const [settingsHasChanges, setSettingsHasChanges] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsCanSave, setSettingsCanSave] = useState(true)
  const settingsSaveRef = useRef<(() => Promise<void>) | null>(null)

  // Detect platform for keyboard shortcuts
  const isMac = typeof window !== 'undefined' && window.navigator.platform.toUpperCase().indexOf('MAC') >= 0

  // Track selected project ID for updates
  const selectedProjectIdRef = useRef<string | null>(null)
  
  // Keep ref in sync
  useEffect(() => {
    selectedProjectIdRef.current = selectedProject?.id ?? null
  }, [selectedProject])

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      const result = await window.electronAPI.projectList()
      if (result.success && result.projects) {
        setProjects(result.projects)
        
        // Update selected project if it exists (using ref to avoid stale closure)
        const currentSelectedId = selectedProjectIdRef.current
        if (currentSelectedId) {
          const updated = result.projects.find(p => p.id === currentSelectedId)
          if (updated) {
            setSelectedProject(updated)
          }
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    }
  }, [])

  // Handle delete project (declared early for keyboard shortcut use)
  const handleDeleteProject = useCallback(async (project: Project) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) return

    try {
      const result = await window.electronAPI.projectDelete(project.id)
      if (result.success) {
        setSelectedProject(null)
        loadProjects()
      } else {
        alert(`Failed to delete project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      alert('Failed to delete project')
    }
  }, [loadProjects])

  useEffect(() => {
    loadProjects()
  }, []) // Only load on mount

  // Listen for task completion events to refresh project list
  // Note: TerminalContext also listens to task:complete for terminal state
  // This listener refreshes the project list for UI updates
  useEffect(() => {
    const handleTaskComplete = () => {
      // Refresh projects when any task completes, fails, or is cancelled
      loadProjects()
    }

    window.electronAPI.onTaskComplete(handleTaskComplete)

    // Note: Don't call removeAllListeners here as it would remove
    // TerminalContext's listener too. MainApp only unmounts on app exit.
  }, [loadProjects])

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && window.navigator.platform.includes('Mac')
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Skip if in input/textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Allow Escape in inputs
        if (e.key !== 'Escape') return
      }

      // Search: Cmd+K / Ctrl+K
      if (e.key === 'k' && modKey) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }

      // Projects: Cmd+1 / Ctrl+1
      if (e.key === '1' && modKey) {
        e.preventDefault()
        setCurrentView('projects')
        setSelectedTask(null)
      }

      // Settings: Cmd+, / Ctrl+, OR Cmd+2 / Ctrl+2
      if ((e.key === ',' || e.key === '2') && modKey) {
        e.preventDefault()
        setCurrentView('settings')
      }

      // New Project: Cmd+N / Ctrl+N
      if (e.key === 'n' && modKey && !e.shiftKey) {
        e.preventDefault()
        setCreateProjectDialogOpen(true)
      }

      // New Task: Cmd+T / Ctrl+T
      if (e.key === 't' && modKey && !selectedTask) {
        e.preventDefault()
        setCreateTaskDialogOpen(true)
      }

      // Save Settings: Cmd+S / Ctrl+S
      if (e.key === 's' && modKey && currentView === 'settings') {
        e.preventDefault()
        if (settingsHasChanges && settingsCanSave && !settingsSaving && settingsSaveRef.current) {
          settingsSaveRef.current()
        }
      }

      // Terminal: Ctrl+Shift+`
      if (e.key === '`' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setTerminalOpen((open) => !open)
      }

      // GitHub: Cmd+G / Ctrl+G
      if (e.key === 'g' && modKey) {
        e.preventDefault()
        window.electronAPI.openExternal('https://github.com/FigmaAI/KleverDesktop')
      }

      // Theme: Cmd+\ / Ctrl+\
      if (e.key === '\\' && modKey) {
        e.preventDefault()
        if (document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.remove('dark')
        } else {
          document.documentElement.classList.add('dark')
        }
      }

      // Escape: Go back (Task -> Project -> Projects list, Settings -> Projects)
      if (e.key === 'Escape') {
        e.preventDefault()
        if (selectedTask) {
          setSelectedTask(null)
          setFocusArea('content')
        } else if (focusArea === 'content' && selectedProject) {
          // From task list back to project list
          setFocusArea('sidebar')
        } else if (currentView === 'settings') {
          setCurrentView('projects')
          setFocusArea('sidebar')
        } else if (selectedProject) {
          setSelectedProject(null)
          setFocusArea('sidebar')
        }
      }

      // Arrow keys for navigation (only when not in dialogs)
      if (!target.closest('[role="dialog"]') && currentView === 'projects') {
        // Get sorted projects (newest first)
        const sortedProjects = [...projects].reverse()
        
        if (focusArea === 'sidebar' && !selectedProject) {
          // Navigate project list
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedProjectIndex(prev => Math.min(prev + 1, sortedProjects.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedProjectIndex(prev => Math.max(prev - 1, 0))
          } else if (e.key === 'Enter' && sortedProjects.length > 0) {
            e.preventDefault()
            const project = sortedProjects[selectedProjectIndex]
            if (project) {
              setSelectedProject(project)
              // Delay focus change to prevent Enter event from triggering task selection
              requestAnimationFrame(() => {
                setFocusArea('content')
              })
            }
          } else if ((e.key === 'Delete' || e.key === 'Backspace') && sortedProjects.length > 0) {
            // Delete selected project
            e.preventDefault()
            const project = sortedProjects[selectedProjectIndex]
            if (project) {
              handleDeleteProject(project)
            }
          }
        }
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [setTerminalOpen, projects, selectedProject, selectedTask, currentView, settingsHasChanges, settingsCanSave, settingsSaving, focusArea, selectedProjectIndex, handleDeleteProject])

  // Handle project selection
  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
    setCurrentView('projects')
  }

  // Handle project creation
  const handleProjectCreated = (project: Project) => {
    loadProjects()
    setSelectedProject(project)
  }

  // Handle task creation
  const handleTaskCreated = () => {
    loadProjects()
  }

  // Handle task click - navigate to task detail
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
  }

  // Handle back from task detail
  const handleTaskBack = () => {
    setSelectedTask(null)
  }

  // Handle navigation
  const handleNavigate = (view: AppView) => {
    setCurrentView(view)
    if (view === 'settings') {
      setSelectedProject(null)
    }
  }

  // Handle settings save from header
  const handleSettingsSave = async () => {
    if (settingsSaveRef.current) {
      await settingsSaveRef.current()
    }
  }

  // Handle open work directory
  const handleOpenWorkDir = async (project: Project) => {
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

  // Get breadcrumb items
  const getBreadcrumbItems = () => {
    const items: { label: string; onClick?: () => void }[] = []

    if (currentView === 'projects') {
      items.push({ 
        label: 'Projects', 
        onClick: selectedProject ? () => { setSelectedProject(null); setSelectedTask(null); } : undefined 
      })
      
      if (selectedProject) {
        items.push({ 
          label: selectedProject.name,
          onClick: selectedTask ? () => setSelectedTask(null) : undefined
        })
      }

      if (selectedTask) {
        const taskLabel = selectedTask.name || selectedTask.goal || 'Task'
        items.push({ label: taskLabel.length > 30 ? taskLabel.substring(0, 30) + '...' : taskLabel })
      }
    } else if (currentView === 'settings') {
      items.push({ 
        label: 'Settings',
        onClick: () => setActiveSettingsSection('model')
      })
      items.push({ label: settingsSectionLabels[activeSettingsSection] })
    }

    return items
  }

  const breadcrumbItems = getBreadcrumbItems()

  return (
    <SidebarProvider
      style={{
        "--sidebar-width": "350px",
      } as React.CSSProperties}
    >
      <AppSidebar
        projects={projects}
        selectedProjectId={selectedProject?.id}
        selectedProjectIndex={selectedProjectIndex}
        focusArea={focusArea}
        onProjectSelect={(project) => {
          handleProjectSelect(project)
          setFocusArea('content')
        }}
        onCreateProject={() => setCreateProjectDialogOpen(true)}
        onNavigate={handleNavigate}
        currentView={currentView}
        onOpenWorkDir={handleOpenWorkDir}
        onDeleteProject={handleDeleteProject}
        activeSettingsSection={activeSettingsSection}
        onSettingsSectionChange={setActiveSettingsSection}
      />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-[57px] shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />

          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbItems.map((item, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                  <BreadcrumbItem>
                    {item.onClick ? (
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          item.onClick?.()
                        }}
                      >
                        {item.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header actions */}
          <div className="ml-auto flex items-center gap-2">
            {/* Search input - click to open command menu */}
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden sm:flex items-center gap-2 h-8 w-48 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Search...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <span>{isMac ? '⌘' : 'Ctrl'}</span>K
              </kbd>
            </button>
            
            {/* Mobile search button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCommandOpen(true)}
              className="sm:hidden"
            >
              <Search className="h-4 w-4" />
            </Button>

            {/* GitHub button with stars */}
            <GitHubLink />

            {/* Settings save button */}
            {currentView === 'settings' && (
              <Button
                size="sm"
                onClick={handleSettingsSave}
                disabled={!settingsHasChanges || settingsSaving || !settingsCanSave}
                variant={settingsHasChanges ? 'default' : 'outline'}
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">
                  {settingsSaving ? 'Saving...' : settingsHasChanges ? 'Save' : 'Saved'}
                </span>
                {settingsHasChanges && (
                  <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70">
                    <span className="text-xs">{isMac ? '⌘' : 'Ctrl'}</span>S
                  </kbd>
                )}
              </Button>
            )}
          </div>
            </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          {currentView === 'settings' ? (
            <Settings
              activeSection={activeSettingsSection}
              onSaveRefChange={(saveRef) => { settingsSaveRef.current = saveRef }}
              onHasChangesChange={setSettingsHasChanges}
              onSavingChange={setSettingsSaving}
              onCanSaveChange={setSettingsCanSave}
            />
          ) : selectedTask && selectedProject ? (
            <TaskDetail
              task={selectedTask}
              project={selectedProject}
              onBack={handleTaskBack}
              onProjectsChange={loadProjects}
            />
          ) : (
            <TaskContentArea
              project={selectedProject}
              onTaskClick={handleTaskClick}
              onCreateTask={() => setCreateTaskDialogOpen(true)}
              onProjectsChange={loadProjects}
              focusArea={focusArea}
            />
          )}
        </main>
      </SidebarInset>

      {/* Command Menu */}
      <CommandMenu 
        open={commandOpen} 
        onOpenChange={setCommandOpen}
        onSelectProject={(project) => {
          setSelectedProject(project)
          setSelectedTask(null)
          setCurrentView('projects')
        }}
        onSelectTask={(task, project) => {
          setSelectedProject(project)
          setSelectedTask(task)
          setCurrentView('projects')
        }}
      />

      {/* Terminal Drawer */}
      <Drawer open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerTitle className="sr-only">Universal Terminal</DrawerTitle>
          <DrawerDescription className="sr-only">View and manage terminal output from running tasks and operations</DrawerDescription>
          <div className="flex flex-col h-full min-h-[60vh] overflow-hidden">
            <TerminalHeader />
            <TerminalOutput />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Project Create Dialog */}
      <ProjectCreateDialog
        open={createProjectDialogOpen}
        onClose={() => setCreateProjectDialogOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Task Create Dialog */}
      <TaskCreateDialog
        open={createTaskDialogOpen}
        onClose={() => setCreateTaskDialogOpen(false)}
        projects={projects}
        selectedProjectId={selectedProject?.id}
        onTaskCreated={handleTaskCreated}
        onCreateProject={() => {
          setCreateTaskDialogOpen(false)
          setCreateProjectDialogOpen(true)
        }}
      />

    </SidebarProvider>
  )
}

function App() {
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [showLoading, setShowLoading] = useState(true)
  const [minDurationComplete, setMinDurationComplete] = useState(false)

  // System dark/light mode detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    // Set initial theme
    updateTheme(mediaQuery)

    // Listen for system theme changes
    mediaQuery.addEventListener('change', updateTheme)

    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [])

  useEffect(() => {
    const checkSetup = async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Setup check timeout after 5 seconds')), 5000)
      );

      try {
        const result = await Promise.race([
          window.electronAPI.checkSetup(),
          timeoutPromise
        ]) as { success: boolean; setupComplete: boolean };

        console.log('[App] Setup check result:', result);
        setSetupComplete(result.success ? result.setupComplete : false)
      } catch (error) {
        console.error('[App] Failed to check setup status:', error)
        setSetupComplete(false)
      } finally {
        setIsChecking(false)
      }
    }

    const timeoutId = setTimeout(checkSetup, 500);
    return () => clearTimeout(timeoutId);
  }, [])

  useEffect(() => {
    if (!isChecking && setupComplete !== null && minDurationComplete) {
      setShowLoading(false)
    }
  }, [isChecking, setupComplete, minDurationComplete])

  if (showLoading || isChecking || setupComplete === null) {
    return (
      <LoadingScreen
        minDuration={3000}
        onMinDurationComplete={() => setMinDurationComplete(true)}
      />
    )
  }

  if (!setupComplete) {
    return (
      <TerminalProvider>
        <SetupWizard />
        <Toaster />
      </TerminalProvider>
    )
  }

  return (
    <TerminalProvider>
      <MainApp />
      <Toaster />
    </TerminalProvider>
  )
}

export default App
