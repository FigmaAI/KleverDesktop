import { useState, useEffect } from 'react'
import { Calendar, Loader2, Plus, Smartphone, Globe } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Label } from '@/components/ui/label'
import { ModelSelector, ModelSelection } from './ModelSelector'
import type { Task, Project } from '../types/project'

interface TaskCreateDialogProps {
  open: boolean
  onClose: () => void
  projects: Project[]
  selectedProjectId?: string
  onTaskCreated?: (task: Task) => void
  onCreateProject?: () => void
}

export function TaskCreateDialog({
  open,
  onClose,
  projects,
  selectedProjectId,
  onTaskCreated,
  onCreateProject,
}: TaskCreateDialogProps) {
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [selectedModel, setSelectedModel] = useState<ModelSelection | undefined>()
  const [registeredProviders, setRegisteredProviders] = useState<string[]>([])
  const [runImmediately, setRunImmediately] = useState(true)
  const [loading, setLoading] = useState(false)
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(selectedProjectId)

  // Get current project
  const currentProject = projects.find(p => p.id === currentProjectId)
  const platform = currentProject?.platform || 'android'
  const projectName = currentProject?.name || ''

  // Update currentProjectId when selectedProjectId changes (only if provided)
  useEffect(() => {
    if (selectedProjectId) {
      setCurrentProjectId(selectedProjectId)
    }
  }, [selectedProjectId])

  // Load saved model configuration (multi-provider format)
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const result = await window.electronAPI.configLoad()
        if (result.success && result.config?.model) {
          const { providers, lastUsed } = result.config.model
          
          // Set registered providers for filtering
          if (providers && providers.length > 0) {
            setRegisteredProviders(providers.map(p => p.id))
            
            // Use lastUsed if available, otherwise use first provider
            if (lastUsed?.provider && lastUsed?.model) {
              setSelectedModel({ provider: lastUsed.provider, model: lastUsed.model })
            } else {
              const firstProvider = providers[0]
              setSelectedModel({ 
                provider: firstProvider.id, 
                model: firstProvider.preferredModel 
              })
            }
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
    if (!currentProjectId) {
      alert('Please select a project')
      return
    }

    if (!goal.trim()) {
      alert('Please enter a task description')
      return
    }

    if (platform === 'web' && !url.trim()) {
      alert('Please enter a URL for web automation')
      return
    }

    if (!selectedModel?.provider || !selectedModel?.model) {
      alert('Please select a model')
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
        projectId: currentProjectId,
        name: `Task ${new Date().toLocaleString()}`,
        goal: taskGoal,
        url: platform === 'web' ? url.trim() : undefined,
        // Include provider and model for task execution
        modelProvider: selectedModel.provider,
        modelName: selectedModel.model,
      }

      const result = await window.electronAPI.taskCreate(taskInput)

      if (result.success && result.task) {
        // Update lastUsed in config
        try {
          await window.electronAPI.configUpdateLastUsed({
            provider: selectedModel.provider,
            model: selectedModel.model,
          })
        } catch (error) {
          console.warn('[TaskCreateDialog] Failed to update lastUsed:', error)
        }

        // If "Run immediately" is checked, start the task
        if (runImmediately) {
          await window.electronAPI.taskStart(currentProjectId, result.task.id)
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

  const isEligible = currentProjectId && goal.trim() && (platform === 'android' || url.trim()) && selectedModel?.model

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
          <DialogDescription className="sr-only">
            Create a new automation task for your project. Select a project, enter a task description, and choose a model to run the task.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={currentProjectId || ''} onValueChange={(value) => {
              if (value === '__create_new__') {
                onCreateProject?.()
              } else {
                setCurrentProjectId(value)
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => {
                  const PlatformIcon = project.platform === 'android' ? Smartphone : Globe
                  return (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="flex items-center gap-2">
                        <PlatformIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span>{project.name}</span>
                      </span>
                    </SelectItem>
                  )
                })}
                {onCreateProject && (
                  <>
                    {projects.length > 0 && <div className="h-px bg-border my-1" />}
                    <SelectItem value="__create_new__" className="text-primary">
                      <span className="flex items-center gap-2">
                        <Plus className="h-3 w-3" />
                        Create new project
                      </span>
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

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
            {/* Left: Model Selection - now editable with registered providers filter */}
            <ModelSelector 
              value={selectedModel} 
              onChange={setSelectedModel}
              registeredProviders={registeredProviders.length > 0 ? registeredProviders : undefined}
            />

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
