import { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  Box,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/joy'
import { FolderOpen, Refresh, OpenInNew } from '@mui/icons-material'
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
        const taskDirName = taskResultPath.split('/').filter(Boolean).pop() || ''
        mdPath = `${taskResultPath}/log_report_${taskDirName}.md`
      } else {
        // Fallback to old pattern
        mdPath = `${workspaceDir}/${taskName.replace(/\s+/g, '_')}.md`
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
        <ModalClose />

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
                disabled={!content && !loading}
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
                '& p': {
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
                  height: 'auto',
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
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
