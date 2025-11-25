import { FolderOpen, Info } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

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
          <CardDescription>Configure Android SDK path for device automation</CardDescription>
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
              <p className="text-sm text-muted-foreground">
                Path to your Android SDK directory. This is optional but recommended for Android automation.
              </p>
            </div>

            {/* How to Find SDK Path - Accordion */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2">
                <Info className="h-4 w-4" />
                How to find your Android SDK path
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="android-studio">
                  <AccordionTrigger className="text-sm">
                    If you have Android Studio installed
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>Open Android Studio → Settings (or Preferences on macOS)</li>
                      <li>Navigate to: Appearance & Behavior → System Settings → Android SDK</li>
                      <li>Copy the "Android SDK Location" path shown at the top</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="homebrew">
                  <AccordionTrigger className="text-sm">
                    If you installed via Homebrew (macOS)
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>
                        Run in terminal: <code className="px-1 py-0.5 bg-muted rounded text-xs">which adb</code>
                      </li>
                      <li>
                        The SDK path is the part before <code className="px-1 py-0.5 bg-muted rounded text-xs">/platform-tools/adb</code>
                      </li>
                      <li>
                        Example: If output is <code className="px-1 py-0.5 bg-muted rounded text-xs">/opt/homebrew/bin/adb</code>,
                        your SDK might be at <code className="px-1 py-0.5 bg-muted rounded text-xs">/opt/homebrew/Caskroom/android-sdk</code>
                      </li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="common-locations">
                  <AccordionTrigger className="text-sm">
                    Common SDK locations
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-2">
                      <li>macOS: <code className="px-1 py-0.5 bg-muted rounded text-xs">~/Library/Android/sdk</code></li>
                      <li>Windows: <code className="px-1 py-0.5 bg-muted rounded text-xs">C:\Users\[username]\AppData\Local\Android\Sdk</code></li>
                      <li>Linux: <code className="px-1 py-0.5 bg-muted rounded text-xs">~/Android/Sdk</code></li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="no-sdk">
                  <AccordionTrigger className="text-sm">
                    If you don't have Android SDK
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm text-muted-foreground">
                      The SDK was already checked in the previous step. If it's not installed,
                      you can skip this for now and install it later when needed for Android automation.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Note about other settings */}
            {/*             
            <Alert className="bg-primary/5 border-primary/20">
              <AlertDescription>
                <p className="text-sm">
                  <strong>Note:</strong> Other platform settings (screenshot directory, web
                  browser settings, etc.) use default values and can be customized later in the
                  Settings page.
                </p>
              </AlertDescription>
            </Alert> */}
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
