import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  List,
  ListItemButton,
  ListItemDecorator,
  ListItemContent,
  IconButton,
  Drawer,
} from '@mui/joy'
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  DarkMode,
  LightMode,
  Contrast,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Palette as PaletteIcon,
  SmartToy as ModelIcon,
  Devices as PlatformIcon,
  Psychology as AgentIcon,
  Image as ImageIcon,
  Info as InfoIcon,
  Menu as MenuIcon,
} from '@mui/icons-material'
import { useSettings } from '@/hooks/useSettings'
import { ModelSettingsCard } from '@/components/ModelSettingsCard'
import { PlatformSettingsCard } from '@/components/PlatformSettingsCard'
import { AgentSettingsCard } from '@/components/AgentSettingsCard'
import { ImageSettingsCard } from '@/components/ImageSettingsCard'
import { SystemInfoCard } from '@/components/SystemInfoCard'

type SettingsSection = 'appearance' | 'model' | 'platform' | 'agent' | 'image' | 'system' | 'danger'

interface MenuItem {
  id: SettingsSection
  label: string
  icon: React.ReactElement
}

export function Settings() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { mode, setMode } = useColorScheme()

  // Section refs for scrolling
  const sectionRefs = useRef<Record<SettingsSection, HTMLDivElement | null>>({
    appearance: null,
    model: null,
    platform: null,
    agent: null,
    image: null,
    system: null,
    danger: null,
  })

  // Menu items
  const menuItems: MenuItem[] = useMemo(() => [
    { id: 'appearance', label: 'Appearance', icon: <PaletteIcon /> },
    { id: 'model', label: 'Model', icon: <ModelIcon /> },
    { id: 'platform', label: 'Platform', icon: <PlatformIcon /> },
    { id: 'agent', label: 'Agent', icon: <AgentIcon /> },
    { id: 'image', label: 'Image', icon: <ImageIcon /> },
    { id: 'system', label: 'System Info', icon: <InfoIcon /> },
    { id: 'danger', label: 'Danger Zone', icon: <WarningIcon /> },
  ], [])

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
  const isInitialLoad = useRef(true)
  const settingsSnapshot = useRef<string>('')

  // Mark initial load as complete and save snapshot
  useEffect(() => {
    if (!loading && isInitialLoad.current) {
      // Save initial settings snapshot
      settingsSnapshot.current = JSON.stringify({
        modelConfig,
        platformSettings,
        agentSettings,
        imageSettings,
      })
      isInitialLoad.current = false
    }
  }, [loading, modelConfig, platformSettings, agentSettings, imageSettings])

  // Mark as changed whenever settings update (after initial load)
  useEffect(() => {
    if (!loading && !isInitialLoad.current) {
      // Compare current settings with snapshot
      const currentSnapshot = JSON.stringify({
        modelConfig,
        platformSettings,
        agentSettings,
        imageSettings,
      })

      if (currentSnapshot !== settingsSnapshot.current) {
        // Use setTimeout to avoid synchronous setState in effect
        const timeoutId = setTimeout(() => {
          setHasChanges(true)
        }, 0)
        return () => clearTimeout(timeoutId)
      }
    }
  }, [modelConfig, platformSettings, agentSettings, imageSettings, loading])

  // Auto-save after changes
  useEffect(() => {
    if (hasChanges && !loading) {
      const timeoutId = window.setTimeout(() => {
        saveSettings()
        // Update snapshot after save
        settingsSnapshot.current = JSON.stringify({
          modelConfig,
          platformSettings,
          agentSettings,
          imageSettings,
        })
        setHasChanges(false)
      }, 1000) // Auto-save after 1 second of no changes

      return () => window.clearTimeout(timeoutId)
    }
  }, [hasChanges, loading, saveSettings, modelConfig, platformSettings, agentSettings, imageSettings])

  const handleResetConfig = async () => {
    setIsResetting(true)
    setErrorMessage(null)

    try {
      console.log('[Settings] Calling configReset...')
      const result = await window.electronAPI.configReset()
      console.log('[Settings] configReset result:', result)

      if (result.success) {
        console.log('[Settings] Configuration reset successful, reloading app...')
        // Reload the entire app to re-check setup status
        window.location.reload()
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

  const scrollToSection = useCallback((section: SettingsSection) => {
    setActiveSection(section)
    setSidebarOpen(false) // Close drawer after selection
    const element = sectionRefs.current[section]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Sidebar menu component (reusable for both desktop and mobile)
  const SidebarMenu = useMemo(() => (
    <List sx={{ p: 2, gap: 0.5 }}>
      {menuItems.map((item) => (
        <ListItemButton
          key={item.id}
          selected={activeSection === item.id}
          onClick={() => scrollToSection(item.id)}
          color={item.id === 'danger' ? 'danger' : 'neutral'}
          sx={{
            borderRadius: 'sm',
            '&.Joy-selected': {
              bgcolor: item.id === 'danger' ? 'danger.softBg' : 'primary.softBg',
            },
          }}
        >
          <ListItemDecorator>{item.icon}</ListItemDecorator>
          <ListItemContent>{item.label}</ListItemContent>
        </ListItemButton>
      ))}
    </List>
  ), [menuItems, activeSection, scrollToSection])

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Mobile menu button */}
          <IconButton
            variant="outlined"
            color="neutral"
            onClick={() => setSidebarOpen(true)}
            sx={{ display: { xs: 'flex', md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box>
            <Typography level="h2" fontWeight="bold">
              Settings
            </Typography>
            <Typography level="body-md" textColor="text.secondary">
              Configure your application preferences
            </Typography>
          </Box>
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

      {/* Main Content Area with Sidebar */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Desktop Sidebar Menu */}
        <Box
          sx={{
            display: { xs: 'none', md: 'block' },
            width: 240,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.surface',
            overflow: 'auto',
          }}
        >
          {SidebarMenu}
        </Box>

        {/* Mobile Drawer Menu */}
        <Drawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
          <Box sx={{ width: 240 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography level="title-lg" fontWeight="bold">
                Settings Menu
              </Typography>
            </Box>
            {SidebarMenu}
          </Box>
        </Drawer>

        {/* Settings Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
          <Stack spacing={4}>
            {/* Appearance */}
            <Sheet
              ref={(el) => (sectionRefs.current.appearance = el)}
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 'md',
                bgcolor: 'background.surface',
                scrollMarginTop: '20px',
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
            <Box ref={(el: HTMLDivElement | null) => (sectionRefs.current.model = el)} sx={{ scrollMarginTop: '20px' }}>
              <ModelSettingsCard modelConfig={modelConfig} setModelConfig={setModelConfig} />
            </Box>

            {/* Platform Configuration */}
            <Box ref={(el: HTMLDivElement | null) => (sectionRefs.current.platform = el)} sx={{ scrollMarginTop: '20px' }}>
              <PlatformSettingsCard
                platformSettings={platformSettings}
                setPlatformSettings={setPlatformSettings}
              />
            </Box>

            {/* Agent Behavior */}
            <Box ref={(el: HTMLDivElement | null) => (sectionRefs.current.agent = el)} sx={{ scrollMarginTop: '20px' }}>
              <AgentSettingsCard agentSettings={agentSettings} setAgentSettings={setAgentSettings} />
            </Box>

            {/* Image Optimization */}
            <Box ref={(el: HTMLDivElement | null) => (sectionRefs.current.image = el)} sx={{ scrollMarginTop: '20px' }}>
              <ImageSettingsCard imageSettings={imageSettings} setImageSettings={setImageSettings} />
            </Box>

            {/* System Information */}
            <Box ref={(el: HTMLDivElement | null) => (sectionRefs.current.system = el)} sx={{ scrollMarginTop: '20px' }}>
              <SystemInfoCard systemInfo={systemInfo} />
            </Box>

            {/* Reset Configuration Section */}
            <Sheet
              ref={(el) => (sectionRefs.current.danger = el)}
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 'md',
                bgcolor: 'background.surface',
                borderColor: 'danger.outlinedBorder',
                scrollMarginTop: '20px',
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
