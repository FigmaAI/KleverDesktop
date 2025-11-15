import { useState } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Textarea,
  Button,
  Box,
  Input,
  DialogTitle,
  DialogContent,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/joy'
import { Schedule } from '@mui/icons-material'
import { ModelSelector } from './ModelSelector'
import type { Platform, Task } from '../types/project'

interface TaskCreateDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  platform: Platform
  onTaskCreated?: (task: Task) => void
}

export function TaskCreateDialog({
  open,
  onClose,
  projectId,
  platform,
  onTaskCreated,
}: TaskCreateDialogProps) {
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [selectedModel, setSelectedModel] = useState<{ type: 'local' | 'api'; model: string } | undefined>()
  const [runImmediately, setRunImmediately] = useState(true)
  const [loading, setLoading] = useState(false)

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
      const taskInput = {
        projectId,
        name: `Task ${new Date().toLocaleString()}`,
        goal: goal.trim(),
        url: platform === 'web' ? url.trim() : undefined,
        // Include model configuration if user has selected a specific model
        modelProvider: selectedModel?.type,
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
    <Modal open={open} onClose={handleClose}>
      <ModalDialog sx={{ maxWidth: 700, width: '90%' }}>
        <ModalClose />
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent>
          <Textarea
            placeholder={
              platform === 'web'
                ? 'Describe what you want to automate...\nFor example: "Search for React tutorials and take screenshots of the top 3 results"\n\nPress Cmd/Ctrl + Enter to submit'
                : 'Describe what you want to automate on the Android device...\nFor example: "Open Instagram and like the top 5 posts"\n\nPress Cmd/Ctrl + Enter to submit'
            }
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={handleKeyDown}
            minRows={6}
            maxRows={12}
            size="lg"
            sx={{
              fontSize: '1rem',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
            startDecorator={
              platform === 'web' && (
                <Box sx={{ display: 'flex', gap: 0.5, width: '100%' }}>
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    size="sm"
                    sx={{ flex: 1 }}
                  />
                </Box>
              )
            }
            endDecorator={
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  width: '100%',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  pt: 1,
                }}
              >
                {/* Left: Model Type & Model Selection */}
                <ModelSelector
                  value={selectedModel}
                  onChange={setSelectedModel}
                  size="sm"
                />

                {/* Right: Action Buttons */}
                <Stack direction="row" spacing={1}>
                  <Tooltip title="Schedule task (Coming soon)" placement="top">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      color="neutral"
                      disabled
                    >
                      <Schedule fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Button
                    loading={loading}
                    disabled={!isEligible}
                    loadingIndicator="Running…"
                    color="primary"
                    size="sm"
                    onClick={handleSubmit}
                    endDecorator="⌘⏎"
                  >
                    Run
                  </Button>

                </Stack>
              </Stack>
            }
          />
        </DialogContent>
        {/* <DialogActions>
          <Button variant="plain" color="neutral" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions> */}
      </ModalDialog>
    </Modal>
  )
}
