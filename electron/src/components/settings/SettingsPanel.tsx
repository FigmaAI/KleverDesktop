import React from 'react';
import Box from '@mui/joy/Box';
import Container from '@mui/joy/Container';
import Typography from '@mui/joy/Typography';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';
import FormControl from '@mui/joy/FormControl';
import FormLabel from '@mui/joy/FormLabel';
import Input from '@mui/joy/Input';
import Button from '@mui/joy/Button';

function SettingsPanel() {
  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography level="h2" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Model Configuration
          </Typography>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Model Type</FormLabel>
            <Input value="Ollama (Local)" disabled />
          </FormControl>

          <FormControl sx={{ mb: 2 }}>
            <FormLabel>Model Name</FormLabel>
            <Input value="qwen3-vl:4b" />
          </FormControl>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Platform Tools
          </Typography>

          <Typography level="body-sm" color="neutral">
            ADB and Playwright configuration coming soon...
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="solid">Save Settings</Button>
      </Box>
    </Container>
  );
}

export default SettingsPanel;
