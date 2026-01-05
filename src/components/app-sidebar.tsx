"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import {
  FolderKanban,
  Settings,
  Terminal,
  Plus,
  Smartphone,
  Globe,
  Circle,
  Brain,
  Sparkles,
  BarChart3,
  AlertTriangle,
  FolderOpen,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  CheckCircle,
  Cloud,
  Cpu,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import { useTerminal } from "@/hooks/useTerminal"
import type { Project } from "@/types/project"
import logoImg from "@/assets/logo.png"
import { cn } from "@/lib/utils"

export type AppView = 'projects' | 'settings' | 'schedules' | 'statistics'
export type SettingsSection = 'model' | 'platform' | 'agent' | 'preferences' | 'danger'
export type ScheduleSection = 'active' | 'history'
export type StatisticsSection = 'api' | 'local'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  projects: Project[]
  selectedProjectId?: string
  selectedProjectIndex?: number
  focusArea?: 'sidebar' | 'content'
  onProjectSelect: (project: Project) => void
  onCreateProject: () => void
  onNavigate: (view: AppView) => void
  currentView: AppView
  // Project actions
  onOpenWorkDir?: (project: Project) => void
  onDeleteProject?: (project: Project) => void
  // Settings specific
  activeSettingsSection?: SettingsSection
  onSettingsSectionChange?: (section: SettingsSection) => void
  // Schedule specific
  activeScheduleSection?: ScheduleSection
  onScheduleSectionChange?: (section: ScheduleSection) => void
  // Statistics specific
  activeStatisticsSection?: StatisticsSection
  onStatisticsSectionChange?: (section: StatisticsSection) => void
}

const settingsMenuItems: { id: SettingsSection; labelKey: string; icon: React.ElementType }[] = [
  { id: 'model', labelKey: 'settings.model', icon: Brain },
  { id: 'platform', labelKey: 'settings.platform', icon: Smartphone },
  { id: 'agent', labelKey: 'settings.agent', icon: Sparkles },

  { id: 'preferences', labelKey: 'settings.preferences', icon: Globe },
  { id: 'danger', labelKey: 'settings.dangerZone', icon: AlertTriangle },
]

const scheduleMenuItems: { id: ScheduleSection; labelKey: string; icon: React.ElementType }[] = [
  { id: 'active', labelKey: 'schedules.activeUpcoming', icon: Calendar },
  { id: 'history', labelKey: 'schedules.history', icon: CheckCircle },
]

const statisticsMenuItems: { id: StatisticsSection; labelKey: string; icon: React.ElementType }[] = [
  { id: 'api', labelKey: 'statistics.apiModels', icon: Cloud },
  { id: 'local', labelKey: 'statistics.localModels', icon: Cpu },
]

export function AppSidebar({
  projects,
  selectedProjectId,
  selectedProjectIndex = 0,
  focusArea = 'sidebar',
  onProjectSelect,
  onCreateProject,
  onNavigate,
  currentView,
  onOpenWorkDir,
  onDeleteProject,
  activeSettingsSection = 'model',
  onSettingsSectionChange,
  activeScheduleSection = 'active',
  onScheduleSectionChange,
  activeStatisticsSection = 'api',
  onStatisticsSectionChange,
  ...props
}: AppSidebarProps) {
  const { t } = useTranslation()
  const { setOpen } = useSidebar()
  const { isOpen: terminalOpen, setIsOpen: setTerminalOpen } = useTerminal()
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  // Detect platform for keyboard shortcuts
  const isMac = typeof window !== 'undefined' && window.navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modSymbol = isMac ? '⌘' : 'Ctrl'

  // Navigation items - state based instead of routing
  const navMain = [
    {
      title: t('nav.projects'),
      icon: FolderKanban,
      isActive: currentView === 'projects',
      onClick: () => onNavigate('projects'),
      shortcut: `${modSymbol}1`,
    },
    {
      title: t('nav.schedules'),
      icon: Calendar,
      isActive: currentView === 'schedules',
      onClick: () => onNavigate('schedules'),
      shortcut: `${modSymbol}2`,
    },
    {
      title: t('nav.statistics'),
      icon: BarChart3,
      isActive: currentView === 'statistics',
      onClick: () => onNavigate('statistics'),
      shortcut: `${modSymbol}3`,
    },
    {
      title: t('nav.settings'),
      icon: Settings,
      isActive: currentView === 'settings',
      onClick: () => onNavigate('settings'),
      shortcut: `${modSymbol},`,
    },
  ]

  // Reverse to show newest first (projects are stored in creation order)
  const sortedProjects = React.useMemo(() => {
    return [...projects].reverse()
  }, [projects])

  // Pagination
  const totalPages = Math.ceil(sortedProjects.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedProjects = sortedProjects.slice(startIndex, startIndex + itemsPerPage)

  // Get task status summary
  const getTaskStatusSummary = (project: Project) => {
    const total = project.tasks.length
    const running = project.tasks.filter((t) => t.status === "running").length
    return { total, running }
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      {/* First sidebar - Icon navigation */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('projects'); }}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                    <img src={logoImg} alt="Klever" className="size-6" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">Klever</span>
                    <span className="truncate text-xs">Desktop</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: (
                          <span className="flex items-center gap-2">
                            {item.title}
                            <kbd className="ml-1 inline-flex h-5 select-none items-center rounded border border-primary/20 bg-primary/10 text-foreground px-1.5 font-mono text-[10px] font-medium">
                              {item.shortcut}
                            </kbd>
                          </span>
                        ),
                        hidden: false,
                      }}
                      onClick={() => {
                        item.onClick()
                        setOpen(true)
                      }}
                      isActive={item.isActive}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={{
                  children: (
                    <span className="flex items-center gap-2">
                      {t('terminal.title')}
                      <kbd className="ml-1 inline-flex h-5 select-none items-center rounded border border-primary/20 bg-primary/10 text-foreground px-1.5 font-mono text-[10px] font-medium">
                        Ctrl+Shift+`
                      </kbd>
                    </span>
                  ),
                  hidden: false,
                }}
                onClick={() => setTerminalOpen(!terminalOpen)}
                isActive={terminalOpen}
                className="px-2.5 md:px-2"
              >
                <Terminal />
                <span>{t('terminal.title')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <AnimatedThemeToggler
                className="flex aspect-square h-8 w-full items-center justify-center rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* Second sidebar - Project list */}
      {currentView === 'projects' && (
        <Sidebar collapsible="none" className="hidden flex-1 md:flex">
          <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="flex w-full items-center justify-between">
              <div className="text-base font-medium text-foreground">
                {t('nav.projects')}
              </div>
              <button
                onClick={onCreateProject}
                className="flex items-center justify-center rounded-md p-1 hover:bg-sidebar-accent"
                title={t('sidebar.newProject')}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                {sortedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      {t('projects.empty')}
                    </p>
                    <button
                      onClick={onCreateProject}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      {t('projects.emptyDesc')}
                    </button>
                  </div>
                ) : (
                  paginatedProjects.map((project, index) => {
                    const PlatformIcon = project.platform === "android" ? Smartphone : Globe
                    const statusSummary = getTaskStatusSummary(project)
                    const isSelected = project.id === selectedProjectId
                    // Calculate actual index in sorted list for keyboard navigation highlight
                    const actualIndex = startIndex + index
                    const isKeyboardFocused = focusArea === 'sidebar' && !selectedProjectId && actualIndex === selectedProjectIndex

                    return (
                      <div
                        key={project.id}
                        className={cn(
                          "flex w-full flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-left transition-colors",
                          isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
                          isKeyboardFocused && !isSelected && "ring-2 ring-primary ring-inset"
                        )}
                      >
                        <button
                          onClick={() => onProjectSelect(project)}
                          className="flex w-full flex-col items-start gap-2 text-left"
                        >
                          <div className="flex w-full items-center gap-2">
                            <PlatformIcon className="h-4 w-4 flex-shrink-0" />
                            <span className="font-medium truncate flex-1">{project.name}</span>
                            {statusSummary.running > 0 && (
                              <Circle className="h-2 w-2 fill-primary text-primary animate-pulse flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex w-full items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{project.platform}</span>
                            <span>•</span>
                            <span>
                              {statusSummary.total} {statusSummary.total === 1 ? "task" : "tasks"}
                            </span>
                            {statusSummary.running > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-primary">{statusSummary.running} running</span>
                              </>
                            )}
                          </div>
                        </button>

                        {/* Action buttons for selected project */}
                        {isSelected && (
                          <div className="flex w-full items-center gap-1 pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onOpenWorkDir?.(project)
                              }}
                              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                              title={t('sidebar.openWorkDir')}
                            >
                              <FolderOpen className="h-3 w-3" />
                              <span>{t('sidebar.openWorkDir')}</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteProject?.(project)
                              }}
                              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                              title={t('sidebar.deleteProject')}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{t('common.delete')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <SidebarFooter className="border-t p-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, sortedProjects.length)} of {sortedProjects.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-sidebar-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-2 font-medium">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 rounded hover:bg-sidebar-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </SidebarFooter>
          )}
        </Sidebar>
      )}

      {/* Second sidebar - Settings menu */}
      {currentView === 'settings' && (
        <Sidebar collapsible="none" className="hidden flex-1 md:flex">
          <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="text-base font-medium text-foreground">
              {t('nav.settings')}
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <nav className="space-y-1 p-2">
                  {settingsMenuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeSettingsSection === item.id
                    const isDanger = item.id === 'danger'

                    return (
                      <button
                        key={item.id}
                        onClick={() => onSettingsSectionChange?.(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? isDanger
                              ? "bg-destructive/10 text-destructive"
                              : "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(item.labelKey)}
                      </button>
                    )
                  })}
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      )}

      {/* Second sidebar - Schedules menu */}
      {currentView === 'schedules' && (
        <Sidebar collapsible="none" className="hidden flex-1 md:flex">
          <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="text-base font-medium text-foreground">
              {t('nav.schedules')}
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <nav className="space-y-1 p-2">
                  {scheduleMenuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeScheduleSection === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => onScheduleSectionChange?.(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(item.labelKey)}
                      </button>
                    )
                  })}
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      )}

      {/* Second sidebar - Statistics menu */}
      {currentView === 'statistics' && (
        <Sidebar collapsible="none" className="hidden flex-1 md:flex">
          <SidebarHeader className="gap-3.5 border-b p-4">
            <div className="text-base font-medium text-foreground">
              {t('nav.statistics')}
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup className="px-0">
              <SidebarGroupContent>
                <nav className="space-y-1 p-2">
                  {statisticsMenuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = activeStatisticsSection === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => onStatisticsSectionChange?.(item.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {t(item.labelKey)}
                      </button>
                    )
                  })}
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
      )}
    </Sidebar>
  )
}
