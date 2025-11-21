import { Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ImageSettings } from '@/hooks/useSettings'

interface ImageSettingsCardProps {
  imageSettings: ImageSettings
  setImageSettings: (settings: ImageSettings) => void
}

export function ImageSettingsCard({ imageSettings, setImageSettings }: ImageSettingsCardProps) {
  const estimatedSize = Math.round(
    (imageSettings.imageMaxWidth * imageSettings.imageMaxHeight * 3 * imageSettings.imageQuality) /
      100 /
      1024
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Image Optimization</CardTitle>
        <CardDescription>
          Configure image processing settings for screenshots and UI captures
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          {/* Optimize Images Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label>Enable Image Optimization</Label>
              <p className="text-sm text-muted-foreground">
                Compress and resize images to reduce file size and improve performance
              </p>
            </div>
            <Switch
              checked={imageSettings.optimizeImages}
              onCheckedChange={(checked) =>
                setImageSettings({
                  ...imageSettings,
                  optimizeImages: checked,
                })
              }
            />
          </div>

          {imageSettings.optimizeImages && (
            <div className="space-y-6">
              {/* Max Width */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help">Maximum Width</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      Images wider than this will be resized while maintaining aspect ratio
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-semibold">
                    {imageSettings.imageMaxWidth}px
                  </span>
                </div>
                <Slider
                  value={[imageSettings.imageMaxWidth]}
                  onValueChange={(value) =>
                    setImageSettings({
                      ...imageSettings,
                      imageMaxWidth: value[0],
                    })
                  }
                  min={256}
                  max={2048}
                  step={64}
                  className="w-full"
                />
              </div>

              {/* Max Height */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help">Maximum Height</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      Images taller than this will be resized while maintaining aspect ratio
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-semibold">
                    {imageSettings.imageMaxHeight}px
                  </span>
                </div>
                <Slider
                  value={[imageSettings.imageMaxHeight]}
                  onValueChange={(value) =>
                    setImageSettings({
                      ...imageSettings,
                      imageMaxHeight: value[0],
                    })
                  }
                  min={256}
                  max={2048}
                  step={64}
                  className="w-full"
                />
              </div>

              {/* Image Quality */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Label className="cursor-help">Image Quality</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      JPEG compression quality (higher = better quality, larger files)
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-semibold">{imageSettings.imageQuality}%</span>
                </div>
                <Slider
                  value={[imageSettings.imageQuality]}
                  onValueChange={(value) =>
                    setImageSettings({
                      ...imageSettings,
                      imageQuality: value[0],
                    })
                  }
                  min={10}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* Estimated Size Info */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Estimated File Size</AlertTitle>
                <AlertDescription>
                  <p>Approximately {estimatedSize}KB per image</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Based on {imageSettings.imageMaxWidth}×{imageSettings.imageMaxHeight} at{' '}
                    {imageSettings.imageQuality}% quality
                  </p>
                </AlertDescription>
              </Alert>

              {/* Recommendations */}
              <div className="rounded-md border border-green-500/50 bg-green-50 p-4 dark:bg-green-950/20">
                <p className="mb-2 text-sm font-semibold">Recommended Settings</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• For mobile devices: 512×512 at 85% quality</li>
                  <li>• For web automation: 1024×1024 at 85% quality</li>
                  <li>• For high-detail analysis: 2048×2048 at 95% quality</li>
                  <li>• Lower quality (50-70%) for faster processing</li>
                </ul>
              </div>
            </div>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
