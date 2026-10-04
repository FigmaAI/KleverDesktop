import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AppSidebar, type AppView, type ScheduleSection } from '@/components/app-sidebar'
import { CommandMenu } from '@/components/CommandMenu'
import { ProjectCreateDialog } from '@/components/ProjectCreateDialog'
import { TaskCreateDialog } from '@/components/TaskCreateDialog'
import { TestRunDialog } from '@/components/TestRunDialog'
import { TaskContentArea } from '@/components/TaskContentArea'
import { TaskDetail } from '@/components/TaskDetail'
import { Settings } from '@/pages/Settings'
import { ScheduledTasks } from '@/pages/ScheduledTasks'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { changeLanguage } from '@/i18n'
import { caseRuns } from '@/lib/test-case'
import type { Project, Task, TestCase } from '@/types/project'

function MainApp() {
  const { t } = useTranslation()
  const [view, setView] = useState<AppView>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [projectId, setProjectId] = useState<string>()
  const [caseId, setCaseId] = useState<string>()
  const [runId, setRunId] = useState<string>()
  const [projectDialog, setProjectDialog] = useState(false)
  const [caseDialog, setCaseDialog] = useState(false)
  const [runDialog, setRunDialog] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [scheduleSection, setScheduleSection] = useState<ScheduleSection>('active')
  const [settingsChanged, setSettingsChanged] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsCanSave, setSettingsCanSave] = useState(true)
  const saveSettingsRef = useRef<(() => Promise<void>) | null>(null)
  const requestId = useRef(0)
  const selectedProject = projects.find((project) => project.id === projectId) || null
  const selectedCase = selectedProject?.testCases?.find((testCase) => testCase.id === caseId) || null
  const selectedTask = selectedProject?.tasks.find((task) => task.id === runId) || null

  const loadProjects = useCallback(async () => {
    const request = ++requestId.current
    try {
      const result = await window.electronAPI.projectList()
      if (!result.success || !result.projects) throw new Error(result.error || 'Failed to load projects')
      if (request === requestId.current) { setProjects(result.projects); setLoadError(undefined) }
    } catch (reason) {
      if (request === requestId.current) setLoadError(reason instanceof Error ? reason.message : 'Failed to load projects')
    } finally {
      if (request === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => { void loadProjects() }, [loadProjects])
  useEffect(() => {
    const refresh = () => { void loadProjects() }
    const cleanups = [window.electronAPI.onTaskStarted(refresh), window.electronAPI.onTaskComplete(refresh), window.electronAPI.onTaskRecorded(refresh), window.electronAPI.onScheduleAdded(refresh), window.electronAPI.onScheduleStarted(refresh), window.electronAPI.onScheduleCancelled(refresh), window.electronAPI.onScheduleFailed(refresh)]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [loadProjects])

  const selectProject = (project: Project) => { setView('projects'); setProjectId(project.id); setCaseId(undefined); setRunId(undefined) }
  const selectCase = (testCase: TestCase) => {
    setView('projects'); setProjectId(testCase.projectId); setCaseId(testCase.id)
    const project = projects.find((item) => item.id === testCase.projectId)
    const latest = project ? caseRuns(project, testCase.id)[0] : undefined
    setRunId(latest?.id)
    if (!latest) setRunDialog(true)
  }
  const selectRun = (run: Task) => { setView('projects'); setProjectId(run.projectId); setCaseId(run.testCaseId); setRunId(run.id); void loadProjects() }
  const newCase = () => { setCaseDialog(true) }
  const navigate = (next: AppView) => { setView(next); setCaseId(undefined); setRunId(undefined) }
  const saveRefChanged = useCallback((save: (() => Promise<void>) | null) => { saveSettingsRef.current = save }, [])

  useKeyboardShortcuts({ handlers: {
    onSearch: () => setCommandOpen((open) => !open), onProjects: () => navigate('projects'), onSchedules: () => navigate('schedules'), onSettings: () => navigate('settings'),
    onNewProject: () => setProjectDialog(true), onNewTask: newCase,
    onSave: () => { if (settingsChanged && settingsCanSave && !settingsSaving) void saveSettingsRef.current?.() },
    onToggleTheme: () => document.documentElement.classList.toggle('dark'),
    onEscape: () => { if (runId) { setCaseId(undefined); setRunId(undefined) } else if (view !== 'projects') { navigate('projects') } else { setProjectId(undefined) } },
  }, canSave: view === 'settings' && settingsChanged && settingsCanSave && !settingsSaving })

  const deleteProject = async (project: Project) => {
    if (!confirm(t('errors.deleteConfirm', { name: project.name }))) return
    const result = await window.electronAPI.projectDelete(project.id)
    if (!result.success) toast.error(result.error || t('errors.deleteFailedGeneric'))
    else { if (projectId === project.id) { setProjectId(undefined); setCaseId(undefined); setRunId(undefined) } void loadProjects() }
  }
  const breadcrumbs: Array<{ label: string; action?: () => void }> = [{ label: t('nav.' + view) }]
  if (view === 'projects' && selectedProject) {
    breadcrumbs[0].action = () => { setProjectId(undefined); setCaseId(undefined); setRunId(undefined) }
    breadcrumbs.push({ label: selectedProject.name, action: selectedTask ? () => { setCaseId(undefined); setRunId(undefined) } : undefined })
    if (selectedTask) breadcrumbs.push({ label: (selectedTask.name || selectedTask.goal).slice(0, 40) })
  } else if (view === 'schedules') breadcrumbs.push({ label: t(scheduleSection === 'active' ? 'schedules.activeUpcoming' : 'schedules.history') })

  return (
    <SidebarProvider style={{ '--sidebar-width': '280px' } as React.CSSProperties}>
      <AppSidebar projects={projects} selectedProjectId={projectId} onProjectSelect={selectProject} onCreateProject={() => setProjectDialog(true)} onNavigate={navigate} currentView={view} onOpenWorkDir={(project) => void window.electronAPI.openFolder(project.workspaceDir)} onDeleteProject={(project) => void deleteProject(project)} activeScheduleSection={scheduleSection} onScheduleSectionChange={setScheduleSection} />
      <SidebarInset>
        <header className="flex h-[57px] shrink-0 items-center gap-2 border-b px-4"><SidebarTrigger /><Separator orientation="vertical" className="h-4 mr-2" /><Breadcrumb><BreadcrumbList>{breadcrumbs.map((item, index) => <Fragment key={index}>{index > 0 && <BreadcrumbSeparator />}<BreadcrumbItem>{item.action ? <BreadcrumbLink asChild><button onClick={item.action}>{item.label}</button></BreadcrumbLink> : <BreadcrumbPage>{item.label}</BreadcrumbPage>}</BreadcrumbItem></Fragment>)}</BreadcrumbList></Breadcrumb><div className="ml-auto flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setCommandOpen(true)} aria-label={t('common.search')}><Search className="h-4 w-4" /><span className="hidden sm:inline ml-2">{t('search.placeholder')}</span></Button>{view === 'settings' && <Button size="sm" disabled={!settingsChanged || settingsSaving || !settingsCanSave} onClick={() => void saveSettingsRef.current?.()}><Save className="h-4 w-4 mr-2" />{t(settingsSaving ? 'header.saving' : settingsChanged ? 'header.save' : 'header.saved')}</Button>}</div></header>
        {loadError && <Alert variant="destructive" className="m-4 w-auto"><AlertDescription>{loadError}<Button size="sm" variant="outline" className="ml-3" onClick={loadProjects}>{t('native.refresh')}</Button></AlertDescription></Alert>}
        <main className="flex-1 overflow-auto">{view === 'settings' ? <Settings onSaveRefChange={saveRefChanged} onHasChangesChange={setSettingsChanged} onSavingChange={setSettingsSaving} onCanSaveChange={setSettingsCanSave} /> : view === 'schedules' ? <ScheduledTasks section={scheduleSection} projects={projects} onProjectsChange={loadProjects} onTaskSelect={(selectedProjectId, selectedTaskId) => { const run = projects.find((project) => project.id === selectedProjectId)?.tasks.find((task) => task.id === selectedTaskId); if (run) selectRun(run) }} /> : loading ? <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p> : selectedTask && selectedProject ? <TaskDetail key={selectedTask.id} task={selectedTask} project={selectedProject} onBack={() => { setCaseId(undefined); setRunId(undefined) }} onRepeat={selectedCase ? () => setRunDialog(true) : undefined} onProjectsChange={loadProjects} /> : <TaskContentArea key={projectId} project={selectedProject} onTaskClick={selectRun} onCreateTask={newCase} onCreateProject={() => setProjectDialog(true)} onOpenSettings={() => navigate('settings')} onProjectsChange={loadProjects} />}</main>
      </SidebarInset>
      <CommandMenu projects={projects} open={commandOpen} onOpenChange={setCommandOpen} onSelectProject={selectProject} onSelectTask={selectRun} onSelectSavedTest={selectCase} />

      <ProjectCreateDialog open={projectDialog} onClose={() => setProjectDialog(false)} onProjectCreated={(project) => { selectProject(project); void loadProjects() }} />
      <TaskCreateDialog open={caseDialog} onClose={() => setCaseDialog(false)} projects={projects} selectedProjectId={projectId} onCaseSaved={(testCase) => { setProjectId(testCase.projectId); setCaseId(testCase.id); void loadProjects() }} onRunCreated={selectRun} onProjectsChange={loadProjects} onCreateProject={() => { setCaseDialog(false); setProjectDialog(true) }} />
      <TestRunDialog open={runDialog} testCase={selectedCase} onClose={() => setRunDialog(false)} onRunCreated={selectRun} onProjectsChange={loadProjects} />
    </SidebarProvider>
  )
}

export default function App() {
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const update = (event: MediaQueryList | MediaQueryListEvent) => document.documentElement.classList.toggle('dark', event.matches)
    update(mediaQuery)
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])
  useEffect(() => { void window.electronAPI.configLoad().then((result) => { if (result.success && result.config?.preferences.systemLanguage) return changeLanguage(result.config.preferences.systemLanguage) }).catch((reason) => console.error('[App]', reason)) }, [])
  return <><MainApp /><Toaster /></>
}
