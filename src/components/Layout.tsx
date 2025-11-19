import { useEffect, useState, useRef } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Box, Sheet, Typography, Button, Stack } from '@mui/joy'
import { SettingsOutlined, FolderOutlined } from '@mui/icons-material'
import logo from '../assets/logo.png'
import { TerminalButton } from '@/components/UniversalTerminal'
import { useTerminal } from '@/hooks/useTerminal'

export function Layout() {
  const location = useLocation()
  const { processes } = useTerminal()
  const [animateTerminalButton, setAnimateTerminalButton] = useState(false)
  const prevRunningCountRef = useRef(0)

  // Track running processes count
  const runningCount = processes.filter((p) => p.status === 'running').length

  // Animate terminal button when a new task starts running
  useEffect(() => {
    // Only animate when runningCount increases (new task started)
    if (runningCount > prevRunningCountRef.current && runningCount > 0) {
      // Use setTimeout to defer state update and avoid cascading renders
      const timer = setTimeout(() => {
        setAnimateTerminalButton(true)
        setTimeout(() => {
          setAnimateTerminalButton(false)
        }, 3000) // Animate for 3 seconds
      }, 0)

      prevRunningCountRef.current = runningCount
      return () => clearTimeout(timer)
    } else {
      prevRunningCountRef.current = runningCount
    }
  }, [runningCount])

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
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            component="img"
            src={logo}
            alt="Self Explorer Logo"
            sx={{
              height: 40,
              width: 40,
            }}
          />
          <Typography
            level="h3"
            fontWeight="bold"
            sx={{
              display: { xs: 'none', sm: 'block' },
            }}
          >
            Self Explorer
          </Typography>
        </Stack>

        <Box component="nav" sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
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

          {/* Terminal Button */}
          <TerminalButton animateAttention={animateTerminalButton} />
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
