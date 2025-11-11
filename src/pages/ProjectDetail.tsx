import { useParams } from 'react-router-dom'
import { Box, Sheet, Typography } from '@mui/joy'

export function ProjectDetail() {
  const { id } = useParams()

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.body' }}>
      <Box sx={{ p: 4, flex: 1 }}>
        <Typography level="h2" fontWeight="bold" sx={{ mb: 3 }}>
          Project Detail #{id}
        </Typography>

        <Sheet
          variant="outlined"
          sx={{
            p: 3,
            borderRadius: 'md',
            bgcolor: 'background.surface',
          }}
        >
          <Typography level="title-lg" sx={{ mb: 1 }}>
            Project Configuration
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
            View and manage project settings
          </Typography>
          <Typography level="body-sm" textColor="text.secondary">
            Coming soon...
          </Typography>
        </Sheet>
      </Box>
    </Box>
  )
}
