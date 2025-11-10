import { Link } from 'react-router-dom'
import Box from '@mui/joy/Box'
import Button from '@mui/joy/Button'
import Card from '@mui/joy/Card'
import CardContent from '@mui/joy/CardContent'
import Typography from '@mui/joy/Typography'
import Stack from '@mui/joy/Stack'
import AddIcon from '@mui/icons-material/Add'

export function ProjectList() {
  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4, px: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography level="h2" fontWeight="bold">
            Projects
          </Typography>
          <Typography level="body-md" textColor="text.secondary">
            Manage your automation projects
          </Typography>
        </Box>
        <Button startDecorator={<AddIcon />}>
          New Project
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 1 }}>
            No projects yet
          </Typography>
          <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 2 }}>
            Create your first project to get started with UI automation
          </Typography>
          <Button
            variant="outlined"
            startDecorator={<AddIcon />}
            fullWidth
          >
            Create Project
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}
