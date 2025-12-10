import { useEffect, useState, useCallback, useRef } from 'react'
import { FolderOpen, RefreshCw, ExternalLink, Loader2, ArrowLeft, Play, StopCircle, Trash2, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { LanguageSelector } from './LanguageSelector'
import { BlurFade } from '@/components/magicui/blur-fade'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Task, Project } from '@/types/project'

interface TaskDetailProps {
  task: Task
  project: Project
  onBack: () => void
  onProjectsChange: () => void
}

// Component to load and display images from file system
function MarkdownImage({ src, alt, baseDir }: { src?: string; alt?: string; baseDir?: string }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!src) {
      setLoading(false)
      return
    }

    // Skip if already a data URL or HTTP URL
    if (src.startsWith('data:') || src.startsWith('http')) {
      setImageSrc(src)
      setLoading(false)
      return
    }

    // Load image from file system
    const loadImage = async () => {
      try {
        const result = await window.electronAPI.fileReadImage(src, baseDir)
        if (result?.success && result.dataUrl) {
          setImageSrc(result.dataUrl)
          setError(null)
        } else {
          setError(result?.error || 'Failed to load image')
          setImageSrc(null)
        }
      } catch (err) {
        console.error('Failed to load image:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setImageSrc(null)
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [src, baseDir])

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 my-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading image...</span>
      </span>
    )
  }

  if (error && !imageSrc) {
    return (
      <span className="inline-block p-4 border border-destructive rounded-md my-4">
        <span className="block text-sm text-destructive">{error}</span>
        <span className="block text-xs text-muted-foreground mt-1">{src}</span>
      </span>
    )
  }

  return (
    <img
      src={imageSrc || undefined}
      alt={alt}
      className="max-w-full max-h-[512px] h-auto object-contain"
    />
  )
}

export function TaskDetail({
  task,
  project,
  onBack,
  onProjectsChange,
}: TaskDetailProps) {
  const [content, setContent] = useState<string>('')
  const [translatedContent, setTranslatedContent] = useState<string>('')
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en')
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationModel, setTranslationModel] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdownPath, setMarkdownPath] = useState<string>('')
  const [markdownDir, setMarkdownDir] = useState<string>('')
  const contentBoxRef = useRef<HTMLDivElement>(null)
  const translationCancelledRef = useRef(false)

  const taskName = task.name || task.goal

  const loadMarkdown = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Construct markdown file path
      let mdPath: string

      if (task.resultPath) {
        const taskDirName = task.resultPath.split(/[/\\]/).filter(Boolean).pop() || ''
        const normalizedPath = task.resultPath.replace(/\\/g, '/')
        mdPath = `${normalizedPath}/log_report_${taskDirName}.md`
      } else {
        const normalizedWorkspace = project.workspaceDir.replace(/\\/g, '/')
        mdPath = `${normalizedWorkspace}/${taskName.replace(/\s+/g, '_')}.md`
      }

      setMarkdownPath(mdPath)

      const normalizedMdPath = mdPath.replace(/\\/g, '/')
      const lastSlash = normalizedMdPath.lastIndexOf('/')
      const baseDir = lastSlash > 0 ? normalizedMdPath.substring(0, lastSlash) : normalizedMdPath
      setMarkdownDir(baseDir)

      const existsResult = await window.electronAPI.fileExists(mdPath)

      if (!existsResult.success || !existsResult.exists) {
        setError('Markdown file not found. The task may not have generated output yet. Press ⌘R to refresh.')
        setContent('')
      } else {
        const readResult = await window.electronAPI.fileRead(mdPath)

        if (readResult.success && readResult.content) {
          setContent(readResult.content)
          setError(null)
        } else {
          setError(readResult.error || 'Failed to read markdown file')
          setContent('')
        }
      }
    } catch (err) {
      console.error('Error loading markdown:', err)
      setError('Failed to load markdown file')
      setContent('')
    } finally {
      setLoading(false)
    }
  }, [task.resultPath, project.workspaceDir, taskName])

  // Translate markdown content when language changes
  const handleLanguageChange = useCallback(async (lang: string) => {
    setSelectedLanguage(lang)

    if (lang === 'en' || !content) {
      setTranslatedContent('')
      setTranslationModel('')
      return
    }

    // Reset cancellation flag
    translationCancelledRef.current = false

    // Get current model info for display
    try {
      const configResult = await window.electronAPI.configLoad()
      if (configResult.success && configResult.config?.model?.lastUsed) {
        const { provider, model } = configResult.config.model.lastUsed
        setTranslationModel(`${provider}/${model}`)
      } else if (configResult.success && configResult.config?.model?.providers?.[0]) {
        const firstProvider = configResult.config.model.providers[0]
        setTranslationModel(`${firstProvider.id}/${firstProvider.preferredModel}`)
      }
    } catch {
      setTranslationModel('AI Model')
    }

    setIsTranslating(true)
    try {
      const result = await window.electronAPI.translateMarkdown(content, lang)
      
      // Check if cancelled during translation
      if (translationCancelledRef.current) {
        setTranslatedContent('')
        return
      }

      if (result.success && result.translatedText) {
        setTranslatedContent(result.translatedText)
      } else {
        console.error('Translation failed:', result.error)
        setTranslatedContent('')
      }
    } catch (err) {
      console.error('Translation error:', err)
      setTranslatedContent('')
    } finally {
      setIsTranslating(false)
      setTranslationModel('')
    }
  }, [content])

  // Cancel translation
  const handleCancelTranslation = useCallback(() => {
    translationCancelledRef.current = true
    setIsTranslating(false)
    setTranslationModel('')
    setSelectedLanguage('en')
    setTranslatedContent('')
  }, [])

  useEffect(() => {
    loadMarkdown()
    setSelectedLanguage('en')
    setTranslatedContent('')
  }, [loadMarkdown])

  // Keyboard shortcut: Cmd/Ctrl + R to refresh, Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        if (!loading) {
          loadMarkdown()
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [loading, loadMarkdown, onBack])

  const handleOpenFolder = async () => {
    try {
      if (task.resultPath) {
        const existsResult = await window.electronAPI.fileExists(task.resultPath)
        if (existsResult.success && existsResult.exists) {
          const result = await window.electronAPI.openPath(task.resultPath)
          if (result.success) {
            return
          }
        }
      }

      const result = await window.electronAPI.openPath(project.workspaceDir)
      if (!result.success) {
        alert(`Failed to open folder: ${result.error}`)
      }
    } catch (error) {
      console.error('Error opening folder:', error)
      alert('Failed to open folder')
    }
  }

  const handleOpenInEditor = async () => {
    try {
      if (!markdownPath) {
        alert('Markdown file path not found')
        return
      }

      const existsResult = await window.electronAPI.fileExists(markdownPath)
      if (!existsResult.success || !existsResult.exists) {
        alert('Markdown file does not exist yet')
        return
      }

      const result = await window.electronAPI.openPath(markdownPath)
      if (!result.success) {
        alert(`Failed to open file: ${result.error}`)
      }
    } catch (error) {
      console.error('Error opening file:', error)
      alert('Failed to open file in editor')
    }
  }

  const handleStartTask = async () => {
    try {
      const result = await window.electronAPI.taskStart(project.id, task.id)
      if (result.success) {
        onProjectsChange()
      } else {
        alert(result.error || 'Failed to start task')
      }
    } catch (error) {
      console.error('Error starting task:', error)
      alert('Failed to start task')
    }
  }

  const handleStopTask = async () => {
    try {
      const result = await window.electronAPI.taskStop(project.id, task.id)
      if (result.success) {
        onProjectsChange()
      } else {
        alert(result.error || 'Failed to stop task')
      }
    } catch (error) {
      console.error('Error stopping task:', error)
      alert('Failed to stop task')
    }
  }

  const handleDeleteTask = async () => {
    if (!confirm(`Are you sure you want to delete "${taskName}"?`)) return

    try {
      const result = await window.electronAPI.taskDelete(project.id, task.id)
      if (result.success) {
        onProjectsChange()
        onBack()
      } else {
        alert(result.error || 'Failed to delete task')
      }
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const getStatusConfig = (status: Task['status']) => {
    switch (status) {
      case 'pending':
        return { label: 'Scheduled', variant: 'secondary' as const }
      case 'running':
        return { label: 'Running', variant: 'default' as const }
      case 'completed':
        return { label: 'Finished', variant: 'default' as const }
      case 'failed':
        return { label: 'Error', variant: 'destructive' as const }
      case 'cancelled':
        return { label: 'Stopped', variant: 'secondary' as const }
      default:
        return { label: 'Unknown', variant: 'secondary' as const }
    }
  }

  const statusConfig = getStatusConfig(task.status)

  // Information items for the banner
  const infoItems = [
    { key: 'Status', value: statusConfig.label },
    ...(task.model ? [{ key: 'Model', value: task.model }] : []),
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Combined Header & Toolbar */}
      <BlurFade delay={0.1}>
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Back button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            {/* Language selector */}
            <LanguageSelector
              value={selectedLanguage}
              onChange={handleLanguageChange}
            />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Action buttons */}
            <TooltipProvider>
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadMarkdown}
                      disabled={loading}
                      className="h-8"
                    >
                      <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh <kbd className="ml-1 text-xs opacity-60">⌘R</kbd></p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleOpenInEditor}
                      disabled={!markdownPath || loading}
                      className="h-8"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in Editor</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" onClick={handleOpenFolder} className="h-8">
                      <FolderOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open Folder</p>
                  </TooltipContent>
                </Tooltip>

                <div className="w-px h-6 bg-border mx-1" />

                {task.status === 'pending' && (
                  <Button size="sm" onClick={handleStartTask} className="h-8">
                    <Play className="mr-1 h-3 w-3" />
                    Start
                  </Button>
                )}
                {task.status === 'running' && (
                  <Button size="sm" variant="destructive" onClick={handleStopTask} className="h-8">
                    <StopCircle className="mr-1 h-3 w-3" />
                    Stop
                  </Button>
                )}

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDeleteTask}
                      disabled={task.status === 'running'}
                      className="h-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete Task</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>
      </BlurFade>

      {/* Information Banner */}
      <BlurFade delay={0.15}>
        <div className="border-b bg-muted/30 px-6 py-2">
          <div className="flex items-center gap-6 text-sm">
            {infoItems.map((item, index) => (
              <div key={item.key} className="flex items-center gap-2">
                {index > 0 && <span className="text-muted-foreground/50">•</span>}
                <span className="text-muted-foreground">{item.key}:</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </BlurFade>

      {/* Content */}
      <BlurFade delay={0.3}>
        <div
          ref={contentBoxRef}
          className="flex-1 overflow-auto"
        >
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : isTranslating ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Translating with AI...</span>
                  {translationModel && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {translationModel}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelTranslation}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-lg text-destructive mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                Make sure the task has completed and generated output files.
              </p>
            </div>
          ) : content ? (
            <div className="p-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 mt-6 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-2xl font-semibold mb-3 mt-5 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-xl font-semibold mb-2 mt-4 first:mt-0">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h4>,
                  p: ({ children }) => <p className="mb-4 leading-relaxed text-foreground">{children}</p>,
                  ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  blockquote: ({ children }) => <blockquote className="border-l-4 border-primary pl-4 my-4 italic text-muted-foreground">{children}</blockquote>,
                  code: ({ className, children }) => {
                    const isInline = !className
                    return isInline ? (
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                    ) : (
                      <code className={`block bg-muted p-4 rounded-lg my-4 overflow-x-auto text-sm font-mono ${className}`}>{children}</code>
                    )
                  },
                  pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg my-4 overflow-x-auto">{children}</pre>,
                  a: ({ children, href }) => <a href={href} className="text-primary underline hover:text-primary/80" target="_blank" rel="noopener noreferrer">{children}</a>,
                  table: ({ children }) => <div className="overflow-x-auto my-4"><table className="min-w-full border-collapse border border-border">{children}</table></div>,
                  thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                  tbody: ({ children }) => <tbody>{children}</tbody>,
                  tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                  th: ({ children }) => <th className="border border-border px-4 py-2 text-left font-semibold">{children}</th>,
                  td: ({ children }) => <td className="border border-border px-4 py-2">{children}</td>,
                  hr: () => <hr className="my-6 border-border" />,
                  img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} baseDir={markdownDir} />,
                }}
              >
                {selectedLanguage === 'en' ? content : (translatedContent || content)}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-lg text-muted-foreground">No content available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Run the task to generate output.
              </p>
            </div>
          )}
        </div>
      </BlurFade>
    </div>
  )
}

