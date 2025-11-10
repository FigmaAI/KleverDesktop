import { Box, Button, Sheet, Typography, Stack } from '@mui/joy'
import { Add as AddIcon } from '@mui/icons-material'

export function ProjectList() {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography level="h2" fontWeight="bold">
              Projects
            </Typography>
            <Typography level="body-md" textColor="text.secondary">
              Manage your automation projects
            </Typography>
          </Box>
          <Button startDecorator={<AddIcon />} color="primary">
            New Project
          </Button>
        </Stack>

        <Sheet
          variant="outlined"
          sx={{
            p: 4,
            borderRadius: 'md',
            bgcolor: 'background.surface',
            textAlign: 'center',
          }}
        >
          <Typography level="title-lg" sx={{ mb: 1 }}>
            No projects yet
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
            Create your first project to get started with UI automation
          </Typography>
          <Button
            variant="solid"
            color="primary"
            startDecorator={<AddIcon />}
            sx={{ minWidth: 200 }}
          >
            Create Project
          </Button>
        </Sheet>
      </Box>
    </Box>
  )
}
