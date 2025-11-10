import React, { useState, useEffect } from 'react';
import { CssVarsProvider, extendTheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Stepper from '@mui/joy/Stepper';
import Step from '@mui/joy/Step';
import StepIndicator from '@mui/joy/StepIndicator';
import Container from '@mui/joy/Container';

// Import step components
import SetupWizard from './steps/SetupWizard';
import ProjectList from './project/ProjectList';
import SettingsPanel from './settings/SettingsPanel';

// Custom theme configuration (similar to klever-v3)
const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
      },
    },
  },
  fontFamily: {
    display: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
});

type AppView = 'setup' | 'projects' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('setup');
  const [setupComplete, setSetupComplete] = useState(false);

  // Check if setup is already complete on mount
  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    // Check if config exists and is valid
    try {
      const result = await window.electronAPI.configLoad();
      if (result.success) {
        // Additional validation could be done here
        const pythonCheck = await window.electronAPI.checkPython();
        if (pythonCheck.success && pythonCheck.isValid) {
          setSetupComplete(true);
          setCurrentView('projects');
        }
      }
    } catch (error) {
      console.error('Setup check failed:', error);
    }
  };

  const handleSetupComplete = () => {
    setSetupComplete(true);
    setCurrentView('projects');
  };

  return (
    <CssVarsProvider theme={theme} defaultMode="light">
      <CssBaseline />
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.body',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography level="h3" component="h1">
            Klever Desktop
          </Typography>

          {setupComplete && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography
                level="body-sm"
                sx={{
                  cursor: 'pointer',
                  color: currentView === 'projects' ? 'primary.500' : 'text.secondary',
                  fontWeight: currentView === 'projects' ? 'bold' : 'normal',
                  '&:hover': { color: 'primary.600' },
                }}
                onClick={() => setCurrentView('projects')}
              >
                Projects
              </Typography>
              <Typography
                level="body-sm"
                sx={{
                  cursor: 'pointer',
                  color: currentView === 'settings' ? 'primary.500' : 'text.secondary',
                  fontWeight: currentView === 'settings' ? 'bold' : 'normal',
                  '&:hover': { color: 'primary.600' },
                }}
                onClick={() => setCurrentView('settings')}
              >
                Settings
              </Typography>
            </Box>
          )}
        </Box>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {currentView === 'setup' && (
            <SetupWizard onComplete={handleSetupComplete} />
          )}
          {currentView === 'projects' && <ProjectList />}
          {currentView === 'settings' && <SettingsPanel />}
        </Box>
      </Box>
    </CssVarsProvider>
  );
}

export default App;
