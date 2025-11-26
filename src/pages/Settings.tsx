import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import { useNavigate } from 'react-router-dom'
import {
  Save,
  Brain,
  Smartphone,
  Sparkles,
  Image as ImageIcon,
  Menu,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BlurFade } from '@/components/magicui/blur-fade'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/useSettings'
import { ModelSettingsCard } from '@/components/ModelSettingsCard'
import { PlatformSettingsCard } from '@/components/PlatformSettingsCard'
import { AgentSettingsCard } from '@/components/AgentSettingsCard'
import { ImageSettingsCard } from '@/components/ImageSettingsCard'

type SettingsSection = 'model' | 'platform' | 'agent' | 'image' | 'danger'

interface MenuItem {
  id: SettingsSection
  label: string
  icon: React.ElementType
}

export function Settings() {
  const navigate = useNavigate()
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SettingsSection>('model')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { toast } = useToast()

  // Section refs for scrolling
  const sectionRefs = useRef<Record<SettingsSection, HTMLDivElement | null>>({
    model: null,
    platform: null,
    agent: null,
    image: null,
    danger: null,
  })

  // Menu items
  const menuItems: MenuItem[] = useMemo(
    () => [
      { id: 'model', label: 'Model', icon: Brain },
      { id: 'platform', label: 'Platform', icon: Smartphone },
      { id: 'agent', label: 'Agent', icon: Sparkles },
      { id: 'image', label: 'Image', icon: ImageIcon },
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

  // Show toast on save success or error
  useEffect(() => {
    if (saveSuccess) {
      toast({ description: 'Your configuration has been updated successfully.' })
    }
  }, [saveSuccess, toast])

  useEffect(() => {
    if (saveError) {
      toast({ title: 'Save Failed', description: saveError })
    }
  }, [saveError, toast])

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
      <PageHeader
        title="Settings"
        backButton={
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleManualSave} disabled={!hasChanges || saving}>
              <Save className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">{saving ? 'Saving...' : hasChanges ? 'Save' : 'Saved'}</span>
            </Button>
          </>
        }
      />

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
            {/* Model Configuration */}
            <BlurFade delay={0.1}>
              <div ref={(el) => (sectionRefs.current.model = el)} className="scroll-mt-6">
                <ModelSettingsCard modelConfig={modelConfig} setModelConfig={setModelConfig} />
              </div>
            </BlurFade>

            {/* Platform Configuration */}
            <BlurFade delay={0.2}>
              <div ref={(el) => (sectionRefs.current.platform = el)} className="scroll-mt-6">
                <PlatformSettingsCard
                  platformSettings={platformSettings}
                  setPlatformSettings={setPlatformSettings}
                />
              </div>
            </BlurFade>

            {/* Agent Behavior */}
            <BlurFade delay={0.3}>
              <div ref={(el) => (sectionRefs.current.agent = el)} className="scroll-mt-6">
                <AgentSettingsCard agentSettings={agentSettings} setAgentSettings={setAgentSettings} />
              </div>
            </BlurFade>

            {/* Image Optimization */}
            <BlurFade delay={0.4}>
              <div ref={(el) => (sectionRefs.current.image = el)} className="scroll-mt-6">
                <ImageSettingsCard imageSettings={imageSettings} setImageSettings={setImageSettings} />
              </div>
            </BlurFade>

            {/* Danger Zone */}
            <BlurFade delay={0.6}>
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


    </div>
  )
}
