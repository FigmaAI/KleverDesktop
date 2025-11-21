import { FolderOpen } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface PlatformConfigStepProps {
  androidSdkPath: string
  setAndroidSdkPath: (path: string) => void
}

export function PlatformConfigStep({
  androidSdkPath,
  setAndroidSdkPath,
}: PlatformConfigStepProps) {
  const handleBrowse = async () => {
    const selectedPath = await window.electronAPI.showFolderSelectDialog()
    if (selectedPath) {
      setAndroidSdkPath(selectedPath)
    }
  }

  return (
    <BlurFade key="step-1" delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>Platform Configuration</CardTitle>
          <CardDescription>Configure platform-specific settings for automation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Android SDK Path */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Android SDK Path
              </Label>
              <div className="flex gap-2">
                <Input
                  value={androidSdkPath}
                  onChange={(e) => setAndroidSdkPath(e.target.value)}
                  placeholder="/Volumes/Backup/Android-SDK"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowse}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Path to your Android SDK directory (contains platform-tools and emulator
                folders).
                <br />
                This is required for Android device automation via ADB.
              </p>
            </div>

            {/* Info Box */}
            <Alert>
              <AlertDescription>
                <p className="font-semibold text-sm mb-2">How to find your Android SDK path</p>
                <div className="text-sm space-y-1">
                  <p>
                    • Open Android Studio → Preferences → Appearance & Behavior → System
                    Settings → Android SDK
                  </p>
                  <p>
                    • The path is shown at the top (e.g., /Users/username/Library/Android/sdk)
                  </p>
                  <p>
                    • You can also use <code className="px-1 py-0.5 bg-muted rounded">which adb</code> in
                    terminal and remove &quot;/platform-tools/adb&quot;
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Note about other settings */}
            <Alert variant="secondary">
              <AlertDescription>
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> Other platform settings (screenshot directory, web
                  browser settings, etc.) use default values and can be customized later in the
                  Settings page.
                </p>
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
