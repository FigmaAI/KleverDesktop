import { useTranslation } from 'react-i18next'
import { FileText, FolderKanban } from 'lucide-react'
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import type { Project, Task, TestCase } from '@/types/project'

interface CommandMenuProps { projects: Project[]; open: boolean; onOpenChange: (open: boolean) => void; onSelectProject: (project: Project) => void; onSelectTask: (task: Task) => void; onSelectSavedTest: (testCase: TestCase) => void }
export function CommandMenu({ projects, open, onOpenChange, onSelectProject, onSelectTask, onSelectSavedTest }: CommandMenuProps) {
  const { t } = useTranslation()
  const unusedTests = projects.flatMap((project) => (project.testCases || []).filter((testCase) => !testCase.archived && !project.tasks.some((task) => task.testCaseId === testCase.id)))
  return <CommandDialog open={open} onOpenChange={onOpenChange}><CommandInput placeholder={t('search.searchProjectsTasks')} /><CommandList><CommandEmpty>{t('search.noResults')}</CommandEmpty><CommandGroup heading={t('nav.projects')}>{projects.map((project) => <CommandItem key={project.id} value={`project ${project.name}`} onSelect={() => { onSelectProject(project); onOpenChange(false) }}><FolderKanban className="mr-2 h-4 w-4" />{project.name}</CommandItem>)}</CommandGroup><CommandGroup heading={t('search.tasks')}>{projects.flatMap((project) => project.tasks.map((task) => <CommandItem key={task.id} value={`task ${task.name} ${task.goal} ${project.name}`} onSelect={() => { onSelectTask(task); onOpenChange(false) }}><FileText className="mr-2 h-4 w-4" /><span className="flex-1">{task.goal || task.description || task.name}</span><span className="text-xs text-muted-foreground">{project.name}</span></CommandItem>))}</CommandGroup>{unusedTests.length > 0 && <CommandGroup heading={t('report.savedTests')}>{unusedTests.map((testCase) => <CommandItem key={testCase.id} value={`saved ${testCase.name} ${testCase.goal}`} onSelect={() => { onSelectSavedTest(testCase); onOpenChange(false) }}><FileText className="mr-2 h-4 w-4" />{testCase.name}</CommandItem>)}</CommandGroup>}</CommandList></CommandDialog>
}
