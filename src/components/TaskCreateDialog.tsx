import { useState, useEffect } from 'react'
import { Calendar, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { ModelSelector, ModelSelection } from './ModelSelector'
import type { Platform, Task } from '../types/project'

interface TaskCreateDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  projectName: string
  platform: Platform
  onTaskCreated?: (task: Task) => void
}

export function TaskCreateDialog({
  open,
  onClose,
  projectId,
  projectName,
  platform,
  onTaskCreated,
}: TaskCreateDialogProps) {
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelSelection | undefined>()
  const [runImmediately, setRunImmediately] = useState(true)
  const [loading, setLoading] = useState(false)

  // Load saved model configuration as default
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const result = await window.electronAPI.configLoad()
        if (result.success && result.config?.model) {
          const { provider, model } = result.config.model
          if (provider && model) {
            setSelectedModel({ provider, model })
          }
        }
      } catch (error) {
        console.error('Failed to load saved model config:', error)
      }
    }
    
    if (open) {
      loadSavedConfig()
    }
  }, [open])

  const handleSubmit = async () => {
    if (!goal.trim()) {
      alert('Please enter a task description')
      return
    }

    if (platform === 'web' && !url.trim()) {
      alert('Please enter a URL for web automation')
      return
    }

    setLoading(true)
    try {
      // Always attempt to translate to English (if already English, translator returns as-is)
      let finalGoal = goal.trim()
      console.log('[TaskCreateDialog] Original goal:', finalGoal)

      // Attempt translation to English
      const translateResult = await window.electronAPI.translateText(finalGoal, 'en')
      if (translateResult.success && translateResult.translatedText) {
        finalGoal = translateResult.translatedText
        console.log('[TaskCreateDialog] Translated goal:', finalGoal)
      } else {
        console.warn('[TaskCreateDialog] Translation failed, using original text:', translateResult.error)
      }

      // For Android, prepend instruction to search and open the app first
      const taskGoal =
        platform === 'android'
          ? `Search and open ${projectName} app and follow the prompt below:\n\n${finalGoal}`
          : finalGoal

      const taskInput = {
        projectId,
        name: `Task ${new Date().toLocaleString()}`,
        goal: taskGoal,
        url: platform === 'web' ? url.trim() : undefined,
        // Include model name if user has selected a specific model
        // modelName contains full identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
        modelName: selectedModel?.model,
      }

      const result = await window.electronAPI.taskCreate(taskInput)

      if (result.success && result.task) {
        // If "Run immediately" is checked, start the task
        if (runImmediately) {
          await window.electronAPI.taskStart(projectId, result.task.id)
        }

        onTaskCreated?.(result.task)
        handleClose()
      } else {
        alert(result.error || 'Failed to create task')
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      handleSubmit()
    }
  }

  const handleClose = () => {
    setGoal('')
    setUrl('')
    setRunImmediately(true)
    onClose()
  }

  const isEligible = goal.trim() && (platform === 'android' || url.trim())

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => {
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Input (Web Platform Only) */}
          {platform === 'web' && (
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          {/* Task Description */}
          <div className="space-y-2">
            <Label>Task Description</Label>
            <Textarea
              placeholder={
                platform === 'web'
                  ? 'Describe what you want to automate...\nFor example: "Search for React tutorials and take a screenshot of the top 3 results"\n\nPress Cmd/Ctrl + Enter to submit'
                  : 'Describe what you want to automate on the Android device...\nFor example: "Open Instagram and like the top 5 posts"\n\nPress Cmd/Ctrl + Enter to submit'
              }
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={8}
              className="resize-none font-sans text-base"
            />
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between pt-2">
            {/* Left: Model Selection (Read-only - displays config setting) */}
            <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled />

            {/* Right: Action Buttons */}
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" disabled>
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Schedule task (Coming soon)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button size="sm" onClick={handleSubmit} disabled={!isEligible || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    Run
                    <span className="ml-2 text-xs opacity-60">⌘⏎</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
