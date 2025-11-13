import { useState } from 'react'
import { Box, Button, Sheet, Typography, Stack, Modal, ModalDialog, ModalClose, Divider, Alert } from '@mui/joy'
import { Warning as WarningIcon, Error as ErrorIcon } from '@mui/icons-material'

export function Settings() {
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleResetConfig = async () => {
    setIsResetting(true)
    setErrorMessage(null)
    
    try {
      console.log('[Settings] Calling configReset...')
      const result = await window.electronAPI.configReset()
      console.log('[Settings] configReset result:', result)
      
      if (result.success) {
        console.log('[Settings] Configuration reset successful, redirecting to setup...')
        // Reload the page to trigger App.tsx to redirect to setup wizard
        window.location.href = '/setup'
      } else {
        const errorMsg = result.error || 'Unknown error occurred'
        console.error('[Settings] Failed to reset configuration:', errorMsg)
        setErrorMessage(`Failed to reset configuration: ${errorMsg}`)
        setIsResetting(false)
      }
    } catch (error) {
      console.error('[Settings] Error resetting configuration:', error)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred'
      setErrorMessage(`An error occurred while resetting configuration: ${errorMsg}`)
      setIsResetting(false)
    }
  }

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

          <Divider sx={{ my: 2 }} />

          {/* Reset Configuration Section */}
          <Sheet
            variant="outlined"
            sx={{
              p: 3,
              borderRadius: 'md',
              bgcolor: 'background.surface',
              borderColor: 'danger.outlinedBorder',
            }}
          >
            <Typography level="title-lg" sx={{ mb: 1 }} textColor="danger.plainColor">
              Danger Zone
            </Typography>
            <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
              Reset all settings and return to setup wizard
            </Typography>
            <Button
              color="danger"
              variant="outlined"
              startDecorator={<WarningIcon />}
              onClick={() => setResetDialogOpen(true)}
            >
              Reset Configuration
            </Button>
          </Sheet>
        </Stack>
      </Box>

      {/* Reset Confirmation Dialog */}
      <Modal open={resetDialogOpen} onClose={() => !isResetting && setResetDialogOpen(false)}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 500 }}>
          {!isResetting && <ModalClose />}
          <Typography level="h4" startDecorator={<WarningIcon color="warning" />}>
            Reset Configuration?
          </Typography>
          <Divider />
          
          {errorMessage && (
            <Alert 
              color="danger" 
              variant="soft" 
              startDecorator={<ErrorIcon />}
              sx={{ mt: 2 }}
            >
              <Box>
                <Typography level="title-sm" fontWeight="bold">Error</Typography>
                <Typography level="body-sm">{errorMessage}</Typography>
              </Box>
            </Alert>
          )}
          
          <Typography level="body-md" sx={{ mt: errorMessage ? 2 : 1 }}>
            This will delete all your settings including:
          </Typography>
          <Box component="ul" sx={{ pl: 3, mt: 1 }}>
            <Typography component="li" level="body-sm">AI model configuration</Typography>
            <Typography component="li" level="body-sm">API keys and endpoints</Typography>
            <Typography component="li" level="body-sm">All other preferences</Typography>
          </Box>
          <Typography level="body-md" sx={{ mt: 2, fontWeight: 'bold' }}>
            You will be redirected to the setup wizard to reconfigure everything.
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
            <Button 
              variant="plain" 
              color="neutral" 
              onClick={() => {
                setResetDialogOpen(false)
                setErrorMessage(null)
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              loading={isResetting}
              onClick={handleResetConfig}
              disabled={isResetting}
            >
              Yes, Reset Configuration
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  )
}
