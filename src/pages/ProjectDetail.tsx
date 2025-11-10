import { useParams } from 'react-router-dom'
import Box from '@mui/joy/Box'
import Card from '@mui/joy/Card'
import CardContent from '@mui/joy/CardContent'
import Typography from '@mui/joy/Typography'

export function ProjectDetail() {
  const { id } = useParams()

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      <Typography level="h2" fontWeight="bold" sx={{ mb: 4 }}>
        Project Detail #{id}
      </Typography>

      <Card>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 1 }}>
            Project Configuration
          </Typography>
          <Typography level="body-sm" textColor="text.secondary">
            View and manage project settings
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography level="body-sm" textColor="text.secondary">
              Coming soon...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
