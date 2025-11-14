import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Sheet,
  Stack,
  Textarea,
  Typography,
  RadioGroup,
  Radio,
  FormHelperText,
  CircularProgress,
} from '@mui/joy'
import { ArrowBack, InfoOutlined } from '@mui/icons-material'
import type { Project } from '../types/project'

export function TaskCreate() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<Project | null>(null)

  // Form state
  const [taskName, setTaskName] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [url, setUrl] = useState('')
  const [deviceType, setDeviceType] = useState<'emulator' | 'physical'>('emulator')
  const [physicalDeviceId, setPhysicalDeviceId] = useState('')
  const [isUrlValid, setIsUrlValid] = useState(true)

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId) return
      const result = await window.electronAPI.projectGet(projectId)
      if (result.success && result.project) {
        setProject(result.project)
      } else {
        // Handle project not found
        alert('Project not found')
        navigate('/projects')
      }
    }
    loadProject()
  }, [projectId, navigate])

  useEffect(() => {
    if (project?.platform === 'web') {
      if (url.trim() === '') {
        setIsUrlValid(true)
        return
      }
      try {
        new URL(url)
        setIsUrlValid(true)
      } catch {
        setIsUrlValid(false)
      }
    }
  }, [url, project?.platform])

  const canSubmit = () => {
    if (!project || taskName.trim() === '' || taskDescription.trim() === '') {
      return false
    }
    if (project.platform === 'web') {
      return url.trim() !== '' && isUrlValid
    }
    if (project.platform === 'android') {
      if (deviceType === 'physical') {
        return physicalDeviceId.trim() !== ''
      }
      return true // for emulator
    }
    return false
  }

  const handleCreate = async () => {
    if (!projectId || !canSubmit()) return

    setLoading(true)
    try {
      const device = project?.platform === 'android'
        ? (deviceType === 'physical' ? physicalDeviceId : 'emulator')
        : undefined

      const result = await window.electronAPI.taskCreate({
        projectId,
        name: taskName,
        description: taskDescription,
        goal: taskDescription,
        url: project?.platform === 'web' ? url : undefined,
        device,
      })

      if (result.success) {
        navigate(`/projects/${projectId}`)
      } else {
        alert(`Failed to create task: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Failed to create task')
    } finally {
      setLoading(false)
    }
  }

  if (!project) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1, maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Stack spacing={2} sx={{ mb: 4 }}>
          <Button
            variant="plain"
            color="neutral"
            startDecorator={<ArrowBack />}
            onClick={() => navigate(`/projects/${projectId}`)}
            sx={{ alignSelf: 'flex-start' }}
          >
            Back to Project
          </Button>
          <Typography level="h2" fontWeight="bold">
            Add New Task for &quot;{project.name}&quot;
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Create a new automation task for the <strong>{project.platform}</strong> platform.
          </Typography>
        </Stack>

        <Sheet
          variant="outlined"
          sx={{
            p: 4,
            borderRadius: 'md',
            bgcolor: 'background.surface',
          }}
        >
          <Stack spacing={3}>
            <FormControl required>
              <FormLabel>Task Name</FormLabel>
              <Input
                placeholder="e.g., Follow User, Like Posts"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
            </FormControl>

            <FormControl required>
              <FormLabel>Task Goal</FormLabel>
              <Textarea
                placeholder="Describe what this task should do in detail..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                minRows={6}
              />
              <FormHelperText>
                Provide clear, step-by-step instructions for the AI agent.
              </FormHelperText>
            </FormControl>

            {/* Platform-specific fields */}
            {project.platform === 'android' && (
              <Stack spacing={3}>
                <FormControl>
                  <FormLabel>Device Type</FormLabel>
                  <RadioGroup
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value as 'emulator' | 'physical')}
                    orientation="horizontal"
                  >
                    <Radio value="emulator" label="Emulator (auto-start)" />
                    <Radio value="physical" label="Physical Device" />
                  </RadioGroup>
                </FormControl>

                {deviceType === 'physical' && (
                  <FormControl required>
                    <FormLabel>Device ID</FormLabel>
                    <Input
                      placeholder="e.g., 192.168.1.5:5555 or device_serial"
                      value={physicalDeviceId}
                      onChange={(e) => setPhysicalDeviceId(e.target.value)}
                    />
                    <FormHelperText>
                      Run <code>adb devices</code> to see connected devices.
                    </FormHelperText>
                  </FormControl>
                )}
              </Stack>
            )}

            {project.platform === 'web' && (
              <FormControl required>
                <FormLabel>Website URL</FormLabel>
                <Input
                  type="url"
                  placeholder="e.g., https://instagram.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  error={!isUrlValid && url.length > 0}
                />
                {!isUrlValid && url.length > 0 && (
                  <FormHelperText sx={{ color: 'danger.500' }}>
                    <InfoOutlined sx={{ mr: 0.5 }} />
                    Please enter a valid URL.
                  </FormHelperText>
                )}
              </FormControl>
            )}

            <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => navigate(`/projects/${projectId}`)}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                color="primary"
                onClick={handleCreate}
                disabled={!canSubmit() || loading}
                loading={loading}
              >
                Create Task
              </Button>
            </Stack>
          </Stack>
        </Sheet>
      </Box>
    </Box>
  )
}