import { Box, Button, Sheet, Typography, Stack } from '@mui/joy'

export function Settings() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Box sx={{ mb: 3 }}>
          <Typography level="h2" fontWeight="bold">
            Settings
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Configure your application preferences
          </Typography>
        </Box>

        <Stack spacing={3}>
          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 'md',
              bgcolor: 'background.surface',
            }}
          >
            <Typography level="title-lg" sx={{ mb: 1 }}>
              Model Configuration
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              Manage AI model settings
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Coming soon...
            </Typography>
          </Sheet>

          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 'md',
              bgcolor: 'background.surface',
            }}
          >
            <Typography level="title-lg" sx={{ mb: 1 }}>
              Platform Tools
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              ADB and Playwright configuration
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Coming soon...
            </Typography>
          </Sheet>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button color="primary">Save Settings</Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}
