import { motion } from 'framer-motion'
import {
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  Input,
  FormHelperText,
} from '@mui/joy'
import { Folder } from '@mui/icons-material'

interface PlatformConfigStepProps {
  androidSdkPath: string
  setAndroidSdkPath: (path: string) => void
}

export function PlatformConfigStep({
  androidSdkPath,
  setAndroidSdkPath,
}: PlatformConfigStepProps) {
  return (
    <motion.div
      key="step-1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Sheet
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 'md',
          bgcolor: 'background.surface',
        }}
      >
        <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
          Platform Configuration
        </Typography>
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
          Configure platform-specific settings for automation
        </Typography>

        <Stack spacing={3}>
          {/* Android SDK Path */}
          <FormControl>
            <FormLabel>
              <Stack direction="row" spacing={1} alignItems="center">
                <Folder fontSize="small" />
                <span>Android SDK Path</span>
              </Stack>
            </FormLabel>
            <Input
              value={androidSdkPath}
              onChange={(e) => setAndroidSdkPath(e.target.value)}
              placeholder="/Volumes/Backup/Android-SDK"
              size="lg"
            />
            <FormHelperText>
              Path to your Android SDK directory (contains platform-tools and emulator folders).
              <br />
              This is required for Android device automation via ADB.
            </FormHelperText>
          </FormControl>

          {/* Info Box */}
          <Sheet
            variant="soft"
            color="primary"
            sx={{
              p: 2,
              borderRadius: 'sm',
            }}
          >
            <Typography level="title-sm" sx={{ mb: 1 }}>
              How to find your Android SDK path
            </Typography>
            <Typography level="body-sm">
              • Open Android Studio → Preferences → Appearance & Behavior → System Settings → Android SDK
              <br />
              • The path is shown at the top (e.g., /Users/username/Library/Android/sdk)
              <br />• You can also use <code>which adb</code> in terminal and remove "/platform-tools/adb"
            </Typography>
          </Sheet>

          {/* Note about other settings */}
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              p: 2,
              borderRadius: 'sm',
            }}
          >
            <Typography level="body-sm" textColor="text.secondary">
              <strong>Note:</strong> Other platform settings (screenshot directory, web browser settings, etc.)
              use default values and can be customized later in the Settings page.
            </Typography>
          </Sheet>
        </Stack>
      </Sheet>
    </motion.div>
  )
}
