import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const estimatedSize = Math.round(
    (imageSettings.imageMaxWidth * imageSettings.imageMaxHeight * 3 * imageSettings.imageQuality) /
      100 /
      1024
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.imageConfig.title')}</CardTitle>
        <CardDescription>
          {t('settings.imageConfig.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <TooltipProvider>
          {/* Optimize Images Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label>{t('settings.imageConfig.enableOptimization')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('settings.imageConfig.enableOptimizationDesc')}
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
                      <Label className="cursor-help">{t('settings.imageConfig.maxWidth')}</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.imageConfig.maxWidthTooltip')}
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
                      <Label className="cursor-help">{t('settings.imageConfig.maxHeight')}</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.imageConfig.maxHeightTooltip')}
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
                      <Label className="cursor-help">{t('settings.imageConfig.quality')}</Label>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('settings.imageConfig.qualityTooltip')}
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
                <AlertTitle>{t('settings.imageConfig.estimatedSize')}</AlertTitle>
                <AlertDescription>
                  <p>{t('settings.imageConfig.estimatedSizeDesc', { size: estimatedSize })}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('settings.imageConfig.estimatedSizeDetail', {
                      width: imageSettings.imageMaxWidth,
                      height: imageSettings.imageMaxHeight,
                      quality: imageSettings.imageQuality
                    })}
                  </p>
                </AlertDescription>
              </Alert>

              {/* Recommendations */}
              <div className="rounded-md border border-green-500/50 bg-green-50 p-4 dark:bg-green-950/20">
                <p className="mb-2 text-sm font-semibold">{t('settings.imageConfig.recommendedSettings')}</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>• {t('settings.imageConfig.recommendMobile')}</li>
                  <li>• {t('settings.imageConfig.recommendWeb')}</li>
                  <li>• {t('settings.imageConfig.recommendHighDetail')}</li>
                  <li>• {t('settings.imageConfig.recommendFast')}</li>
                </ul>
              </div>
            </div>
          )}
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
