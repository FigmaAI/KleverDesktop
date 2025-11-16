import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  Slider,
  Switch,
  Alert,
  Tooltip,
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
            <Typography level="body-sm" textColor="text.secondary">
              Compress and resize images to reduce file size and improve performance
            </Typography>
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
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Tooltip title="Images wider than this will be resized while maintaining aspect ratio" arrow>
                  <FormLabel sx={{ minWidth: 150 }}>Maximum Width</FormLabel>
                </Tooltip>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
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
                    marks={false}
                    valueLabelDisplay="on"
                    sx={{ flex: 1 }}
                  />
                  <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                    {imageSettings.imageMaxWidth}px
                  </Typography>
                </Box>
              </Box>
            </FormControl>

            {/* Max Height */}
            <FormControl>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Tooltip title="Images taller than this will be resized while maintaining aspect ratio" arrow>
                  <FormLabel sx={{ minWidth: 150 }}>Maximum Height</FormLabel>
                </Tooltip>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
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
                    marks={false}
                    valueLabelDisplay="on"
                    sx={{ flex: 1 }}
                  />
                  <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                    {imageSettings.imageMaxHeight}px
                  </Typography>
                </Box>
              </Box>
            </FormControl>

            {/* Image Quality */}
            <FormControl>
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                <Tooltip title="JPEG compression quality (higher = better quality, larger files)" arrow>
                  <FormLabel sx={{ minWidth: 150 }}>Image Quality</FormLabel>
                </Tooltip>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
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
                    marks={false}
                    valueLabelDisplay="on"
                    sx={{ flex: 1 }}
                  />
                  <Typography level="body-sm" fontWeight="bold" sx={{ minWidth: 60, textAlign: 'right' }}>
                    {imageSettings.imageQuality}%
                  </Typography>
                </Box>
              </Box>
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
