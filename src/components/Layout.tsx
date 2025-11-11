import { Outlet, Link, useLocation } from 'react-router-dom'
import { Box, Sheet, Typography, Button } from '@mui/joy'
import { SettingsOutlined, FolderOutlined } from '@mui/icons-material'

export function Layout() {
  const location = useLocation()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
      }}
    >
      {/* Header */}
      <Sheet
        component="header"
        variant="outlined"
        sx={{
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          display: 'flex',
          alignItems: 'center',
          height: 64,
          px: 3,
        }}
      >
        <Typography level="h3" fontWeight="bold">
          Klever Desktop
        </Typography>

        <Box component="nav" sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <Button
            component={Link}
            to="/projects"
            variant={location.pathname.startsWith('/projects') ? 'solid' : 'plain'}
            size="sm"
            startDecorator={<FolderOutlined fontSize="small" />}
          >
            Projects
          </Button>
          <Button
            component={Link}
            to="/settings"
            variant={location.pathname === '/settings' ? 'solid' : 'plain'}
            size="sm"
            startDecorator={<SettingsOutlined fontSize="small" />}
          >
            Settings
          </Button>
        </Box>
      </Sheet>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'auto',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
