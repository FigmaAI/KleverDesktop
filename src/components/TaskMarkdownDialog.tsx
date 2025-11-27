import { useEffect, useState, useCallback, useRef } from 'react'
import { FolderOpen, RefreshCw, ExternalLink, X, Loader2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TaskMarkdownDialogProps {
  open: boolean
  onClose: () => void
  taskName: string
  workspaceDir: string
  taskResultPath?: string // Task-specific directory path
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
      <div className="inline-flex items-center gap-2 my-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading image...</span>
      </div>
    )
  }

  if (error && !imageSrc) {
    return (
      <div className="p-4 border border-destructive rounded-md my-4">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">{src}</p>
      </div>
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

export function TaskMarkdownDialog({
  open,
  onClose,
  taskName,
  workspaceDir,
  taskResultPath,
}: TaskMarkdownDialogProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdownPath, setMarkdownPath] = useState<string>('')
  const [markdownDir, setMarkdownDir] = useState<string>('')
  const contentBoxRef = useRef<HTMLDivElement>(null)

  const loadMarkdown = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Construct markdown file path
      let mdPath: string

      if (taskResultPath) {
        const taskDirName = taskResultPath.split(/[/\\]/).filter(Boolean).pop() || ''
        const normalizedPath = taskResultPath.replace(/\\/g, '/')
        mdPath = `${normalizedPath}/log_report_${taskDirName}.md`
      } else {
        const normalizedWorkspace = workspaceDir.replace(/\\/g, '/')
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
  }, [taskName, workspaceDir, taskResultPath])

  useEffect(() => {
    if (open) {
      loadMarkdown()
    }
  }, [open, loadMarkdown])

  // Keyboard shortcut: Cmd/Ctrl + R to refresh
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        if (!loading) {
          loadMarkdown()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, loadMarkdown])

  const handleOpenFolder = async () => {
    try {
      if (taskResultPath) {
        const existsResult = await window.electronAPI.fileExists(taskResultPath)
        if (existsResult.success && existsResult.exists) {
          const result = await window.electronAPI.openPath(taskResultPath)
          if (result.success) {
            return
          }
        }
      }

      const result = await window.electronAPI.openPath(workspaceDir)
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

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showClose={false} className="w-[95vw] h-[95vh] max-w-none flex flex-col p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Task Result</h2>
          <TooltipProvider>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadMarkdown}
                    disabled={loading}
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
                  <Button size="sm" variant="outline" onClick={handleOpenFolder}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Open Folder</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="outline" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Close</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Content */}
        <div
          ref={contentBoxRef}
          className="flex-1 overflow-auto bg-background rounded-md border"
        >
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
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
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-lg text-muted-foreground">No content available</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
