import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SUPPORTED_LANGUAGES, changeLanguage } from '@/i18n'
import type { PreferencesSettings } from '@/hooks/useSettings'

interface PreferencesSettingsCardProps {
  preferencesSettings: PreferencesSettings
  setPreferencesSettings: (settings: PreferencesSettings) => void
}

export function PreferencesSettingsCard({
  preferencesSettings,
  setPreferencesSettings,
}: PreferencesSettingsCardProps) {
  const { t } = useTranslation()

  const handleLanguageChange = async (value: 'en' | 'ko') => {
    // Update the settings state
    setPreferencesSettings({
      ...preferencesSettings,
      systemLanguage: value,
    })
    // Change the i18n language immediately for preview
    await changeLanguage(value)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          {t('settings.preferencesConfig.title')}
        </CardTitle>
        <CardDescription>
          {t('settings.preferencesConfig.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* System Language */}
        <div className="space-y-2">
          <Label htmlFor="systemLanguage">
            {t('settings.preferencesConfig.systemLanguage')}
          </Label>
          <p className="text-sm text-muted-foreground">
            {t('settings.preferencesConfig.systemLanguageDesc')}
          </p>
          <Select
            value={preferencesSettings.systemLanguage}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger id="systemLanguage" className="w-[200px]">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <span className="flex items-center gap-2">
                    <span>{lang.nativeName}</span>
                    <span className="text-muted-foreground">({lang.name})</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Analytics Notice */}
        <div className="space-y-2 pt-4 border-t">
          <Label>{t('settings.preferencesConfig.analytics')}</Label>
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">
              {t('settings.preferencesConfig.analyticsTitle')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('settings.preferencesConfig.analyticsDesc')}
            </p>
            <button
              type="button"
              onClick={() => window.electronAPI.openExternal('https://github.com/FigmaAI/KleverDesktop/blob/main/PRIVACY.md')}
              className="text-sm text-primary hover:underline"
            >
              {t('settings.preferencesConfig.analyticsLearnMore')} →
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
