import { useEffect, useState, useCallback } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  Box,
  Button,
  CircularProgress,
} from '@mui/joy'
import { FolderOpen, Refresh } from '@mui/icons-material'

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
      // Priority: taskResultPath/log_report.md > workspaceDir/{taskName}.md
      let mdPath: string

      if (taskResultPath) {
        // Use the task result directory path + log_report.md
        mdPath = `${taskResultPath}/log_report.md`
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
          <Stack spacing={0.5}>
            <Typography level="h4" fontWeight="bold">
              Task Results: {taskName}
            </Typography>
            {markdownPath && (
              <Typography level="body-xs" textColor="text.secondary">
                {markdownPath}
              </Typography>
            )}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<Refresh />}
              onClick={loadMarkdown}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outlined"
              startDecorator={<FolderOpen />}
              onClick={handleOpenFolder}
            >
              Open Folder
            </Button>
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
                  bgcolor: '#1e1e1e',
                  color: '#d4d4d4',
                  p: 2,
                  borderRadius: 'sm',
                  overflow: 'auto',
                  mb: 2,
                },
                '& pre code': {
                  bgcolor: 'transparent',
                  px: 0,
                  py: 0,
                  color: 'inherit',
                },
                '& blockquote': {
                  borderLeft: '4px solid',
                  borderColor: 'primary.500',
                  pl: 2,
                  ml: 0,
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
              }}
            >
              {/* Simple markdown-like rendering */}
              {content.split('\n').map((line, index) => {
                // Headers
                if (line.startsWith('# ')) {
                  return <Typography key={index} component="h1">{line.substring(2)}</Typography>
                }
                if (line.startsWith('## ')) {
                  return <Typography key={index} component="h2">{line.substring(3)}</Typography>
                }
                if (line.startsWith('### ')) {
                  return <Typography key={index} component="h3">{line.substring(4)}</Typography>
                }
                // Code blocks
                if (line.startsWith('```')) {
                  return <Box key={index} component="pre"><code>{line.substring(3)}</code></Box>
                }
                // Empty lines
                if (line.trim() === '') {
                  return <Box key={index} sx={{ height: '0.5rem' }} />
                }
                // Regular paragraphs
                return <Typography key={index} level="body-md">{line}</Typography>
              })}
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
