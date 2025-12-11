import { useMemo } from 'react'
import { Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { BlurFade } from '@/components/magicui/blur-fade'
import { TaskStatusBadge } from '@/components/TaskStatusBadge'
import type { Project, Task } from '@/types/project'

type ScheduleSection = 'active' | 'history'

interface ScheduledTasksProps {
    section: ScheduleSection
    projects: Project[]
    onTaskSelect?: (projectId: string, taskId: string) => void
    onProjectsChange?: () => void
}

interface ScheduledTaskInfo {
    projectId: string
    projectName: string
    task: Task
}

const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return {
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
}

interface ScheduleTableProps {
    items: ScheduledTaskInfo[]
    showActions: boolean
    onCancel: (projectId: string, taskId: string) => void
    onTaskSelect?: (projectId: string, taskId: string) => void
}

function ScheduleTable({ items, showActions, onCancel, onTaskSelect }: ScheduleTableProps) {
    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[250px]">Task</TableHead>
                        <TableHead className="w-[150px]">Project</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[150px]">Scheduled</TableHead>
                        {showActions && <TableHead className="w-[80px]">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={showActions ? 5 : 4} className="h-24 text-center text-muted-foreground">
                                No scheduled tasks
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map(({ projectId, projectName, task }) => {
                            const { date, time } = formatDateTime(task.scheduledAt!)

                            return (
                                <TableRow 
                                    key={task.id}
                                    className={onTaskSelect ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}
                                    onClick={() => onTaskSelect?.(projectId, task.id)}
                                >
                                    <TableCell>
                                        <span className="font-medium line-clamp-1">
                                            {task.name || task.goal || 'Untitled Task'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {projectName}
                                    </TableCell>
                                    <TableCell>
                                        <TaskStatusBadge status={task.status} />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{time}</span>
                                            <span className="text-xs text-muted-foreground">{date}</span>
                                        </div>
                                    </TableCell>
                                    {showActions && (
                                        <TableCell>
                                            {task.status === 'pending' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onCancel(projectId, task.id)
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                            {task.status === 'failed' && task.error && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-xs break-words">{task.error}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

export function ScheduledTasks({ section, projects, onTaskSelect, onProjectsChange }: ScheduledTasksProps) {
    // Derive scheduled tasks from projects - no separate API call needed
    const scheduledTasks = useMemo<ScheduledTaskInfo[]>(() => {
        const tasks: ScheduledTaskInfo[] = []
        
        for (const project of projects) {
            for (const task of project.tasks) {
                if (task.scheduledAt) {
                    tasks.push({
                        projectId: project.id,
                        projectName: project.name,
                        task
                    })
                }
            }
        }
        
        // Sort by scheduledAt
        return tasks.sort((a, b) => 
            new Date(a.task.scheduledAt!).getTime() - new Date(b.task.scheduledAt!).getTime()
        )
    }, [projects])

    const handleCancel = async (projectId: string, taskId: string) => {
        if (!confirm('Are you sure you want to cancel this scheduled task?')) return
        await window.electronAPI.scheduleCancel(projectId, taskId)
        onProjectsChange?.()
    }

    // Split tasks into active (pending/running) and completed (completed/failed/cancelled)
    const activeTasks = useMemo(() =>
        scheduledTasks.filter(item => item.task.status === 'pending' || item.task.status === 'running')
            .sort((a, b) => new Date(a.task.scheduledAt!).getTime() - new Date(b.task.scheduledAt!).getTime()),
        [scheduledTasks]
    )

    const completedTasks = useMemo(() =>
        scheduledTasks.filter(item => ['completed', 'failed', 'cancelled'].includes(item.task.status))
            .sort((a, b) => new Date(b.task.completedAt || b.task.scheduledAt!).getTime() - new Date(a.task.completedAt || a.task.scheduledAt!).getTime()),
        [scheduledTasks]
    )

    return (
        <div className="flex flex-col h-full bg-background">
            <BlurFade delay={0.1}>
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Calendar className="h-6 w-6" />
                            {section === 'active' ? 'Active & Upcoming' : 'History'}
                        </h1>
                        <p className="text-muted-foreground">
                            {section === 'active'
                                ? 'Tasks scheduled to run'
                                : 'Completed scheduled tasks'}
                        </p>
                    </div>
                </div>
            </BlurFade>

            <BlurFade delay={0.2}>
                <div className="flex-1 p-6">
                    {section === 'active' ? (
                        <ScheduleTable 
                            items={activeTasks} 
                            showActions={true}
                            onCancel={handleCancel}
                            onTaskSelect={onTaskSelect}
                        />
                    ) : (
                        <ScheduleTable 
                            items={completedTasks} 
                            showActions={false}
                            onCancel={handleCancel}
                            onTaskSelect={onTaskSelect}
                        />
                    )}
                </div>
            </BlurFade>
        </div>
    )
}
