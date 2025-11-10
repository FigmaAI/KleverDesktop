import React, { useState, useEffect } from 'react';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import LinearProgress from '@mui/joy/LinearProgress';
import List from '@mui/joy/List';
import ListItem from '@mui/joy/ListItem';
import ListItemDecorator from '@mui/joy/ListItemDecorator';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CircularProgress from '@mui/joy/CircularProgress';

interface PlatformCheckProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface CheckStatus {
  python: 'pending' | 'checking' | 'success' | 'error';
  packages: 'pending' | 'checking' | 'success' | 'error';
  adb: 'pending' | 'checking' | 'success' | 'error';
  playwright: 'pending' | 'checking' | 'success' | 'error';
}

function PlatformCheck({ onComplete, onSkip }: PlatformCheckProps) {
  const [status, setStatus] = useState<CheckStatus>({
    python: 'pending',
    packages: 'pending',
    adb: 'pending',
    playwright: 'pending',
  });
  const [pythonVersion, setPythonVersion] = useState('');
  const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    // Check Python
    setStatus((prev) => ({ ...prev, python: 'checking' }));
    try {
      const result = await window.electronAPI.checkPython();
      if (result.success && result.isValid) {
        setPythonVersion(result.version || '');
        setStatus((prev) => ({ ...prev, python: 'success' }));
      } else {
        setStatus((prev) => ({ ...prev, python: 'error' }));
        setErrorMessages((prev) => ({ ...prev, python: result.error || 'Python 3.11+ not found' }));
      }
    } catch (error) {
      setStatus((prev) => ({ ...prev, python: 'error' }));
      setErrorMessages((prev) => ({ ...prev, python: String(error) }));
    }

    // Check Packages
    setStatus((prev) => ({ ...prev, packages: 'checking' }));
    try {
      const result = await window.electronAPI.checkPackages();
      setStatus((prev) => ({ ...prev, packages: result.success ? 'success' : 'error' }));
      if (!result.success) {
        setErrorMessages((prev) => ({ ...prev, packages: 'Some packages are missing' }));
      }
    } catch (error) {
      setStatus((prev) => ({ ...prev, packages: 'error' }));
      setErrorMessages((prev) => ({ ...prev, packages: String(error) }));
    }

    // Check ADB
    setStatus((prev) => ({ ...prev, adb: 'checking' }));
    try {
      const result = await window.electronAPI.checkAdb();
      setStatus((prev) => ({ ...prev, adb: result.success ? 'success' : 'error' }));
      if (!result.success) {
        setErrorMessages((prev) => ({ ...prev, adb: 'ADB not found or no devices connected' }));
      }
    } catch (error) {
      setStatus((prev) => ({ ...prev, adb: 'error' }));
      setErrorMessages((prev) => ({ ...prev, adb: String(error) }));
    }

    // Check Playwright
    setStatus((prev) => ({ ...prev, playwright: 'checking' }));
    try {
      const result = await window.electronAPI.checkPlaywright();
      setStatus((prev) => ({ ...prev, playwright: result.success ? 'success' : 'error' }));
      if (!result.success) {
        setErrorMessages((prev) => ({ ...prev, playwright: 'Playwright not installed' }));
      }
    } catch (error) {
      setStatus((prev) => ({ ...prev, playwright: 'error' }));
      setErrorMessages((prev) => ({ ...prev, playwright: String(error) }));
    }
  };

  const allSuccess = Object.values(status).every((s) => s === 'success');
  const someSuccess = Object.values(status).some((s) => s === 'success');

  const getIcon = (state: string) => {
    if (state === 'checking') return <CircularProgress size="sm" />;
    if (state === 'success') return <CheckCircleIcon color="success" />;
    if (state === 'error') return <ErrorIcon color="error" />;
    return null;
  };

  return (
    <Box>
      <Typography level="h4" sx={{ mb: 2 }}>
        Platform & Runtime Tools Check
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3 }}>
        We're checking if all required tools are installed and configured correctly.
      </Typography>

      <List sx={{ mb: 3 }}>
        <ListItem>
          <ListItemDecorator>{getIcon(status.python)}</ListItemDecorator>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-md">Python 3.11+</Typography>
            {pythonVersion && (
              <Typography level="body-xs" color="neutral">
                Version: {pythonVersion}
              </Typography>
            )}
            {status.python === 'error' && (
              <Typography level="body-xs" color="danger">
                {errorMessages.python}
              </Typography>
            )}
          </Box>
        </ListItem>

        <ListItem>
          <ListItemDecorator>{getIcon(status.packages)}</ListItemDecorator>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-md">Python Packages</Typography>
            {status.packages === 'error' && (
              <Typography level="body-xs" color="danger">
                {errorMessages.packages}
              </Typography>
            )}
          </Box>
          {status.packages === 'error' && (
            <Button size="sm" variant="soft" onClick={() => window.electronAPI.installPackages()}>
              Install
            </Button>
          )}
        </ListItem>

        <ListItem>
          <ListItemDecorator>{getIcon(status.adb)}</ListItemDecorator>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-md">ADB (Android Debug Bridge)</Typography>
            {status.adb === 'error' && (
              <Typography level="body-xs" color="danger">
                {errorMessages.adb}
              </Typography>
            )}
          </Box>
        </ListItem>

        <ListItem>
          <ListItemDecorator>{getIcon(status.playwright)}</ListItemDecorator>
          <Box sx={{ flex: 1 }}>
            <Typography level="body-md">Playwright (Web Automation)</Typography>
            {status.playwright === 'error' && (
              <Typography level="body-xs" color="danger">
                {errorMessages.playwright}
              </Typography>
            )}
          </Box>
        </ListItem>
      </List>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          fullWidth
          variant="solid"
          color="primary"
          disabled={!allSuccess && !someSuccess}
          onClick={onComplete}
        >
          {allSuccess ? 'Continue' : someSuccess ? 'Continue Anyway' : 'Waiting...'}
        </Button>
        <Button fullWidth variant="outlined" color="neutral" onClick={onSkip}>
          Skip for Now
        </Button>
      </Box>
    </Box>
  );
}

export default PlatformCheck;
