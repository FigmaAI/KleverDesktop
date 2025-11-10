import Box from '@mui/joy/Box'
import Button from '@mui/joy/Button'
import Card from '@mui/joy/Card'
import CardContent from '@mui/joy/CardContent'
import Typography from '@mui/joy/Typography'
import Stack from '@mui/joy/Stack'

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
