import Box from '@mui/joy/Box'
import { Button, Card, CardContent, Typography, Stack } from '@mui/joy'


export function Settings() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" fontWeight="bold">
          Settings
        </Typography>
        <Typography level="body-md" textColor="text.secondary">
          Configure your application preferences
        </Typography>
      </Box>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 1 }}>
              Model Configuration
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              Manage AI model settings
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Coming soon...
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 1 }}>
              Platform Tools
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              ADB and Playwright configuration
            </Typography>
            <Typography level="body-sm" textColor="text.secondary">
              Coming soon...
            </Typography>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button>Save Settings</Button>
        </Box>
      </Stack>
    </Box>
  )
}
