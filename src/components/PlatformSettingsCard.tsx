import { useState } from 'react'
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
        <CardTitle>Platform Configuration</CardTitle>
        <CardDescription>Configure Android and Web automation settings</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="android" className="gap-2">
              <Smartphone className="h-4 w-4" />
              Android
            </TabsTrigger>
            <TabsTrigger value="web" className="gap-2">
              <Globe className="h-4 w-4" />
              Web
            </TabsTrigger>
          </TabsList>

          {/* Android Settings */}
          <TabsContent value="android" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Android SDK Path</Label>
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
                  Browse
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Path to Android SDK directory (contains platform-tools and emulator folders)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Screenshot Directory</Label>
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
                Path on Android device where screenshots will be saved
              </p>
            </div>

            <div className="space-y-2">
              <Label>XML Directory</Label>
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
                Path on Android device where UI hierarchy XML files will be saved
              </p>
            </div>

            {/* Android Google Login */}
            <GoogleLoginButton platform="android" />
          </TabsContent>

          {/* Web Settings */}
          <TabsContent value="web" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Browser Type</Label>
              <Select
                value={platformSettings.webBrowserType}
                onValueChange={(value) =>
                  setPlatformSettings({
                    ...platformSettings,
                    webBrowserType: value as 'chromium' | 'firefox' | 'webkit',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chromium">Chromium</SelectItem>
                  <SelectItem value="firefox">Firefox</SelectItem>
                  <SelectItem value="webkit">WebKit (Safari)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Playwright browser engine to use for web automation
              </p>
            </div>

            <div className="space-y-2">
              <Label>Headless Mode</Label>
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
                  <SelectItem value="false">Disabled (Show browser window)</SelectItem>
                  <SelectItem value="true">Enabled (Run in background)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Whether to run browser in headless mode (no visible window)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Viewport Width</Label>
                <Input
                  type="number"
                  value={platformSettings.webViewportWidth}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      webViewportWidth: parseInt(e.target.value) || 1280,
                    })
                  }
                  min={320}
                  max={3840}
                />
                <p className="text-sm text-muted-foreground">320-3840 pixels</p>
              </div>

              <div className="space-y-2">
                <Label>Viewport Height</Label>
                <Input
                  type="number"
                  value={platformSettings.webViewportHeight}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      webViewportHeight: parseInt(e.target.value) || 720,
                    })
                  }
                  min={240}
                  max={2160}
                />
                <p className="text-sm text-muted-foreground">240-2160 pixels</p>
              </div>
            </div>

            {/* Web Google Login */}
            <GoogleLoginButton platform="web" />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
