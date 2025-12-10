import { useState, useEffect, useMemo } from 'react'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import type { ScheduledTask } from '@/types/schedule'

type ScheduleSection = 'active' | 'history'

interface ScheduledTasksProps {
    section: ScheduleSection
}

export function ScheduledTasks({ section }: ScheduledTasksProps) {
    const [schedules, setSchedules] = useState<ScheduledTask[]>([])
    const [projects, setProjects] = useState<{ id: string; name: string; tasks: { id: string; name?: string; goal?: string }[] }[]>([])

    const loadData = async () => {
        try {
            const [scheduleResult, projectResult] = await Promise.all([
                window.electronAPI.scheduleList(),
                window.electronAPI.projectList()
            ])

            if (scheduleResult.success && scheduleResult.schedules) {
                setSchedules(scheduleResult.schedules)
            }

            if (projectResult.success && projectResult.projects) {
                setProjects(projectResult.projects)
            }
        } catch (error) {
            console.error('Failed to load schedules:', error)
        }
    }

    // Load schedules on mount and subscribe to updates
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        loadData()

        const handleUpdate = () => loadData()

        window.electronAPI.onScheduleAdded(handleUpdate)
        window.electronAPI.onScheduleStarted(handleUpdate)
        window.electronAPI.onScheduleCompleted(handleUpdate)
        window.electronAPI.onScheduleCancelled(handleUpdate)
    }, [])

    const handleCancel = async (scheduleId: string) => {
        if (!confirm('Are you sure you want to cancel this scheduled task?')) return
        await window.electronAPI.scheduleCancel(scheduleId)
    }

    const getTaskInfo = (projectId: string, taskId: string) => {
        const project = projects.find(p => p.id === projectId)
        const task = project?.tasks.find((t) => t.id === taskId)
        return {
            projectName: project?.name || 'Unknown Project',
            taskName: task?.name || task?.goal || 'Unknown Task',
        }
    }

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString)
        return {
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    }

    // Split schedules into active (pending/running) and completed (completed/failed/cancelled)
    const activeSchedules = useMemo(() =>
        schedules.filter(s => s.status === 'pending' || s.status === 'running')
            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
        [schedules]
    )

    const completedSchedules = useMemo(() =>
        schedules.filter(s => ['completed', 'failed', 'cancelled'].includes(s.status))
            .sort((a, b) => new Date(b.completedAt || b.scheduledAt).getTime() - new Date(a.completedAt || a.scheduledAt).getTime()),
        [schedules]
    )

    const getStatusConfig = (status: ScheduledTask['status']) => {
        switch (status) {
            case 'pending':
                return { label: 'Scheduled', icon: Clock, variant: 'secondary' as const }
            case 'running':
                return { label: 'Running', icon: Play, variant: 'default' as const }
            case 'completed':
                return { label: 'Completed', icon: CheckCircle, variant: 'default' as const, className: 'border-green-500/50 text-green-500 bg-green-500/10' }
            case 'failed':
                return { label: 'Failed', icon: AlertCircle, variant: 'destructive' as const }
            case 'cancelled':
                return { label: 'Cancelled', icon: XCircle, variant: 'secondary' as const }
            default:
                return { label: 'Unknown', icon: Clock, variant: 'secondary' as const }
        }
    }

    const ScheduleTable = ({ items, showActions = false }: { items: ScheduledTask[], showActions?: boolean }) => (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="min-w-[250px]">Task</TableHead>
                        <TableHead className="w-[150px]">Project</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[150px]">Scheduled</TableHead>
                        <TableHead className="w-[80px]">Mode</TableHead>
                        {showActions && <TableHead className="w-[80px]">Actions</TableHead>}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={showActions ? 6 : 5} className="h-24 text-center text-muted-foreground">
                                No scheduled tasks
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map(schedule => {
                            const { projectName, taskName } = getTaskInfo(schedule.projectId, schedule.taskId)
                            const { date, time } = formatDateTime(schedule.scheduledAt)
                            const statusConfig = getStatusConfig(schedule.status)
                            const StatusIcon = statusConfig.icon

                            return (
                                <TableRow key={schedule.id}>
                                    <TableCell>
                                        <span className="font-medium line-clamp-1">{taskName}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {projectName}
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={statusConfig.variant}
                                            className={`flex items-center gap-1 w-fit ${statusConfig.className || ''}`}
                                        >
                                            <StatusIcon className={`h-3 w-3 ${schedule.status === 'running' ? 'animate-pulse' : ''}`} />
                                            {statusConfig.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{time}</span>
                                            <span className="text-xs text-muted-foreground">{date}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {schedule.silent ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <Badge variant="outline" className="text-xs">Silent</Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        Runs in background without terminal
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <Badge variant="outline" className="text-xs">Normal</Badge>
                                        )}
                                    </TableCell>
                                    {showActions && (
                                        <TableCell>
                                            {schedule.status === 'pending' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleCancel(schedule.id)}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                            {schedule.status === 'failed' && schedule.error && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-xs break-words">{schedule.error}</p>
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
                                : 'Completed and past scheduled tasks'}
                        </p>
                    </div>
                </div>
            </BlurFade>

            <BlurFade delay={0.2}>
                <div className="flex-1 p-6">
                    {section === 'active' ? (
                        <ScheduleTable items={activeSchedules} showActions={true} />
                    ) : (
                        <ScheduleTable items={completedSchedules} showActions={false} />
                    )}
                </div>
            </BlurFade>
        </div>
    )
}
