import { useState } from 'react'
import { Calendar } from '@/components/ui/calendar'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Clock, Calendar as CalendarIcon, Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ScheduleDialogProps {
    open: boolean
    onClose: () => void
    onSchedule: (date: Date, silent: boolean) => Promise<void>
    taskName: string
}

export function ScheduleDialog({ open, onClose, onSchedule, taskName }: ScheduleDialogProps) {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [time, setTime] = useState(format(new Date(Date.now() + 3600000), 'HH:mm')) // Default 1 hour later
    const [silent, setSilent] = useState(true)
    const [loading, setLoading] = useState(false)

    const handleSchedule = async () => {
        if (!date || !time) return

        setLoading(true)
        try {
            const [hours, minutes] = time.split(':').map(Number)
            const scheduledDate = new Date(date)
            scheduledDate.setHours(hours, minutes, 0, 0)

            // Ensure future date
            if (scheduledDate.getTime() <= Date.now()) {
                alert('Please select a future date and time')
                setLoading(false)
                return
            }

            await onSchedule(scheduledDate, silent)
            onClose()
        } catch (error) {
            console.error(error)
            alert('Failed to schedule task')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Schedule Task</DialogTitle>
                    <DialogDescription>
                        Schedule &ldquo;{taskName}&rdquo; to run automatically later.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">

                    {/* Date Picker */}
                    <div className="flex flex-col gap-2">
                        <Label>Date</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={setDate}
                                    initialFocus
                                    disabled={(d: Date) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Time Picker (Simple input) */}
                    <div className="flex flex-col gap-2">
                        <Label>Time</Label>
                        <div className="relative">
                            <input
                                type="time"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                            />
                            <Clock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                        </div>
                    </div>

                    {/* Silent Mode Toggle */}
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Label className="text-base">Silent Mode</Label>
                                <div title="Don't open terminal automatically. Output is still saved.">
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Run in background without opening terminal
                            </p>
                        </div>
                        <Switch
                            checked={silent}
                            onCheckedChange={setSilent}
                        />
                    </div>

                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button onClick={handleSchedule} disabled={loading || !date || !time}>
                        {loading ? 'Scheduling...' : 'Schedule Task'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
