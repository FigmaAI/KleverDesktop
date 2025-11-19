import { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  ModalDialog,
  Typography,
  Stack,
  Box,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/joy'
import { FolderOpen, Refresh, OpenInNew, Close } from '@mui/icons-material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TaskMarkdownDialogProps {
  open: boolean
  onClose: () => void
  taskName: string
  workspaceDir: string
  taskResultPath?: string  // Task-specific directory path
  taskStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'  // Task status for real-time updates
}

// Component to load and display images from file system
function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    // Skip if already a data URL or HTTP URL
    if (src.startsWith('data:') || src.startsWith('http')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // Load image from file system
    const loadImage = async () => {
      try {
        const result = await window.electronAPI.fileReadImage(src);
        if (result?.success && result.dataUrl) {
          setImageSrc(result.dataUrl);
          setError(null);
        } else {
          setError(result?.error || 'Failed to load image');
          setImageSrc(null);
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setImageSrc(null);
      } finally {
        setLoading(false);
      }
    };

    loadImage();
  }, [src]);

  if (loading) {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, my: 2 }}>
        <CircularProgress size="sm" />
        <Typography component="span" level="body-sm" textColor="text.secondary">
          Loading image...
        </Typography>
      </Box>
    );
  }

  if (error && !imageSrc) {
    return (
      <Box sx={{ p: 2, border: '1px solid', borderColor: 'danger.300', borderRadius: 'sm', my: 2 }}>
        <Typography component="div" level="body-sm" textColor="danger.500">
          {error}
        </Typography>
        <Typography component="div" level="body-xs" textColor="text.secondary" mt={0.5}>
          {src}
        </Typography>
      </Box>
    );
  }

  return <img src={imageSrc || undefined} alt={alt} style={{ maxWidth: '100%', height: 'auto' }} />;
}

export function TaskMarkdownDialog({
  open,
  onClose,
  taskName,
  workspaceDir,
  taskResultPath,
  taskStatus = 'pending',
}: TaskMarkdownDialogProps) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [markdownPath, setMarkdownPath] = useState<string>('')

  const loadMarkdown = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Construct markdown file path
      // Python generates: log_report_{task_name}.md where task_name is the directory basename
      // Example: /path/to/self_explore_2025-11-19_04-24-12/log_report_self_explore_2025-11-19_04-24-12.md
      let mdPath: string

      if (taskResultPath) {
        // Extract task name from path (last directory name)
        // Support both forward slash and backslash for Windows
        const taskDirName = taskResultPath.split(/[\/\\]/).filter(Boolean).pop() || ''
        // Always use forward slashes for internal path handling to avoid markdown escape issues
        const normalizedPath = taskResultPath.replace(/\\/g, '/')
        mdPath = `${normalizedPath}/log_report_${taskDirName}.md`
      } else {
        // Fallback to old pattern
        const normalizedWorkspace = workspaceDir.replace(/\\/g, '/')
        mdPath = `${normalizedWorkspace}/${taskName.replace(/\s+/g, '_')}.md`
      }

      setMarkdownPath(mdPath)

      // Check if file exists
      const existsResult = await window.electronAPI.fileExists(mdPath)

      if (!existsResult.success || !existsResult.exists) {
        // If task is running, show "generating" message instead of error
        if (taskStatus === 'running') {
          setError('Report is being generated... This view will auto-refresh.')
          setContent('')
        } else {
          setError('Markdown file not found. The task may not have generated output yet.')
          setContent('')
        }
      } else {
        // Read file contents
        const readResult = await window.electronAPI.fileRead(mdPath)

        if (readResult.success && readResult.content) {
          // Convert relative image paths to absolute paths
          let processedContent = readResult.content;

          // Normalize markdown path to use forward slashes
          const normalizedMdPath = mdPath.replace(/\\/g, '/');
          const lastSlash = normalizedMdPath.lastIndexOf('/');
          const markdownDir = lastSlash > 0 ? normalizedMdPath.substring(0, lastSlash) : normalizedMdPath;

          // Replace image paths: ![alt](relative/path.png) -> ![alt](absolute/path.png)
          processedContent = processedContent.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imgPath) => {
            // Skip if already absolute or URL
            if (imgPath.startsWith('/') || imgPath.startsWith('http') || imgPath.startsWith('file://') || imgPath.startsWith('data:')) {
              return match;
            }

            // Normalize image path to use forward slashes and remove leading ./
            const normalizedImgPath = imgPath.replace(/^\.\//, '').replace(/\\/g, '/');
            const absolutePath = `${markdownDir}/${normalizedImgPath}`;

            // Store absolute path - MarkdownImage component will handle loading
            return `![${alt}](${absolutePath})`;
          });

          setContent(processedContent)
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
  }, [taskName, workspaceDir, taskResultPath, taskStatus])

  useEffect(() => {
    if (open) {
      loadMarkdown()
    }
  }, [open, loadMarkdown])

  // Auto-refresh when task is running
  useEffect(() => {
    if (open && taskStatus === 'running') {
      const interval = setInterval(() => {
        loadMarkdown()
      }, 2000) // Refresh every 2 seconds

      return () => clearInterval(interval)
    }
  }, [open, taskStatus, loadMarkdown])

  const handleOpenFolder = async () => {
    try {
      // Try to open task result path first if it exists
      if (taskResultPath) {
        const existsResult = await window.electronAPI.fileExists(taskResultPath)
        if (existsResult.success && existsResult.exists) {
          const result = await window.electronAPI.openPath(taskResultPath)
          if (result.success) {
            return
          }
        }
      }

      // Fallback to workspace directory
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

      // Check if file exists
      const existsResult = await window.electronAPI.fileExists(markdownPath)
      if (!existsResult.success || !existsResult.exists) {
        alert('Markdown file does not exist yet')
        return
      }

      // Open the markdown file with system default editor
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
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          width: '95vw',
          height: '95vh',
          maxWidth: 'none',
          maxHeight: 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography level="h4" fontWeight="bold">
            Task Result
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Refresh">
              <IconButton
                size="sm"
                variant="outlined"
                onClick={loadMarkdown}
                disabled={loading}
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open in Editor">
              <IconButton
                size="sm"
                variant="outlined"
                onClick={handleOpenInEditor}
                disabled={!markdownPath || loading}
              >
                <OpenInNew />
              </IconButton>
            </Tooltip>
            <Tooltip title="Open Folder">
              <IconButton
                size="sm"
                variant="outlined"
                onClick={handleOpenFolder}
              >
                <FolderOpen />
              </IconButton>
            </Tooltip>
            <Tooltip title="Close">
              <IconButton
                size="sm"
                variant="outlined"
                onClick={onClose}
              >
                <Close />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            bgcolor: 'background.surface',
            borderRadius: 'sm',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <CircularProgress />
            </Box>
          ) : error ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography level="body-lg" textColor="danger.500" mb={2}>
                {error}
              </Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Make sure the task has completed and generated output files.
              </Typography>
            </Box>
          ) : content ? (
            <Box
              className="markdown-body"
              sx={{
                p: 3,
                '& h1': {
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  mt: 3,
                  mb: 2,
                  pb: 1,
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                },
                '& h2': {
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  mt: 2.5,
                  mb: 1.5,
                },
                '& h3': {
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  mt: 2,
                  mb: 1,
                },
                '& h4': {
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  mt: 1.5,
                  mb: 1,
                },
                '& h5': {
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  mt: 1.5,
                  mb: 0.75,
                },
                '& h6': {
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  mt: 1.5,
                  mb: 0.75,
                },
                '& > div': {
                  mb: 1.5,
                  lineHeight: 1.6,
                },
                '& ul, & ol': {
                  pl: 3,
                  mb: 1.5,
                },
                '& li': {
                  mb: 0.5,
                },
                '& code': {
                  bgcolor: 'background.level1',
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 'xs',
                  fontFamily: 'monospace',
                  fontSize: '0.875em',
                },
                '& pre': {
                  mb: 2,
                  borderRadius: 'sm',
                  overflow: 'hidden',
                },
                '& pre code': {
                  bgcolor: 'transparent',
                  px: 0,
                  py: 0,
                },
                '& blockquote': {
                  borderLeft: '4px solid',
                  borderColor: 'primary.500',
                  pl: 2,
                  ml: 0,
                  my: 2,
                  fontStyle: 'italic',
                  color: 'text.secondary',
                },
                '& img': {
                  maxWidth: '100%',
                  maxHeight: '512px',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 'sm',
                  my: 2,
                },
                '& table': {
                  width: '100%',
                  borderCollapse: 'collapse',
                  mb: 2,
                },
                '& th, & td': {
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                  textAlign: 'left',
                },
                '& th': {
                  bgcolor: 'background.level1',
                  fontWeight: 'bold',
                },
                '& hr': {
                  my: 2,
                  borderColor: 'divider',
                },
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img({ src, alt }) {
                    return <MarkdownImage src={src} alt={alt} />;
                  },
                  p: ({ children }) => <div style={{ marginBottom: '1rem' }}>{children}</div>,
                }}
              >
                {content}
              </ReactMarkdown>
            </Box>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography level="body-lg" textColor="text.secondary">
                No content available
              </Typography>
            </Box>
          )}
        </Box>
      </ModalDialog>
    </Modal>
  )
}
