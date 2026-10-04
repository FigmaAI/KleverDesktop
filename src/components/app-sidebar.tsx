import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Calendar, CheckCircle, FolderKanban, FolderOpen, Plus, Settings, Smartphone, Trash2 } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { Button } from '@/components/ui/button'
import type { Project } from '@/types/project'
import logoImg from '@/assets/logo.png'
import { cn } from '@/lib/utils'

export type AppView = 'projects' | 'settings' | 'schedules'
export type ScheduleSection = 'active' | 'history'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  projects: Project[]
  selectedProjectId?: string
  selectedProjectIndex?: number
  focusArea?: 'sidebar' | 'content'
  onProjectSelect: (project: Project) => void
  onCreateProject: () => void
  onNavigate: (view: AppView) => void
  currentView: AppView
  onOpenWorkDir?: (project: Project) => void
  onDeleteProject?: (project: Project) => void
  activeScheduleSection?: ScheduleSection
  onScheduleSectionChange?: (section: ScheduleSection) => void
}

export function AppSidebar({ projects, selectedProjectId, selectedProjectIndex = 0, focusArea = 'sidebar', onProjectSelect, onCreateProject, onNavigate, currentView, onOpenWorkDir, onDeleteProject, activeScheduleSection = 'active', onScheduleSectionChange, ...props }: AppSidebarProps) {
  const { t } = useTranslation()
  const sortedProjects = React.useMemo(() => [...projects].reverse(), [projects])
  const navigation = [
    { id: 'projects' as const, icon: FolderKanban, label: 'nav.projects' },
    { id: 'schedules' as const, icon: Calendar, label: 'nav.schedules' },
    { id: 'settings' as const, icon: Settings, label: 'nav.settings' },
  ]

  return (
    <Sidebar {...props}>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3"><img src={logoImg} alt="" className="h-7 w-7" /><div><p className="font-semibold">Klever</p><p className="text-xs text-muted-foreground">{t('native.appTagline')}</p></div></div>
        <SidebarMenu className="mt-3">
          {navigation.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={currentView === item.id} onClick={() => onNavigate(item.id)}><item.icon /><span>{t(item.label)}</span></SidebarMenuButton></SidebarMenuItem>)}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {currentView === 'projects' && <SidebarGroup>
          <div className="flex items-center justify-between"><SidebarGroupLabel>{t('nav.projects')}</SidebarGroupLabel><Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('sidebar.newProject')} onClick={onCreateProject}><Plus className="h-4 w-4" /></Button></div>
          {!sortedProjects.length && <p className="p-2 text-sm text-muted-foreground">{t('projects.empty')}</p>}
          <SidebarMenu>
            {sortedProjects.map((project, index) => {
              const selected = project.id === selectedProjectId
              const running = project.tasks.some((task) => task.status === 'running')
              return <SidebarMenuItem key={project.id}>
                <SidebarMenuButton isActive={selected} onClick={() => onProjectSelect(project)} className={cn('h-auto py-3', focusArea === 'sidebar' && !selectedProjectId && index === selectedProjectIndex && 'ring-1 ring-inset ring-primary')}>
                  <Smartphone className="shrink-0" /><span className="flex-1 min-w-0"><span className="block truncate font-medium">{project.name}</span><span className="block text-xs text-muted-foreground">{t('tasks.pagination.tasksTotal', { count: project.tasks.length })}</span></span>{running && <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                </SidebarMenuButton>
                {selected && <div className="flex items-center gap-1 px-2 pb-2">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onOpenWorkDir?.(project)}><FolderOpen className="mr-1 h-3 w-3" />{t('native.resultsFolder')}</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={t('sidebar.deleteProject')} onClick={() => onDeleteProject?.(project)}><Trash2 className="h-3 w-3" /></Button>
                </div>}
              </SidebarMenuItem>
            })}
          </SidebarMenu>
        </SidebarGroup>}
        {currentView === 'schedules' && <SidebarGroup><SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton isActive={activeScheduleSection === 'active'} onClick={() => onScheduleSectionChange?.('active')}><Calendar /><span>{t('schedules.activeUpcoming')}</span></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton isActive={activeScheduleSection === 'history'} onClick={() => onScheduleSectionChange?.('history')}><CheckCircle /><span>{t('schedules.history')}</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu></SidebarGroup>}
      </SidebarContent>
      <SidebarFooter className="border-t"><AnimatedThemeToggler className="h-8 w-8" /></SidebarFooter>
    </Sidebar>
  )
}
