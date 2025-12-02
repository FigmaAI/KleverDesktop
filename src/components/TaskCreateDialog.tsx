import { useState, useEffect } from 'react'
import { Calendar, Loader2, Plus, Smartphone, Globe, FileBox, X, Info } from 'lucide-react'
import PlayStoreIcon from '@/assets/play-store.svg?react'
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { ModelSelector, ModelSelection } from './ModelSelector'
import type { Task, Project, ApkSourceType, ApkSource } from '../types/project'

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
  const [maxRounds, setMaxRounds] = useState<number>(20)
  const [globalMaxRounds, setGlobalMaxRounds] = useState<number>(20)

  // APK Source state (Android only) - Required
  const [apkSourceType, setApkSourceType] = useState<ApkSourceType>('play_store_url')
  const [apkFilePath, setApkFilePath] = useState('')
  const [playStoreUrl, setPlayStoreUrl] = useState('')
  const [extractedPackageName, setExtractedPackageName] = useState('')

  // Get current project
  const currentProject = projects.find(p => p.id === currentProjectId)
  const platform = currentProject?.platform || 'android'

  // Update currentProjectId when selectedProjectId changes (only if provided)
  useEffect(() => {
    if (selectedProjectId) {
      setCurrentProjectId(selectedProjectId)
    }
  }, [selectedProjectId])

  // Load last used APK source when project changes
  useEffect(() => {
    if (currentProject?.lastApkSource && currentProject.platform === 'android') {
      const { type, path, url, packageName } = currentProject.lastApkSource
      setApkSourceType(type)
      if (type === 'apk_file' && path) {
        setApkFilePath(path)
      } else if (type === 'play_store_url' && url) {
        setPlayStoreUrl(url)
      }
      if (packageName) {
        setExtractedPackageName(packageName)
      }
    } else {
      // Reset to defaults if no last APK source
      setApkSourceType('play_store_url')
      setApkFilePath('')
      setPlayStoreUrl('')
      setExtractedPackageName('')
    }
  }, [currentProject])

  // Load saved model configuration (multi-provider format)
  useEffect(() => {
    const loadSavedConfig = async () => {
      try {
        const result = await window.electronAPI.configLoad()
        if (result.success && result.config) {
          // Load model configuration
          if (result.config.model) {
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
          
          // Load execution configuration for max rounds
          if (result.config.execution?.maxRounds) {
            const globalMaxRounds = result.config.execution.maxRounds
            setGlobalMaxRounds(globalMaxRounds)
            setMaxRounds(globalMaxRounds)
          }
        }
      } catch (error) {
        console.error('Failed to load saved config:', error)
      }
    }
    
    if (open) {
      loadSavedConfig()
    }
  }, [open])

  const handleSelectApkFile = async () => {
    const result = await window.electronAPI.apkSelectFile()
    if (result.success && result.path) {
      setApkFilePath(result.path)
      setExtractedPackageName('')
    }
  }

  const handlePlayStoreUrlChange = async (inputUrl: string) => {
    setPlayStoreUrl(inputUrl)
    setExtractedPackageName('')
    
    if (inputUrl && inputUrl.includes('play.google.com')) {
      const result = await window.electronAPI.playstoreParseUrl(inputUrl)
      if (result.success && result.packageName) {
        setExtractedPackageName(result.packageName)
      }
    }
  }

  const buildApkSource = (): ApkSource | undefined => {
    if (platform !== 'android') return undefined
    
    if (apkSourceType === 'apk_file' && apkFilePath) {
      return {
        type: 'apk_file',
        path: apkFilePath,
        packageName: extractedPackageName || undefined
      }
    } else if (apkSourceType === 'play_store_url' && playStoreUrl) {
      return {
        type: 'play_store_url',
        url: playStoreUrl,
        packageName: extractedPackageName || undefined
      }
    }
    
    return undefined
  }

  // Check if APK source is valid (required for Android)
  const isApkSourceValid = () => {
    if (platform !== 'android') return true
    if (apkSourceType === 'apk_file') return !!apkFilePath
    if (apkSourceType === 'play_store_url') return !!playStoreUrl
    return false
  }

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

    if (platform === 'android' && !isApkSourceValid()) {
      alert('Please provide an APK file or Play Store URL')
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

      const taskInput = {
        projectId: currentProjectId,
        name: `Task ${new Date().toLocaleString()}`,
        goal: finalGoal,
        url: platform === 'web' ? url.trim() : undefined,
        apkSource: buildApkSource(),
        // Include provider and model for task execution
        modelProvider: selectedModel.provider,
        modelName: selectedModel.model,
        // Include max rounds if different from global default
        maxRounds: maxRounds !== globalMaxRounds ? maxRounds : undefined,
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
    setApkSourceType('play_store_url')
    setApkFilePath('')
    setPlayStoreUrl('')
    setExtractedPackageName('')
    setRunImmediately(true)
    setMaxRounds(globalMaxRounds)
    onClose()
  }

  const isEligible = currentProjectId && 
    goal.trim() && 
    (platform === 'web' ? url.trim() : isApkSourceValid()) && 
    selectedModel?.model

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
                // APK source will be loaded from project.lastApkSource by useEffect
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
              <Label>Website URL <span className="text-destructive">*</span></Label>
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}

          {/* APK Source (Android Platform Only) - Required */}
          {platform === 'android' && (
            <div className="space-y-2">
              <Label>App Source <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground -mt-1">
                The app will be installed (if needed) and launched before running the task
              </p>
              
              {/* Styled Container for Radio Group */}
              <div className="rounded-lg border bg-muted/30 p-2">
                <RadioGroup
                  value={apkSourceType}
                  onValueChange={(value) => setApkSourceType(value as ApkSourceType)}
                  className="gap-1"
                >
                  {/* Play Store URL Option - Wrapper */}
                  <div 
                    className={`rounded-md transition-colors ${apkSourceType === 'play_store_url' ? 'bg-background shadow-sm' : 'hover:bg-background/40'}`}
                  >
                    <label 
                      htmlFor="task_play_store_url" 
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <RadioGroupItem value="play_store_url" id="task_play_store_url" />
                      <PlayStoreIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Google Play Store URL</span>
                    </label>
                    
                    {/* Play Store URL Input */}
                    {apkSourceType === 'play_store_url' && (
                      <div className="px-3 pb-3 pt-0 ml-7 space-y-1.5">
                        <Input
                          value={playStoreUrl}
                          onChange={(e) => handlePlayStoreUrlChange(e.target.value)}
                          placeholder="https://play.google.com/store/apps/details?id=..."
                          className="text-sm h-8"
                        />
                        {extractedPackageName && (
                          <p className="text-xs text-muted-foreground">
                            Package: <span className="font-mono text-foreground">{extractedPackageName}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* APK File Option - Wrapper */}
                  <div 
                    className={`rounded-md transition-colors ${apkSourceType === 'apk_file' ? 'bg-background shadow-sm' : 'hover:bg-background/40'}`}
                  >
                    <label 
                      htmlFor="task_apk_file" 
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                    >
                      <RadioGroupItem value="apk_file" id="task_apk_file" />
                      <FileBox className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">APK File</span>
                    </label>
                    
                    {/* APK File Input */}
                    {apkSourceType === 'apk_file' && (
                      <div className="px-3 pb-3 pt-0 ml-7 flex gap-2">
                        <Input
                          readOnly
                          value={apkFilePath}
                          placeholder="Select an APK file..."
                          className="flex-1 text-sm h-8"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectApkFile}
                          className="h-8"
                        >
                          Browse
                        </Button>
                        {apkFilePath && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setApkFilePath('')}
                            className="h-8 px-2"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Task Description */}
          <div className="space-y-2">
            <Label>Task Description <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder={
                platform === 'web'
                  ? 'Describe what you want to automate...\nFor example: "Search for React tutorials and take a screenshot of the top 3 results"\n\nPress Cmd/Ctrl + Enter to submit'
                  : 'Describe what you want to automate on the Android app...\nFor example: "Like the top 5 posts on the home feed"\n\nPress Cmd/Ctrl + Enter to submit'
              }
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="resize-none font-sans text-base"
            />
          </div>

          {/* Max Rounds Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-medium">Max Rounds</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Prevents infinite loops and limits automation attempts</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum number of exploration rounds before stopping
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Global default: {globalMaxRounds}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-semibold text-muted-foreground cursor-help">
                      {maxRounds} {maxRounds === globalMaxRounds && '(default)'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Current setting: {maxRounds} rounds</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Global default: {globalMaxRounds}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Slider
              value={[maxRounds]}
              onValueChange={(value) => setMaxRounds(value[0])}
              min={5}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5 rounds</span>
              <span>50 rounds</span>
            </div>
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
