import {
  Box,
  Typography,
  Sheet,
  Stack,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Select,
  Option,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Button,
} from '@mui/joy'
import { useState } from 'react'
import { Android, Language, FolderOpen } from '@mui/icons-material'
import { PlatformSettings } from '@/hooks/useSettings'

interface PlatformSettingsCardProps {
  platformSettings: PlatformSettings
  setPlatformSettings: (settings: PlatformSettings) => void
}

export function PlatformSettingsCard({ platformSettings, setPlatformSettings }: PlatformSettingsCardProps) {
  const [activeTab, setActiveTab] = useState<number>(0)

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
    <Sheet
      variant="outlined"
      sx={{
        p: 3,
        borderRadius: 'md',
        bgcolor: 'background.surface',
      }}
    >
      <Typography level="title-lg" sx={{ mb: 1 }}>
        Platform Configuration
      </Typography>
      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
        Configure Android and Web automation settings
      </Typography>

      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
        <TabList>
          <Tab>
            <Android sx={{ mr: 1 }} />
            Android
          </Tab>
          <Tab>
            <Language sx={{ mr: 1 }} />
            Web
          </Tab>
        </TabList>

        {/* Android Settings */}
        <TabPanel value={0}>
          <Stack spacing={2.5}>
            <FormControl>
              <FormLabel>Android SDK Path</FormLabel>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input
                  value={platformSettings.androidSdkPath}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      androidSdkPath: e.target.value,
                    })
                  }
                  placeholder="/Volumes/Backup/Android-SDK"
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="outlined"
                  color="neutral"
                  startDecorator={<FolderOpen />}
                  onClick={handleBrowseSdkPath}
                >
                  Browse
                </Button>
              </Box>
              <FormHelperText>
                Path to Android SDK directory (contains platform-tools and emulator folders)
              </FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel>Screenshot Directory</FormLabel>
              <Input
                value={platformSettings.androidScreenshotDir}
                onChange={(e) =>
                  setPlatformSettings({
                    ...platformSettings,
                    androidScreenshotDir: e.target.value,
                  })
                }
                placeholder="/sdcard/Pictures"
              />
              <FormHelperText>
                Path on Android device where screenshots will be saved
              </FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel>XML Directory</FormLabel>
              <Input
                value={platformSettings.androidXmlDir}
                onChange={(e) =>
                  setPlatformSettings({
                    ...platformSettings,
                    androidXmlDir: e.target.value,
                  })
                }
                placeholder="/sdcard/Documents"
              />
              <FormHelperText>
                Path on Android device where UI hierarchy XML files will be saved
              </FormHelperText>
            </FormControl>

            <Box
              sx={{
                p: 2,
                borderRadius: 'sm',
                bgcolor: 'primary.softBg',
                border: '1px solid',
                borderColor: 'primary.outlinedBorder',
              }}
            >
              <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                Prerequisites
              </Typography>
              <Typography level="body-xs" textColor="text.secondary">
                • ADB (Android Debug Bridge) must be installed
                <br />
                • USB debugging enabled on your Android device
                <br />
                • Device connected via USB or network
              </Typography>
            </Box>
          </Stack>
        </TabPanel>

        {/* Web Settings */}
        <TabPanel value={1}>
          <Stack spacing={2.5}>
            <FormControl>
              <FormLabel>Browser Type</FormLabel>
              <Select
                value={platformSettings.webBrowserType}
                onChange={(_, value) =>
                  setPlatformSettings({
                    ...platformSettings,
                    webBrowserType: value as 'chromium' | 'firefox' | 'webkit',
                  })
                }
              >
                <Option value="chromium">Chromium</Option>
                <Option value="firefox">Firefox</Option>
                <Option value="webkit">WebKit (Safari)</Option>
              </Select>
              <FormHelperText>
                Playwright browser engine to use for web automation
              </FormHelperText>
            </FormControl>

            <FormControl>
              <FormLabel>Headless Mode</FormLabel>
              <Select
                value={platformSettings.webHeadless ? 'true' : 'false'}
                onChange={(_, value) =>
                  setPlatformSettings({
                    ...platformSettings,
                    webHeadless: value === 'true',
                  })
                }
              >
                <Option value="false">Disabled (Show browser window)</Option>
                <Option value="true">Enabled (Run in background)</Option>
              </Select>
              <FormHelperText>
                Whether to run browser in headless mode (no visible window)
              </FormHelperText>
            </FormControl>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl>
                <FormLabel>Viewport Width</FormLabel>
                <Input
                  type="number"
                  value={platformSettings.webViewportWidth}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      webViewportWidth: parseInt(e.target.value) || 1280,
                    })
                  }
                  slotProps={{
                    input: {
                      min: 320,
                      max: 3840,
                    },
                  }}
                />
                <FormHelperText>320-3840 pixels</FormHelperText>
              </FormControl>

              <FormControl>
                <FormLabel>Viewport Height</FormLabel>
                <Input
                  type="number"
                  value={platformSettings.webViewportHeight}
                  onChange={(e) =>
                    setPlatformSettings({
                      ...platformSettings,
                      webViewportHeight: parseInt(e.target.value) || 720,
                    })
                  }
                  slotProps={{
                    input: {
                      min: 240,
                      max: 2160,
                    },
                  }}
                />
                <FormHelperText>240-2160 pixels</FormHelperText>
              </FormControl>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: 'sm',
                bgcolor: 'primary.softBg',
                border: '1px solid',
                borderColor: 'primary.outlinedBorder',
              }}
            >
              <Typography level="body-sm" fontWeight="bold" sx={{ mb: 0.5 }}>
                Prerequisites
              </Typography>
              <Typography level="body-xs" textColor="text.secondary">
                • Playwright must be installed (playwright install)
                <br />
                • Browser binaries for selected browser type
                <br />• Network access for web automation tasks
              </Typography>
            </Box>
          </Stack>
        </TabPanel>
      </Tabs>
    </Sheet>
  )
}
