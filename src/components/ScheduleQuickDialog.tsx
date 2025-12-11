import { useState, useEffect, useCallback, useRef } from 'react'
import { Moon, Sunrise, Calendar as CalendarIcon, Clock, ChevronLeft } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { format, addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import { toast } from 'sonner'

interface ScheduleQuickDialogProps {
    open: boolean
    onClose: () => void
    onSchedule: (date: Date) => Promise<void>
    /** If true, shows toast on success instead of just closing */
    showToast?: boolean
}

type DialogMode = 'quick' | 'custom'

interface QuickOption {
    id: string
    label: string
    sublabel: string
    icon: React.ElementType
    getDate: () => Date
}

function getQuickOptions(): QuickOption[] {
    const now = new Date()
    const today = startOfDay(now)
    const tomorrow = addDays(today, 1)
    
    // Tonight at 10pm
    const tonight = setMinutes(setHours(today, 22), 0)
    // If it's past 10pm, use tomorrow night
    const tonightDate = tonight.getTime() <= now.getTime() 
        ? setMinutes(setHours(tomorrow, 22), 0) 
        : tonight
    
    // Tomorrow morning at 9am
    const tomorrowMorning = setMinutes(setHours(tomorrow, 9), 0)
    
    // Tomorrow night at 10pm
    const tomorrowNight = setMinutes(setHours(tomorrow, 22), 0)
    
    return [
        {
            id: 'tonight',
            label: tonightDate.getDate() === now.getDate() ? 'Tonight' : 'Tomorrow night',
            sublabel: format(tonightDate, 'MMM d, h:mm a'),
            icon: Moon,
            getDate: () => tonightDate,
        },
        {
            id: 'morning',
            label: 'Next morning',
            sublabel: format(tomorrowMorning, 'MMM d, h:mm a'),
            icon: Sunrise,
            getDate: () => tomorrowMorning,
        },
        {
            id: 'night',
            label: 'Next night',
            sublabel: format(tomorrowNight, 'MMM d, h:mm a'),
            icon: Moon,
            getDate: () => tomorrowNight,
        },
    ]
}

export function ScheduleQuickDialog({ open, onClose, onSchedule, showToast = true }: ScheduleQuickDialogProps) {
    const [mode, setMode] = useState<DialogMode>('quick')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [date, setDate] = useState<Date | undefined>(() => {
        const defaultDate = new Date(Date.now() + 3600000)
        defaultDate.setMinutes(Math.ceil(defaultDate.getMinutes() / 5) * 5, 0, 0)
        return defaultDate
    })
    const [time, setTime] = useState(() => {
        const defaultDate = new Date(Date.now() + 3600000)
        defaultDate.setMinutes(Math.ceil(defaultDate.getMinutes() / 5) * 5)
        return format(defaultDate, 'HH:mm')
    })
    const [loading, setLoading] = useState(false)
    const timeInputRef = useRef<HTMLInputElement>(null)

    const quickOptions = getQuickOptions()
    const totalOptions = quickOptions.length + 1 // +1 for "Pick date & time"

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setMode('quick')
            setSelectedIndex(0)
            // Reset date/time to +1 hour
            const defaultDate = new Date(Date.now() + 3600000)
            defaultDate.setMinutes(Math.ceil(defaultDate.getMinutes() / 5) * 5, 0, 0)
            setDate(defaultDate)
            setTime(format(defaultDate, 'HH:mm'))
        }
    }, [open])

    const handleScheduleSuccess = useCallback((scheduledDate: Date) => {
        if (showToast) {
            toast.success('Task scheduled', {
                description: format(scheduledDate, 'MMM d, yyyy \'at\' h:mm a'),
            })
        }
    }, [showToast])

    const handleClose = useCallback(() => {
        setMode('quick')
        setSelectedIndex(0)
        onClose()
    }, [onClose])

    const handleQuickSelect = useCallback(async (option: QuickOption) => {
        setLoading(true)
        try {
            const scheduledDate = option.getDate()
            await onSchedule(scheduledDate)
            handleScheduleSuccess(scheduledDate)
            handleClose()
        } catch (error) {
            console.error(error)
            toast.error('Failed to schedule task')
        } finally {
            setLoading(false)
        }
    }, [onSchedule, handleScheduleSuccess, handleClose])

    const handleCustomSchedule = useCallback(async () => {
        if (!date || !time) return

        setLoading(true)
        try {
            const [hours, minutes] = time.split(':').map(Number)
            const scheduledDate = new Date(date)
            scheduledDate.setHours(hours, minutes, 0, 0)

            if (scheduledDate.getTime() <= Date.now()) {
                toast.error('Please select a future date and time')
                setLoading(false)
                return
            }

            await onSchedule(scheduledDate)
            handleScheduleSuccess(scheduledDate)
            handleClose()
        } catch (error) {
            console.error(error)
            toast.error('Failed to schedule task')
        } finally {
            setLoading(false)
        }
    }, [date, time, onSchedule, handleScheduleSuccess, handleClose])

    const handleOpenChange = useCallback((isOpen: boolean) => {
        if (!isOpen) {
            handleClose()
        }
    }, [handleClose])

    // Keyboard navigation
    useEffect(() => {
        if (!open) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (mode === 'quick') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIndex(prev => Math.min(prev + 1, totalOptions - 1))
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIndex(prev => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                    // Only handle plain Enter (no modifiers) to avoid conflict with ⌥⌘⏎
                    e.preventDefault()
                    if (selectedIndex < quickOptions.length) {
                        handleQuickSelect(quickOptions[selectedIndex])
                    } else {
                        setMode('custom')
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault()
                    handleClose()
                }
            } else if (mode === 'custom') {
                if (e.key === 'Escape') {
                    e.preventDefault()
                    setMode('quick')
                } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleCustomSchedule()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [open, mode, selectedIndex, quickOptions, totalOptions, handleClose, handleCustomSchedule, handleQuickSelect])

    // Focus time input when switching to custom mode
    useEffect(() => {
        if (mode === 'custom' && timeInputRef.current) {
            setTimeout(() => timeInputRef.current?.focus(), 100)
        }
    }, [mode])

    const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone
        .split('/').pop()?.replace(/_/g, ' ') || 'Local Time'

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className={cn(
                "p-0 gap-0",
                mode === 'quick' ? "sm:max-w-[320px]" : "sm:max-w-[500px]"
            )}>
                {mode === 'quick' ? (
                    <>
                        <DialogHeader className="p-4 pb-2">
                            <DialogTitle className="text-lg font-semibold">Schedule Task</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">{timezoneName}</DialogDescription>
                        </DialogHeader>
                        
                        <div className="flex flex-col pb-2">
                            {quickOptions.map((option, index) => (
                                <button
                                    key={option.id}
                                    onClick={() => handleQuickSelect(option)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    disabled={loading}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 transition-colors text-left disabled:opacity-50",
                                        selectedIndex === index ? "bg-muted" : "hover:bg-muted/50"
                                    )}
                                >
                                    <option.icon className="h-5 w-5 text-muted-foreground" />
                                    <div className="flex-1">
                                        <div className="font-medium">{option.label}</div>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {option.sublabel}
                                    </span>
                                </button>
                            ))}
                            
                            <button
                                onClick={() => setMode('custom')}
                                onMouseEnter={() => setSelectedIndex(quickOptions.length)}
                                disabled={loading}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 transition-colors text-left border-t disabled:opacity-50",
                                    selectedIndex === quickOptions.length ? "bg-muted" : "hover:bg-muted/50"
                                )}
                            >
                                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">Pick date & time</span>
                            </button>
                        </div>
                        
                        <div className="px-4 pb-3 text-xs text-muted-foreground flex items-center gap-1">
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
                            <span>navigate</span>
                            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] ml-2">↵</kbd>
                            <span>select</span>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader className="p-4 pb-0">
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setMode('quick')}
                                    className="h-8 w-8 p-0"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <DialogTitle className="text-lg font-semibold">Pick date & time</DialogTitle>
                            </div>
                            <DialogDescription className="sr-only">Select a custom date and time to schedule your task</DialogDescription>
                        </DialogHeader>
                        
                        <div className="p-4 pt-2">
                            <div className="flex gap-4">
                                {/* Calendar */}
                                <div className="border rounded-lg p-2">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        disabled={(d: Date) => d < startOfDay(new Date())}
                                        className="p-0"
                                    />
                                </div>
                                
                                {/* Date & Time Display */}
                                <div className="flex flex-col gap-3 flex-1 min-w-[140px]">
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-muted-foreground">Date</Label>
                                        <div className="h-10 px-3 py-2 border rounded-md bg-muted/30 flex items-center text-sm">
                                            {date ? format(date, 'MMM d, yyyy') : 'Select date'}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-1.5">
                                        <Label className="text-xs text-muted-foreground">Time</Label>
                                        <div className="relative">
                                            <input
                                                ref={timeInputRef}
                                                type="time"
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                                value={time}
                                                onChange={(e) => setTime(e.target.value)}
                                            />
                                            <Clock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1" />
                                    
                                    <div className="text-xs text-muted-foreground">
                                        <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘↵</kbd>
                                        <span className="ml-1">to confirm</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* Footer */}
                        <div className="flex justify-end gap-2 p-4 pt-0">
                            <Button variant="ghost" onClick={() => setMode('quick')} disabled={loading}>
                                Back
                            </Button>
                            <Button onClick={handleCustomSchedule} disabled={loading || !date || !time}>
                                {loading ? 'Scheduling...' : 'Schedule'}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
