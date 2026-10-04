import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChatGPTAccountCard } from '@/components/ChatGPTAccountCard'
import { AndroidSetupCard } from '@/components/AndroidSetupCard'
import { useSettings } from '@/hooks/useSettings'
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from '@/i18n'

interface SettingsProps {
  onSaveRefChange: (save: (() => Promise<void>) | null) => void
  onHasChangesChange: (changed: boolean) => void
  onSavingChange: (saving: boolean) => void
  onCanSaveChange: (canSave: boolean) => void
}

export function Settings({ onSaveRefChange, onHasChangesChange, onSavingChange, onCanSaveChange }: SettingsProps) {
  const { t } = useTranslation()
  const { config, setConfig, hasChanges, loading, loadError, saving, saveSettings, loadSettings } = useSettings()

  useEffect(() => {
    if (loading || loadError) return
    onHasChangesChange(hasChanges)
  }, [hasChanges, loading, loadError, onHasChangesChange])

  useEffect(() => { onSavingChange(saving) }, [saving, onSavingChange])
  useEffect(() => { onCanSaveChange(!loading && !loadError) }, [loading, loadError, onCanSaveChange])

  const save = useCallback(async () => {
    try {
      await saveSettings()
      toast.success(t('settings.saveSuccess'))
    } catch (reason) {
      toast.error(t('settings.saveFailed'), { description: reason instanceof Error ? reason.message : undefined })
    }
  }, [saveSettings, t])

  useEffect(() => {
    onSaveRefChange(save)
    return () => onSaveRefChange(null)
  }, [save, onSaveRefChange])

  if (loadError) return <div className="p-6 space-y-4"><Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert><Button variant="outline" onClick={loadSettings}>{t('native.refresh')}</Button></div>
  if (loading) return <div className="p-6 text-sm text-muted-foreground">{t('settings.loading')}</div>

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <ChatGPTAccountCard />
        <AndroidSetupCard>
          <Label htmlFor="sdkPath">{t('native.sdkPath')}</Label>
          <p className="text-sm text-muted-foreground">{t('native.sdkDescription')}</p>
          <div className="flex gap-2">
            <Input id="sdkPath" value={config.android.sdkPath} onChange={(event) => setConfig({ ...config, android: { ...config.android, sdkPath: event.target.value } })} placeholder={t('native.sdkAutomatic')} />
            <Button variant="outline" onClick={async () => {
              const path = await window.electronAPI.showFolderSelectDialog()
              if (path) setConfig({ ...config, android: { ...config.android, sdkPath: path } })
            }}>{t('projects.createDialog.browse')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('native.sdkSaveHint')}</p>
        </AndroidSetupCard>
        <Card>
          <CardHeader><CardTitle>{t('settings.preferences')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="language">{t('settings.preferencesConfig.systemLanguage')}</Label>
            <Select value={config.preferences.systemLanguage} onValueChange={(value) => {
              const language = value as SupportedLanguage
              setConfig({ ...config, preferences: { ...config.preferences, systemLanguage: language } })
              void changeLanguage(language)
            }}>
              <SelectTrigger id="language" className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>{SUPPORTED_LANGUAGES.map((language) => <SelectItem key={language.code} value={language.code}>{language.nativeName}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
