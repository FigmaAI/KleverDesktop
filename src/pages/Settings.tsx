import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Save,
  CheckCircle,
  Palette,
  Brain,
  Smartphone,
  Sparkles,
  Image as ImageIcon,
  Info,
  Menu,
  AlertTriangle,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BlurFade } from '@/components/magicui/blur-fade'
import { cn } from '@/lib/utils'
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
  icon: React.ElementType
}

export function Settings() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [hardResetDialogOpen, setHardResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [isHardResetting, setIsHardResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hardResetErrorMessage, setHardResetErrorMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('appearance')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

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
  const menuItems: MenuItem[] = useMemo(
    () => [
      { id: 'appearance', label: 'Appearance', icon: Palette },
      { id: 'model', label: 'Model', icon: Brain },
      { id: 'platform', label: 'Platform', icon: Smartphone },
      { id: 'agent', label: 'Agent', icon: Sparkles },
      { id: 'image', label: 'Image', icon: ImageIcon },
      { id: 'system', label: 'System Info', icon: Info },
      { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
    ],
    []
  )

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
      const currentSnapshot = JSON.stringify({
        modelConfig,
        platformSettings,
        agentSettings,
        imageSettings,
      })

      if (currentSnapshot !== settingsSnapshot.current) {
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
      const result = await window.electronAPI.configReset()

      if (result.success) {
        // Reload to re-check setup status
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

  const handleHardReset = async () => {
    setIsHardResetting(true)
    setHardResetErrorMessage(null)

    try {
      const result = await window.electronAPI.configHardReset()

      if (result.success) {
        console.log('[Settings] Hard reset successful, restarting app...')
        await window.electronAPI.appRestart()
      } else {
        const errorMsg = result.error || 'Unknown error occurred'
        console.error('[Settings] Failed to perform hard reset:', errorMsg)
        setHardResetErrorMessage(`Failed to perform hard reset: ${errorMsg}`)
        setIsHardResetting(false)
      }
    } catch (error) {
      console.error('[Settings] Error performing hard reset:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setHardResetErrorMessage(`An error occurred while performing hard reset: ${errorMsg}`)
      setIsHardResetting(false)
    }
  }

  const handleManualSave = async () => {
    await saveSettings()
    setHasChanges(false)
  }

  const scrollToSection = useCallback((section: SettingsSection) => {
    setActiveSection(section)
    setSidebarOpen(false)
    const element = sectionRefs.current[section]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // Sidebar menu component (reusable for both desktop and mobile)
  const SidebarMenu = useMemo(
    () => (
      <nav className="space-y-1 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                activeSection === item.id
                  ? item.id === 'danger'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          )
        })}
      </nav>
    ),
    [menuItems, activeSection, scrollToSection]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure your application preferences</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <Alert variant="success" className="w-auto py-2">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Saved!</AlertDescription>
            </Alert>
          )}
          {saveError && (
            <Alert variant="destructive" className="w-auto py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{saveError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleManualSave} disabled={!hasChanges || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside className="hidden w-64 border-r bg-background md:block">
          {SidebarMenu}
        </aside>

        {/* Mobile Sheet */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Settings Menu</SheetTitle>
              <SheetDescription>Navigate to different settings sections</SheetDescription>
            </SheetHeader>
            {SidebarMenu}
          </SheetContent>
        </Sheet>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Appearance */}
            <BlurFade delay={0.1}>
              <Card
                ref={(el) => (sectionRefs.current.appearance = el)}
                className="scroll-mt-6"
              >
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>Choose your preferred color theme</CardDescription>
                </CardHeader>
                <CardContent>
                  <ToggleGroup
                    type="single"
                    value={theme}
                    onValueChange={(value) => value && setTheme(value as typeof theme)}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="system" className="gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </ToggleGroupItem>
                    <ToggleGroupItem value="light" className="gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </ToggleGroupItem>
                    <ToggleGroupItem value="dark" className="gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </ToggleGroupItem>
                  </ToggleGroup>
                </CardContent>
              </Card>
            </BlurFade>

            {/* Model Configuration */}
            <BlurFade delay={0.2}>
              <div ref={(el) => (sectionRefs.current.model = el)} className="scroll-mt-6">
                <ModelSettingsCard modelConfig={modelConfig} setModelConfig={setModelConfig} />
              </div>
            </BlurFade>

            {/* Platform Configuration */}
            <BlurFade delay={0.3}>
              <div ref={(el) => (sectionRefs.current.platform = el)} className="scroll-mt-6">
                <PlatformSettingsCard
                  platformSettings={platformSettings}
                  setPlatformSettings={setPlatformSettings}
                />
              </div>
            </BlurFade>

            {/* Agent Behavior */}
            <BlurFade delay={0.4}>
              <div ref={(el) => (sectionRefs.current.agent = el)} className="scroll-mt-6">
                <AgentSettingsCard agentSettings={agentSettings} setAgentSettings={setAgentSettings} />
              </div>
            </BlurFade>

            {/* Image Optimization */}
            <BlurFade delay={0.5}>
              <div ref={(el) => (sectionRefs.current.image = el)} className="scroll-mt-6">
                <ImageSettingsCard imageSettings={imageSettings} setImageSettings={setImageSettings} />
              </div>
            </BlurFade>

            {/* System Information */}
            <BlurFade delay={0.6}>
              <div ref={(el) => (sectionRefs.current.system = el)} className="scroll-mt-6">
                <SystemInfoCard systemInfo={systemInfo} />
              </div>
            </BlurFade>

            {/* Danger Zone */}
            <BlurFade delay={0.7}>
              <Card
                ref={(el) => (sectionRefs.current.danger = el)}
                className="scroll-mt-6 border-destructive/50"
              >
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Reset Configuration */}
                  <div>
                    <h3 className="mb-1 text-base font-semibold">Reset Configuration</h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Delete configuration file and return to setup wizard
                    </p>
                    <Button
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                      onClick={() => setResetDialogOpen(true)}
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Reset Configuration
                    </Button>
                  </div>

                  <Separator />

                  {/* Hard Reset */}
                  <div>
                    <h3 className="mb-1 text-base font-semibold text-destructive">
                      Hard Reset (Delete All Data)
                    </h3>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Delete entire user data directory including all projects, settings, and Python
                      runtime
                    </p>
                    <Button
                      variant="destructive"
                      onClick={() => setHardResetDialogOpen(true)}
                    >
                      <AlertCircle className="mr-2 h-4 w-4" />
                      Hard Reset All Data
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          </div>
        </main>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => !isResetting && setResetDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Reset Configuration?
            </DialogTitle>
            <DialogDescription>
              This will delete all your settings and redirect you to the setup wizard.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">This will delete:</p>
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>AI model configuration</li>
              <li>API keys and endpoints</li>
              <li>All other preferences</li>
            </ul>
            <p className="text-sm font-semibold">
              You will be redirected to the setup wizard to reconfigure everything.
            </p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetDialogOpen(false)
                setErrorMessage(null)
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetConfig}
              disabled={isResetting}
            >
              {isResetting ? 'Resetting...' : 'Yes, Reset Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Reset Confirmation Dialog */}
      <Dialog
        open={hardResetDialogOpen}
        onOpenChange={(open) => !isHardResetting && setHardResetDialogOpen(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Hard Reset All Data?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete EVERYTHING in your user data directory.
            </DialogDescription>
          </DialogHeader>

          {hardResetErrorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{hardResetErrorMessage}</AlertDescription>
            </Alert>
          )}

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>⚠️ WARNING: This will delete EVERYTHING!</AlertTitle>
            <AlertDescription>
              This operation will permanently delete the entire <code>~/.klever-desktop/</code>{' '}
              directory.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm font-medium">This will permanently delete:</p>
            <ul className="list-disc space-y-1 pl-6 text-sm font-semibold text-muted-foreground">
              <li>All projects and tasks</li>
              <li>All configuration and settings</li>
              <li>Python runtime and installed packages</li>
              <li>All other application data</li>
            </ul>
            <p className="text-sm font-bold text-destructive">
              This action is IRREVERSIBLE and cannot be undone!
            </p>
            <p className="text-sm">
              You will need to go through the complete setup process again from scratch.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setHardResetDialogOpen(false)
                setHardResetErrorMessage(null)
              }}
              disabled={isHardResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleHardReset}
              disabled={isHardResetting}
            >
              {isHardResetting ? 'Resetting...' : 'Yes, Delete Everything'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
