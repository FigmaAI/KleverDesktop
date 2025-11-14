import { useState, useEffect } from 'react'
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Stack,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Button,
  Divider,
  Box,
  FormHelperText,
} from '@mui/joy'
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
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [url, setUrl] = useState('')
  const [device, setDevice] = useState('')
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
        name: name.trim() || `Task ${new Date().toLocaleString()}`,
        goal: goal.trim(),
        url: platform === 'web' ? url.trim() : undefined,
        device: platform === 'android' ? device.trim() : undefined,
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

  const handleClose = () => {
    setName('')
    setGoal('')
    setUrl('')
    setDevice('')
    setRunImmediately(true)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        sx={{
          maxWidth: 800,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <ModalClose />
        <Typography level="h4" fontWeight="bold" mb={2}>
          Create New Task
        </Typography>

        <Stack spacing={3}>
          {/* Platform-specific inputs (top section) */}
          <Box>
            <Typography level="title-md" fontWeight="bold" mb={1.5}>
              Target Configuration
            </Typography>
            <Stack spacing={2}>
              {platform === 'web' ? (
                <FormControl required>
                  <FormLabel>Website URL</FormLabel>
                  <Input
                    placeholder="https://example.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    size="lg"
                  />
                  <FormHelperText>Enter the website URL to automate</FormHelperText>
                </FormControl>
              ) : (
                <FormControl>
                  <FormLabel>Android Device</FormLabel>
                  <Input
                    placeholder="Device ID (optional)"
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                    size="lg"
                  />
                  <FormHelperText>
                    Leave empty to use the default connected device
                  </FormHelperText>
                </FormControl>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Task description (main section) */}
          <Box>
            <FormControl required>
              <FormLabel>
                <Typography level="title-md" fontWeight="bold">
                  Task Description
                </Typography>
              </FormLabel>
              <Textarea
                placeholder="Describe what you want to automate... For example: 'Search for React tutorials and take screenshots of the top 3 results'"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                minRows={8}
                maxRows={12}
                size="lg"
                sx={{
                  fontSize: '1rem',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />
              <FormHelperText>
                Be specific about what you want the AI to do. The more detailed, the
                better the results.
              </FormHelperText>
            </FormControl>
          </Box>

          <Divider />

          {/* Bottom section: Model & Schedule */}
          <Stack spacing={2}>
            <Typography level="title-md" fontWeight="bold">
              Advanced Options
            </Typography>

            <FormControl>
              <FormLabel>Task Name (Optional)</FormLabel>
              <Input
                placeholder="Auto-generated if empty"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormControl>

            {availableModels.length > 0 && (
              <FormControl>
                <FormLabel>AI Model</FormLabel>
                <Select
                  value={model}
                  onChange={(_, value) => setModel(value || '')}
                  placeholder="Select model"
                >
                  {availableModels.map((m) => (
                    <Option key={m} value={m}>
                      {m}
                    </Option>
                  ))}
                </Select>
                <FormHelperText>Uses the model configured in Settings</FormHelperText>
              </FormControl>
            )}

            <FormControl>
              <FormLabel>Execution</FormLabel>
              <Select
                value={runImmediately ? 'immediate' : 'scheduled'}
                onChange={(_, value) => setRunImmediately(value === 'immediate')}
              >
                <Option value="immediate">Run immediately</Option>
                <Option value="scheduled" disabled>
                  Schedule for later (Coming soon)
                </Option>
              </Select>
            </FormControl>
          </Stack>

          {/* Action buttons */}
          <Stack direction="row" spacing={2} justifyContent="flex-end" mt={2}>
            <Button variant="outlined" color="neutral" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!goal.trim() || (platform === 'web' && !url.trim())}
            >
              {runImmediately ? 'Create & Run' : 'Create Task'}
            </Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  )
}
