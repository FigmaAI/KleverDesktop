import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Slider,
  Switch,
  Alert,
} from '@mui/joy'
import { Info as InfoIcon } from '@mui/icons-material'
import { ImageSettings } from '@/hooks/useSettings'

interface ImageSettingsCardProps {
  imageSettings: ImageSettings
  setImageSettings: (settings: ImageSettings) => void
}

export function ImageSettingsCard({ imageSettings, setImageSettings }: ImageSettingsCardProps) {
  const estimatedSize = Math.round(
    (imageSettings.imageMaxWidth * imageSettings.imageMaxHeight * 3 * imageSettings.imageQuality) / 100 / 1024
  )

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 'md',
        bgcolor: 'background.surface',
      }}
    >
      <Typography level="title-lg" sx={{ mb: 1 }}>
        Image Optimization
      </Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
        Configure image processing settings for screenshots and UI captures
      </Typography>

      <Stack spacing={3}>
        {/* Optimize Images Toggle */}
        <FormControl orientation="horizontal" sx={{ justifyContent: 'space-between' }}>
          <Box>
            <FormLabel>Enable Image Optimization</FormLabel>
            <FormHelperText>
              Compress and resize images to reduce file size and improve performance
            </FormHelperText>
          </Box>
          <Switch
            checked={imageSettings.optimizeImages}
            onChange={(e) =>
              setImageSettings({
                ...imageSettings,
                optimizeImages: e.target.checked,
              })
            }
          />
        </FormControl>

        {imageSettings.optimizeImages && (
          <>
            {/* Max Width */}
            <FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <FormLabel>Maximum Width</FormLabel>
                <Typography level="body-sm" fontWeight="bold">
                  {imageSettings.imageMaxWidth}px
                </Typography>
              </Box>
              <Slider
                value={imageSettings.imageMaxWidth}
                onChange={(_, value) =>
                  setImageSettings({
                    ...imageSettings,
                    imageMaxWidth: value as number,
                  })
                }
                min={256}
                max={2048}
                step={64}
                marks={[
                  { value: 256, label: '256' },
                  { value: 512, label: '512' },
                  { value: 1024, label: '1024' },
                  { value: 2048, label: '2048' },
                ]}
              />
              <FormHelperText>
                Images wider than this will be resized while maintaining aspect ratio
              </FormHelperText>
            </FormControl>

            {/* Max Height */}
            <FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <FormLabel>Maximum Height</FormLabel>
                <Typography level="body-sm" fontWeight="bold">
                  {imageSettings.imageMaxHeight}px
                </Typography>
              </Box>
              <Slider
                value={imageSettings.imageMaxHeight}
                onChange={(_, value) =>
                  setImageSettings({
                    ...imageSettings,
                    imageMaxHeight: value as number,
                  })
                }
                min={256}
                max={2048}
                step={64}
                marks={[
                  { value: 256, label: '256' },
                  { value: 512, label: '512' },
                  { value: 1024, label: '1024' },
                  { value: 2048, label: '2048' },
                ]}
              />
              <FormHelperText>
                Images taller than this will be resized while maintaining aspect ratio
              </FormHelperText>
            </FormControl>

            {/* Image Quality */}
            <FormControl>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <FormLabel>Image Quality</FormLabel>
                <Typography level="body-sm" fontWeight="bold">
                  {imageSettings.imageQuality}%
                </Typography>
              </Box>
              <Slider
                value={imageSettings.imageQuality}
                onChange={(_, value) =>
                  setImageSettings({
                    ...imageSettings,
                    imageQuality: value as number,
                  })
                }
                min={10}
                max={100}
                step={5}
                marks={[
                  { value: 10, label: 'Low' },
                  { value: 50, label: 'Medium' },
                  { value: 85, label: 'High' },
                  { value: 100, label: 'Max' },
                ]}
              />
              <FormHelperText>
                JPEG compression quality (higher = better quality, larger files)
              </FormHelperText>
            </FormControl>

            {/* Estimated Size Info */}
            <Alert color="primary" variant="soft" startDecorator={<InfoIcon />}>
              <Box>
                <Typography level="title-sm" fontWeight="bold">
                  Estimated File Size
                </Typography>
                <Typography level="body-sm">
                  Approximately {estimatedSize}KB per image
                  <br />
                  <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>
                    Based on {imageSettings.imageMaxWidth}×{imageSettings.imageMaxHeight} at {imageSettings.imageQuality}% quality
                  </Typography>
                </Typography>
              </Box>
            </Alert>

            {/* Recommendations */}
            <Box
              sx={{
                p: 2,
                borderRadius: 'sm',
                bgcolor: 'success.softBg',
                border: '1px solid',
                borderColor: 'success.outlinedBorder',
              }}
            >
              <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                Recommended Settings
              </Typography>
              <Typography level="body-xs" textColor="text.secondary">
                • For mobile devices: 512×512 at 85% quality
                <br />
                • For web automation: 1024×1024 at 85% quality
                <br />
                • For high-detail analysis: 2048×2048 at 95% quality
                <br />• Lower quality (50-70%) for faster processing
              </Typography>
            </Box>
          </>
        )}
      </Stack>
    </Sheet>
  )
}
