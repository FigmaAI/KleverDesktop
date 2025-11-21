import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Sheet,
  Stack,
  Typography,
  Snackbar,
} from '@mui/joy'
import { ArrowBack, FolderOpen, Language, PhoneAndroid } from '@mui/icons-material'
import type { Platform } from '../types/project'

export function ProjectCreate() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // Form state
  const [platform, setPlatform] = useState<Platform>('android')
  const [projectName, setProjectName] = useState('')
  const [workspaceDir, setWorkspaceDir] = useState('')

  // Snackbar state
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    color: 'success' | 'danger'
  }>({
    open: false,
    message: '',
    color: 'success',
  })

  const canCreate = () => {
    return projectName.trim() !== ''
  }

  const handleSelectWorkspace = async () => {
    const path = await window.electronAPI.showFolderSelectDialog()
    if (path) {
      setWorkspaceDir(path)
    }
  }

  const handleCreate = async () => {
    if (!canCreate()) return

    setLoading(true)
    try {
      const result = await window.electronAPI.projectCreate({
        name: projectName,
        platform,
        workspaceDir: workspaceDir || undefined, // Send undefined if empty
      })

      if (result.success && result.project) {
        // Show success message
        const message = result.message || `Project created successfully at ${result.project.workspaceDir}`
        const projectId = result.project.id
        setSnackbar({
          open: true,
          message,
          color: 'success',
        })

        // Navigate after a short delay to show the snackbar
        setTimeout(() => {
          navigate(`/projects/${projectId}`)
        }, 1500)
      } else {
        // Show error message
        setSnackbar({
          open: true,
          message: `Failed to create project: ${result.error}`,
          color: 'danger',
        })
      }
    } catch (error) {
      console.error('Error creating project:', error)
      setSnackbar({
        open: true,
        message: 'Failed to create project. Please try again.',
        color: 'danger',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1, maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Stack spacing={2} sx={{ mb: 4 }}>
          <Button
            variant="plain"
            color="neutral"
            startDecorator={<ArrowBack />}
            onClick={() => navigate('/projects')}
            sx={{ alignSelf: 'flex-start' }}
          >
            Back to Projects
          </Button>
          <Typography level="h2" fontWeight="bold">
            Create New Project
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            A project contains a set of automation tasks for a specific app or website.
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
          <Stack spacing={4}>
            {/* --- Section 1: Project Details --- */}
            <Stack spacing={2}>
              <Typography level="title-lg" component="h3">
                1. Project Details
              </Typography>
              <FormControl required>
                <FormLabel>Project Name</FormLabel>
                <Input
                  placeholder="e.g., Instagram Automation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
                <FormHelperText>
                  The name of the app or website you want to automate.
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>Workspace Directory (Optional)</FormLabel>
                <Input
                  readOnly
                  value={workspaceDir}
                  placeholder="Default: App container (MAS-safe)"
                  endDecorator={
                    <Button
                      variant="soft"
                      color="neutral"
                      startDecorator={<FolderOpen />}
                      onClick={handleSelectWorkspace}
                    >
                      Browse
                    </Button>
                  }
                />
                <FormHelperText>
                  Choose a custom folder for project files, or leave empty for default container location.
                </FormHelperText>
              </FormControl>
            </Stack>

            {/* --- Section 2: Platform Selection --- */}
            <Stack spacing={2}>
              <Typography level="title-lg" component="h3">
                2. Select Platform
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Card
                  variant={platform === 'android' ? 'solid' : 'outlined'}
                  color={platform === 'android' ? 'primary' : 'neutral'}
                  onClick={() => setPlatform('android')}
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 'md' },
                  }}
                >
                  <Stack alignItems="center" spacing={2} sx={{ p: 2 }}>
                    <PhoneAndroid sx={{ fontSize: 40 }} />
                    <Typography level="title-md">Android</Typography>
                  </Stack>
                </Card>

                <Card
                  variant={platform === 'web' ? 'solid' : 'outlined'}
                  color={platform === 'web' ? 'primary' : 'neutral'}
                  onClick={() => setPlatform('web')}
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 'md' },
                  }}
                >
                  <Stack alignItems="center" spacing={2} sx={{ p: 2 }}>
                    <Language sx={{ fontSize: 40 }} />
                    <Typography level="title-md">Web</Typography>
                  </Stack>
                </Card>
              </Stack>
            </Stack>

            {/* --- Action Button --- */}
            <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'flex-end' }}>
              <Button
                size="lg"
                variant="solid"
                color="primary"
                onClick={handleCreate}
                disabled={!canCreate() || loading}
                loading={loading}
              >
                Create Project
              </Button>
            </Stack>
          </Stack>
        </Sheet>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        color={snackbar.color}
        variant="soft"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbar.message}
      </Snackbar>
    </Box>
  )
}