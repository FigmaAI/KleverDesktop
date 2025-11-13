import { useState } from 'react'
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
} from '@mui/joy'
import { ArrowBack } from '@mui/icons-material'

export function TaskCreate() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // Form state
  const [taskName, setTaskName] = useState('')
  const [taskDescription, setTaskDescription] = useState('')

  const handleCreate = async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const result = await window.electronAPI.taskCreate({
        projectId,
        name: taskName,
        description: taskDescription,
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

  const canSubmit = taskName.trim() !== '' && taskDescription.trim() !== ''

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
            Add New Task
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Create a new automation task for this project
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
                placeholder="e.g., Follow User, Like Posts, Search Query"
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
              />
              <Typography level="body-xs" textColor="text.secondary" sx={{ mt: 0.5 }}>
                A short, descriptive name for this task
              </Typography>
            </FormControl>

            <FormControl required>
              <FormLabel>Task Description</FormLabel>
              <Textarea
                placeholder="Describe what this task should do in detail. For example:

1. Open Instagram app
2. Navigate to user profile @example
3. Click the Follow button
4. Return to home screen"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                minRows={6}
              />
              <Typography level="body-xs" textColor="text.secondary" sx={{ mt: 0.5 }}>
                Provide clear, step-by-step instructions for the AI automation agent
              </Typography>
            </FormControl>

            <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
              <Typography level="body-sm" fontWeight="bold" sx={{ mb: 1 }}>
                Tips for writing task descriptions:
              </Typography>
              <Typography level="body-xs" textColor="text.secondary" component="ul" sx={{ pl: 2 }}>
                <li>Be specific and clear about each step</li>
                <li>Use numbered lists for sequential actions</li>
                <li>Include element names or text when possible (e.g., &quot;Click Follow button&quot;)</li>
                <li>Specify expected outcomes (e.g., &quot;Wait for profile page to load&quot;)</li>
              </Typography>
            </Box>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
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
                disabled={!canSubmit || loading}
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
