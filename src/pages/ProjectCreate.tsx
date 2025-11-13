import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  FormControl,
  FormLabel,
  Input,
  Radio,
  RadioGroup,
  Stack,
  Step,
  StepIndicator,
  Stepper,
  Typography,
  Sheet,
} from '@mui/joy'
import { Check, PhoneAndroid, Language, ArrowBack, ArrowForward } from '@mui/icons-material'
import type { Platform } from '../types/project'

export function ProjectCreate() {
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Form state
  const [platform, setPlatform] = useState<Platform>('android')
  const [device, setDevice] = useState('')
  const [projectName, setProjectName] = useState('')
  const [url, setUrl] = useState('')

  const steps = ['Platform', 'Device', 'Details']

  const handleNext = () => {
    if (activeStep === 0 && platform === 'web') {
      // Skip device selection for web
      setActiveStep(2)
    } else {
      setActiveStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (activeStep === 2 && platform === 'web') {
      // Skip device selection when going back from web
      setActiveStep(0)
    } else {
      setActiveStep((prev) => prev - 1)
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.projectCreate({
        name: projectName,
        platform,
        device: platform === 'android' ? device : undefined,
        url: platform === 'web' ? url : undefined,
      })

      if (result.success && result.project) {
        navigate(`/projects/${result.project.id}`)
      } else {
        alert(`Failed to create project: ${result.error}`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (activeStep === 0) return true // Platform is always selected (default: android)
    if (activeStep === 1) return device !== ''
    if (activeStep === 2) {
      if (platform === 'web') {
        return projectName.trim() !== '' && url.trim() !== ''
      }
      return projectName.trim() !== ''
    }
    return true
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
            Set up a new automation project for Android or Web
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
          <Stepper sx={{ width: '100%', mb: 4 }}>
            {steps.map((step, index) => {
              // Skip device step for web
              if (index === 1 && platform === 'web') return null

              return (
                <Step
                  key={step}
                  indicator={
                    <StepIndicator
                      variant={activeStep > index || (activeStep === index && canProceed()) ? 'solid' : 'outlined'}
                      color={activeStep > index ? 'success' : 'primary'}
                    >
                      {activeStep > index ? <Check /> : index + 1}
                    </StepIndicator>
                  }
                >
                  {step}
                </Step>
              )
            })}
          </Stepper>

          {/* Step 1: Platform Selection */}
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Typography level="title-lg" fontWeight="bold">
                Select Platform
              </Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Choose the platform you want to automate
              </Typography>

              <Stack direction="row" spacing={2}>
                <Card
                  variant={platform === 'android' ? 'solid' : 'outlined'}
                  color={platform === 'android' ? 'primary' : 'neutral'}
                  onClick={() => setPlatform('android')}
                  sx={{
                    flex: 1,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                    },
                  }}
                >
                  <Stack alignItems="center" spacing={2} sx={{ p: 3 }}>
                    <PhoneAndroid sx={{ fontSize: 48 }} />
                    <Typography level="title-lg">Android</Typography>
                    <Typography level="body-sm" textAlign="center">
                      Automate Android apps on emulators or physical devices
                    </Typography>
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
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: 'md',
                    },
                  }}
                >
                  <Stack alignItems="center" spacing={2} sx={{ p: 3 }}>
                    <Language sx={{ fontSize: 48 }} />
                    <Typography level="title-lg">Web</Typography>
                    <Typography level="body-sm" textAlign="center">
                      Automate web applications using browser automation
                    </Typography>
                  </Stack>
                </Card>
              </Stack>
            </Stack>
          )}

          {/* Step 2: Device Selection (Android only) */}
          {activeStep === 1 && platform === 'android' && (
            <Stack spacing={3}>
              <Typography level="title-lg" fontWeight="bold">
                Select Device
              </Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Choose how to run your Android automation
              </Typography>

              <FormControl>
                <FormLabel>Device Type</FormLabel>
                <RadioGroup value={device} onChange={(e) => setDevice(e.target.value)}>
                  <Radio value="emulator" label="Emulator (auto-start)" />
                  <Radio value="physical" label="Physical Device" />
                </RadioGroup>
              </FormControl>

              {device === 'physical' && (
                <FormControl>
                  <FormLabel>Device ID</FormLabel>
                  <Input
                    placeholder="e.g., 192.168.1.5:5555"
                    onChange={(e) => setDevice(e.target.value)}
                  />
                  <Typography level="body-xs" textColor="text.secondary" sx={{ mt: 0.5 }}>
                    Run "adb devices" to see connected devices
                  </Typography>
                </FormControl>
              )}
            </Stack>
          )}

          {/* Step 3: Project Details */}
          {activeStep === 2 && (
            <Stack spacing={3}>
              <Typography level="title-lg" fontWeight="bold">
                Project Details
              </Typography>
              <Typography level="body-sm" textColor="text.secondary">
                Provide information about your project
              </Typography>

              <FormControl required>
                <FormLabel>Project Name</FormLabel>
                <Input
                  placeholder="e.g., Instagram Automation"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </FormControl>

              {platform === 'web' && (
                <FormControl required>
                  <FormLabel>Website URL</FormLabel>
                  <Input
                    placeholder="e.g., https://instagram.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </FormControl>
              )}

              <Box sx={{ p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
                <Typography level="body-sm" textColor="text.secondary">
                  <strong>Note:</strong> A workspace directory will be created at{' '}
                  <code>~/Documents/{projectName || 'ProjectName'}</code>
                </Typography>
              </Box>
            </Stack>
          )}

          {/* Navigation Buttons */}
          <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              color="neutral"
              startDecorator={<ArrowBack />}
              onClick={handleBack}
              disabled={activeStep === 0}
            >
              Back
            </Button>

            {activeStep === 2 ? (
              <Button
                variant="solid"
                color="primary"
                onClick={handleCreate}
                disabled={!canProceed() || loading}
                loading={loading}
              >
                Create Project
              </Button>
            ) : (
              <Button
                variant="solid"
                color="primary"
                endDecorator={<ArrowForward />}
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Next
              </Button>
            )}
          </Stack>
        </Sheet>
      </Box>
    </Box>
  )
}
