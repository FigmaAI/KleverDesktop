import { FolderOpen, ChevronRight } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { GoogleLoginButton } from '@/components/GoogleLoginCard'

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
          <CardDescription>Configure Android SDK path and Google login for automation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Android SDK Path */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Android SDK Path (Optional)
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
              <Collapsible>
                <p className="text-sm text-muted-foreground">
                  Path to your Android SDK directory. This is optional but recommended for Android automation.{' '}
                  <CollapsibleTrigger asChild>
                    <button className="inline-flex items-center text-primary hover:underline text-xs font-medium">
                      How to find it
                      <ChevronRight className="h-3 w-3 ml-0.5 transition-transform group-data-[state=open]:rotate-90" />
                    </button>
                  </CollapsibleTrigger>
                </p>
                <CollapsibleContent>
                  <div className="mt-2 border rounded-lg p-3 bg-muted/30 text-xs text-muted-foreground space-y-2">
                    <div>
                      <strong>Android Studio:</strong> Settings → System Settings → Android SDK → copy path
                    </div>
                    <div>
                      <strong>Homebrew (macOS):</strong> Run <code className="px-1 py-0.5 bg-muted rounded">which adb</code> and remove <code className="px-1 py-0.5 bg-muted rounded">/platform-tools/adb</code>
                    </div>
                    <div>
                      <strong>Common paths:</strong>
                      <ul className="ml-4 mt-1 space-y-0.5">
                        <li>macOS: <code className="px-1 py-0.5 bg-muted rounded">~/Library/Android/sdk</code></li>
                        <li>Windows: <code className="px-1 py-0.5 bg-muted rounded">%LOCALAPPDATA%\Android\Sdk</code></li>
                        <li>Linux: <code className="px-1 py-0.5 bg-muted rounded">~/Android/Sdk</code></li>
                      </ul>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>

            {/* Google Login - Web */}
            <GoogleLoginButton platform="web" />

            {/* Google Login - Android */}
            <GoogleLoginButton platform="android" />
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
