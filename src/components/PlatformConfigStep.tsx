import { FolderOpen, ExternalLink } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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

  const openLink = (url: string) => {
    window.electronAPI.openExternal(url)
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
                  placeholder="e.g., ~/Library/Android/sdk"
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleBrowse}>
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Path to your Android SDK directory (contains platform-tools, emulator, and other tools).
                <br />
                This is required for Android device automation and emulator management.
              </p>
            </div>

            {/* Installation Guide */}
            <Alert>
              <AlertTitle className="flex items-center gap-2 text-sm font-semibold">
                📥 How to install Android SDK
              </AlertTitle>
              <AlertDescription>
                <div className="text-sm space-y-3 mt-2">
                  <div>
                    <p className="font-medium mb-1">Option 1: Android Studio (Recommended)</p>
                    <p className="text-muted-foreground mb-2">
                      Install Android Studio which includes the full Android SDK
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLink('https://developer.android.com/studio')}
                      className="gap-2"
                    >
                      Download Android Studio <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <p className="font-medium mb-1">Option 2: Command Line Tools Only</p>
                    <p className="text-muted-foreground mb-2">
                      Download only the SDK command-line tools (smaller download)
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openLink('https://developer.android.com/studio#command-line-tools-only')}
                      className="gap-2"
                    >
                      Download Command Line Tools <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="border-t pt-3">
                    <p className="font-medium mb-1">After Installation:</p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                      <li>
                        Open Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK
                      </li>
                      <li>
                        Copy the SDK path shown at the top
                      </li>
                      <li>
                        Paste the path in the field above
                      </li>
                      <li>
                        Alternatively, use: <code className="px-1 py-0.5 bg-muted rounded text-xs">which adb</code> and remove "/platform-tools/adb"
                      </li>
                    </ul>
                  </div>
                </div>
              </AlertDescription>
            </Alert>

            {/* Note about other settings */}
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                <p className="text-sm">
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
