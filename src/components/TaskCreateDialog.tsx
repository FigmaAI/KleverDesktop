import { useState, useEffect } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Textarea,
  Select,
  Option,
  Button,
  Box,
  Input,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/joy'
import { AutoAwesome } from '@mui/icons-material'
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
  const [model, setModel] = useState('')
  const [runImmediately, setRunImmediately] = useState(true)
  const [loading, setLoading] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])

  // Load available models from config
  useEffect(() => {
    if (open) {
      loadModels()
    }
  }, [open])

  const loadModels = async () => {
    try {
      const configResult = await window.electronAPI.configLoad()
      if (configResult.success && configResult.config) {
        const models: string[] = []

        // Add local model if enabled
        if (configResult.config.enableLocal && configResult.config.localModel) {
          models.push(`Local: ${configResult.config.localModel}`)
          setModel(`Local: ${configResult.config.localModel}`)
        }

        // Add API model if enabled
        if (configResult.config.enableApi && configResult.config.apiModel) {
          models.push(`API: ${configResult.config.apiModel}`)
          if (!configResult.config.enableLocal) {
            setModel(`API: ${configResult.config.apiModel}`)
          }
        }

        setAvailableModels(models)
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

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
      <ModalDialog layout="fullscreen">
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
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  pt: 1,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  alignItems: 'center',
                }}
              >
                {availableModels.length > 0 && (
                  <Select
                    value={model}
                    onChange={(_, value) => setModel(value || '')}
                    placeholder="Model"
                    size="sm"
                    sx={{ minWidth: 160 }}
                  >
                    {availableModels.map((m) => (
                      <Option key={m} value={m}>
                        {m.replace('Local: ', '🖥️ ').replace('API: ', '☁️ ')}
                      </Option>
                    ))}
                  </Select>
                )}

                <Select
                  value={runImmediately ? 'immediate' : 'scheduled'}
                  onChange={(_, value) => setRunImmediately(value === 'immediate')}
                  size="sm"
                  sx={{ minWidth: 140 }}
                >
                  <Option value="immediate">Run now</Option>
                  <Option value="scheduled" disabled>
                    Schedule (Soon)
                  </Option>
                </Select>

                <Button
                  loading={loading}
                  disabled={!isEligible}
                  loadingIndicator="Creating…"
                  color="primary"
                  sx={{ ml: 'auto' }}
                  size="sm"
                  onClick={handleSubmit}
                  startDecorator={<AutoAwesome fontSize="small" />}
                >
                  {runImmediately ? 'Create & Run' : 'Create Task'}
                </Button>
              </Box>
            }
          />
        </DialogContent>
        <DialogActions>
          <Button variant="plain" color="neutral" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </ModalDialog>
    </Modal>
  )
}
