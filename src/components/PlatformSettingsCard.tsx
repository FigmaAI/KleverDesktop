import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Smartphone, Globe, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlatformSettings } from '@/hooks/useSettings'
import { GoogleLoginButton } from '@/components/GoogleLoginCard'

interface PlatformSettingsCardProps {
  platformSettings: PlatformSettings
  setPlatformSettings: (settings: PlatformSettings) => void
}

export function PlatformSettingsCard({
  platformSettings,
  setPlatformSettings,
}: PlatformSettingsCardProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>('android')

  const handleBrowseSdkPath = async () => {
    const selectedPath = await window.electronAPI.showFolderSelectDialog()
    if (selectedPath) {
      setPlatformSettings({
        ...platformSettings,
        androidSdkPath: selectedPath,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.platformConfig.title')}</CardTitle>
        <CardDescription>{t('settings.platformConfig.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" />
              {t('settings.platformConfig.android')}
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2">
              <Globe className="h-4 w-4" />
              {t('settings.platformConfig.web')}
            </TabsTrigger>
          </TabsList>

          {/* Android Settings */}
          <TabsContent value="android" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{t('settings.platformConfig.sdkPath')}</Label>
              <div className="flex gap-2">
                <Input
                  value={platformSettings.androidSdkPath}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      androidSdkPath: e.target.value,
                    })
                  }
                  placeholder="/Volumes/Backup/Android-SDK"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowseSdkPath}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  {t('settings.platformConfig.browse')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.platformConfig.sdkPathDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.platformConfig.screenshotDir')}</Label>
              <Input
                value={platformSettings.androidScreenshotDir}
                onChange={(e) =>
                  setPlatformSettings({
                    ...platformSettings,
                    androidScreenshotDir: e.target.value,
                  })
                }
                placeholder="/sdcard"
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.platformConfig.screenshotDirDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.platformConfig.xmlDir')}</Label>
              <Input
                value={platformSettings.androidXmlDir}
                onChange={(e) =>
                  setPlatformSettings({
                    ...platformSettings,
                    androidXmlDir: e.target.value,
                  })
                }
                placeholder="/sdcard"
              />
              <p className="text-sm text-muted-foreground">
                {t('settings.platformConfig.xmlDirDesc')}
              </p>
            </div>

            {/* Android Google Login */}
            <GoogleLoginButton platform="android" />
          </TabsContent>

          {/* Web Settings */}
          <TabsContent value="web" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>{t('settings.platformConfig.browserType')}</Label>
              <Select
                value={platformSettings.webBrowserType}
                onValueChange={(value) =>
                  setPlatformSettings({
                    ...platformSettings,
                    webBrowserType: value as typeof platformSettings.webBrowserType,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Chromium-based browsers */}
                  <SelectItem value="chromium">{t('settings.platformConfig.chromium')}</SelectItem>
                  <SelectItem value="chrome">{t('settings.platformConfig.chrome')}</SelectItem>
                  <SelectItem value="chrome-beta">{t('settings.platformConfig.chromeBeta')}</SelectItem>
                  <SelectItem value="chrome-dev">{t('settings.platformConfig.chromeDev')}</SelectItem>
                  <SelectItem value="chrome-canary">{t('settings.platformConfig.chromeCanary')}</SelectItem>
                  {/* Edge browsers */}
                  <SelectItem value="msedge">{t('settings.platformConfig.msedge')}</SelectItem>
                  <SelectItem value="msedge-beta">{t('settings.platformConfig.msedgeBeta')}</SelectItem>
                  <SelectItem value="msedge-dev">{t('settings.platformConfig.msedgeDev')}</SelectItem>
                  <SelectItem value="msedge-canary">{t('settings.platformConfig.msedgeCanary')}</SelectItem>
                  {/* Other engines */}
                  <SelectItem value="firefox">{t('settings.platformConfig.firefox')}</SelectItem>
                  <SelectItem value="webkit">{t('settings.platformConfig.webkit')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('settings.platformConfig.browserTypeDesc')}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t('settings.platformConfig.headless')}</Label>
              <Select
                value={platformSettings.webHeadless ? 'true' : 'false'}
                onValueChange={(value) =>
                  setPlatformSettings({
                    ...platformSettings,
                    webHeadless: value === 'true',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">{t('settings.platformConfig.headlessDisabled')}</SelectItem>
                  <SelectItem value="true">{t('settings.platformConfig.headlessEnabled')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {t('settings.platformConfig.headlessDesc')}
              </p>
            </div>

            {/* Web Google Login */}
            <GoogleLoginButton platform="web" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
