import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Sheet,
  Typography,
  Stack,
  Modal,
  ModalDialog,
  ModalClose,
  Divider,
  Alert,
  ToggleButtonGroup,
  useColorScheme,
  CircularProgress,
} from '@mui/joy'
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  DarkMode,
  LightMode,
  Contrast,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { useSettings } from '@/hooks/useSettings'
import { ModelSettingsCard } from '@/components/ModelSettingsCard'
import { PlatformSettingsCard } from '@/components/PlatformSettingsCard'
import { AgentSettingsCard } from '@/components/AgentSettingsCard'
import { ImageSettingsCard } from '@/components/ImageSettingsCard'
import { SystemInfoCard } from '@/components/SystemInfoCard'

export function Settings() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { mode, setMode } = useColorScheme()

  // Use the settings hook
  const {
    modelConfig,
    setModelConfig,
    platformSettings,
    setPlatformSettings,
    agentSettings,
    setAgentSettings,
    imageSettings,
    setImageSettings,
    systemInfo,
    loading,
    saving,
    saveError,
    saveSuccess,
    saveSettings,
  } = useSettings()

  // Auto-save with debounce
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (hasChanges && !loading) {
      const timeoutId = window.setTimeout(() => {
        saveSettings()
        setHasChanges(false)
      }, 1000) // Auto-save after 1 second of no changes

      return () => window.clearTimeout(timeoutId)
    }
  }, [hasChanges, loading, saveSettings])

  // Mark as changed whenever settings update
  useEffect(() => {
    if (!loading) {
      setHasChanges(true)
    }
  }, [modelConfig, platformSettings, agentSettings, imageSettings, loading])

  const handleResetConfig = async () => {
    setIsResetting(true)
    setErrorMessage(null)

    try {
      console.log('[Settings] Calling configReset...')
      const result = await window.electronAPI.configReset()
      console.log('[Settings] configReset result:', result)

      if (result.success) {
        console.log('[Settings] Configuration reset successful, redirecting to setup...')
        // Reload the page to trigger App.tsx to redirect to setup wizard
        window.location.href = '/setup'
      } else {
        const errorMsg = result.error || 'Unknown error occurred'
        console.error('[Settings] Failed to reset configuration:', errorMsg)
        setErrorMessage(`Failed to reset configuration: ${errorMsg}`)
        setIsResetting(false)
      }
    } catch (error) {
      console.error('[Settings] Error resetting configuration:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorMessage(`An error occurred while resetting configuration: ${errorMsg}`)
      setIsResetting(false)
    }
  }

  const handleManualSave = async () => {
    await saveSettings()
    setHasChanges(false)
  }

  if (loading) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.body',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size="lg" />
          <Typography level="body-md" textColor="text.secondary">
            Loading settings...
          </Typography>
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      {/* Header with Save Button */}
      <Box
        sx={{
          p: 3,
          pb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.surface',
        }}
      >
        <Box>
          <Typography level="h2" fontWeight="bold">
            Settings
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Configure your application preferences
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {saveSuccess && (
            <Alert
              color="success"
              variant="soft"
              size="sm"
              startDecorator={<CheckCircleIcon />}
            >
              Saved!
            </Alert>
          )}
          {saveError && (
            <Alert
              color="danger"
              variant="soft"
              size="sm"
              startDecorator={<ErrorIcon />}
            >
              {saveError}
            </Alert>
          )}
          <Button
            color="primary"
            startDecorator={<SaveIcon />}
            onClick={handleManualSave}
            loading={saving}
            disabled={!hasChanges || saving}
          >
            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </Stack>
      </Box>

      {/* Settings Content */}
      <Box sx={{ p: 4, flex: 1, overflow: 'auto' }}>
        <Stack spacing={3}>
          {/* Appearance */}
          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 'md',
              bgcolor: 'background.surface',
            }}
          >
            <Typography level="title-lg" sx={{ mb: 1 }}>
              Appearance
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              Choose your preferred color theme
            </Typography>
            <ToggleButtonGroup
              value={mode}
              onChange={(_, newValue) => {
                if (newValue !== null) {
                  setMode(newValue as 'system' | 'light' | 'dark')
                }
              }}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              <Button value="system" startDecorator={<Contrast />} sx={{ flex: { xs: 1, sm: 'none' } }}>
                System
              </Button>
              <Button value="light" startDecorator={<LightMode />} sx={{ flex: { xs: 1, sm: 'none' } }}>
                Light
              </Button>
              <Button value="dark" startDecorator={<DarkMode />} sx={{ flex: { xs: 1, sm: 'none' } }}>
                Dark
              </Button>
            </ToggleButtonGroup>
          </Sheet>

          {/* Model Configuration */}
          <ModelSettingsCard modelConfig={modelConfig} setModelConfig={setModelConfig} />

          {/* Platform Configuration */}
          <PlatformSettingsCard
            platformSettings={platformSettings}
            setPlatformSettings={setPlatformSettings}
          />

          {/* Agent Behavior */}
          <AgentSettingsCard agentSettings={agentSettings} setAgentSettings={setAgentSettings} />

          {/* Image Optimization */}
          <ImageSettingsCard imageSettings={imageSettings} setImageSettings={setImageSettings} />

          {/* System Information */}
          <SystemInfoCard systemInfo={systemInfo} />

          <Divider sx={{ my: 2 }} />

          {/* Reset Configuration Section */}
          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 'md',
              bgcolor: 'background.surface',
              borderColor: 'danger.outlinedBorder',
            }}
          >
            <Typography level="title-lg" sx={{ mb: 1 }} textColor="danger.plainColor">
              Danger Zone
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              Reset all settings and return to setup wizard
            </Typography>
            <Button
              color="danger"
              variant="outlined"
              startDecorator={<WarningIcon />}
              onClick={() => setResetDialogOpen(true)}
            >
              Reset Configuration
            </Button>
          </Sheet>
        </Stack>
      </Box>

      {/* Reset Confirmation Dialog */}
      <Modal open={resetDialogOpen} onClose={() => !isResetting && setResetDialogOpen(false)}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 500 }}>
          {!isResetting && <ModalClose />}
          <Typography level="h4" startDecorator={<WarningIcon color="warning" />}>
            Reset Configuration?
          </Typography>
          <Divider />

          {errorMessage && (
            <Alert color="danger" variant="soft" startDecorator={<ErrorIcon />} sx={{ mt: 2 }}>
              <Box>
                <Typography level="title-sm" fontWeight="bold">
                  Error
                </Typography>
                <Typography level="body-sm">{errorMessage}</Typography>
              </Box>
            </Alert>
          )}

          <Typography level="body-md" sx={{ mt: errorMessage ? 2 : 1 }}>
            This will delete all your settings including:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mt: 1 }}>
            <Typography component="li" level="body-sm">
              AI model configuration
            </Typography>
            <Typography component="li" level="body-sm">
              API keys and endpoints
            </Typography>
            <Typography component="li" level="body-sm">
              All other preferences
            </Typography>
          </Box>
          <Typography level="body-md" sx={{ mt: 2, fontWeight: 'bold' }}>
            You will be redirected to the setup wizard to reconfigure everything.
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => {
                setResetDialogOpen(false)
                setErrorMessage(null)
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              loading={isResetting}
              onClick={handleResetConfig}
              disabled={isResetting}
            >
              Yes, Reset Configuration
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  )
}
