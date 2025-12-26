import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, AlertCircle } from 'lucide-react'
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
import { BlurFade } from '@/components/magicui/blur-fade'
import { useSettings } from '@/hooks/useSettings'
import { ModelSettingsCard } from '@/components/ModelSettingsCard'
import { PlatformSettingsCard } from '@/components/PlatformSettingsCard'
import { AgentSettingsCard } from '@/components/AgentSettingsCard'

import { PreferencesSettingsCard } from '@/components/PreferencesSettingsCard'
import type { SettingsSection } from '@/components/app-sidebar'

interface SettingsProps {
  activeSection: SettingsSection
  onSaveRefChange: (saveRef: (() => Promise<void>) | null) => void
  onHasChangesChange: (hasChanges: boolean) => void
  onSavingChange: (saving: boolean) => void
  onCanSaveChange: (canSave: boolean) => void
}

export function Settings({
  activeSection,
  onSaveRefChange,
  onHasChangesChange,
  onSavingChange,
  onCanSaveChange,
}: SettingsProps) {
  const { t } = useTranslation()
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [modelConfigValid, setModelConfigValid] = useState(true)

  // Section refs for scrolling
  const sectionRefs = useRef<Record<SettingsSection, HTMLDivElement | null>>({
    model: null,
    platform: null,
    agent: null,

    preferences: null,
    danger: null,
  })

  // Use the settings hook
  const {
    modelConfig,
    setModelConfig,
    platformSettings,
    setPlatformSettings,
    agentSettings,
    setAgentSettings,


    preferencesSettings,
    setPreferencesSettings,
    loading,
    saving,
    saveError,
    saveSuccess,
    saveSettings,
  } = useSettings()

  // Track unsaved changes
  const isInitialLoad = useRef(true)
  const settingsSnapshot = useRef<string>('')

  // Mark initial load as complete and save snapshot
  useEffect(() => {
    if (!loading && isInitialLoad.current) {
      settingsSnapshot.current = JSON.stringify({
        modelConfig,
        platformSettings,
        agentSettings,

        preferencesSettings,
      })
      isInitialLoad.current = false
    }
  }, [loading, modelConfig, platformSettings, agentSettings, preferencesSettings])

  // Show toast on save success or error
  useEffect(() => {
    if (saveSuccess) {
      toast.success(t('settings.saveSuccess'))
    }
  }, [saveSuccess, t])

  useEffect(() => {
    if (saveError) {
      toast.error(t('settings.saveFailed'), { description: saveError })
    }
  }, [saveError, t])

  // Detect changes (compare with saved snapshot)
  useEffect(() => {
    if (!loading && !isInitialLoad.current) {
      const currentSnapshot = JSON.stringify({
        modelConfig,
        platformSettings,
        agentSettings,

        preferencesSettings,
      })
      const changed = currentSnapshot !== settingsSnapshot.current
      onHasChangesChange(changed)
    }
  }, [modelConfig, platformSettings, agentSettings, preferencesSettings, loading, onHasChangesChange])

  // Update saving state
  useEffect(() => {
    onSavingChange(saving)
  }, [saving, onSavingChange])

  // Update can save state
  useEffect(() => {
    onCanSaveChange(modelConfigValid)
  }, [modelConfigValid, onCanSaveChange])

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (!modelConfigValid) {
      toast.warning(t('settings.cannotSave'), {
        description: t('settings.testApiFirst')
      })
      return
    }

    await saveSettings()
    // Update snapshot after successful save
    settingsSnapshot.current = JSON.stringify({
      modelConfig,
      platformSettings,
      agentSettings,

      preferencesSettings,
    })
    onHasChangesChange(false)
  }, [modelConfigValid, saveSettings, modelConfig, platformSettings, agentSettings, preferencesSettings, onHasChangesChange, t])

  // Expose save function to parent
  useEffect(() => {
    onSaveRefChange(handleManualSave)
    return () => onSaveRefChange(null)
  }, [handleManualSave, onSaveRefChange])

  const handleResetConfig = async () => {
    setIsResetting(true)
    setErrorMessage(null)

    try {
      const result = await window.electronAPI.configReset()

      if (result.success) {
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

  // Scroll to active section when it changes
  useEffect(() => {
    const element = sectionRefs.current[activeSection]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [activeSection])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t('settings.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Model Configuration */}
          <BlurFade delay={0.1}>
            <div ref={(el) => (sectionRefs.current.model = el)} className="scroll-mt-6">
              <ModelSettingsCard
                modelConfig={modelConfig}
                setModelConfig={setModelConfig}
                onValidationChange={setModelConfigValid}
              />
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



          {/* Preferences */}
          <BlurFade delay={0.45}>
            <div ref={(el) => (sectionRefs.current.preferences = el)} className="scroll-mt-6">
              <PreferencesSettingsCard
                preferencesSettings={preferencesSettings}
                setPreferencesSettings={setPreferencesSettings}
              />
            </div>
          </BlurFade>

          {/* Danger Zone */}
          <BlurFade delay={0.5}>
            <Card
              ref={(el) => (sectionRefs.current.danger = el)}
              className="scroll-mt-6 border-destructive/50"
            >
              <CardHeader>
                <CardTitle className="text-destructive">{t('settings.dangerZone')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="mb-1 text-base font-semibold">{t('settings.dangerZoneConfig.resetConfig')}</h3>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {t('settings.dangerZoneConfig.resetConfigDesc')}
                  </p>
                  <Button
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => setResetDialogOpen(true)}
                  >
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    {t('settings.dangerZoneConfig.resetButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </main>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => !isResetting && setResetDialogOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              {t('settings.dangerZoneConfig.resetDialogTitle')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.dangerZoneConfig.resetDialogDesc')}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-sm font-medium">{t('settings.dangerZoneConfig.resetDialogItems.title')}</p>
            <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
              <li>{t('settings.dangerZoneConfig.resetDialogItems.aiConfig')}</li>
              <li>{t('settings.dangerZoneConfig.resetDialogItems.apiKeys')}</li>
              <li>{t('settings.dangerZoneConfig.resetDialogItems.preferences')}</li>
            </ul>
            <p className="text-sm font-semibold">
              {t('settings.dangerZoneConfig.resetDialogRedirect')}
            </p>
            <p className="text-sm text-muted-foreground">{t('settings.dangerZoneConfig.resetDialogWarning')}</p>
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
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetConfig}
              disabled={isResetting}
            >
              {isResetting ? t('settings.dangerZoneConfig.resetting') : t('common.yes') + ', ' + t('settings.dangerZoneConfig.resetButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
