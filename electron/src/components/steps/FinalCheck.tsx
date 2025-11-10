import React from 'react';
import Box from '@mui/joy/Box';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import Card from '@mui/joy/Card';
import CardContent from '@mui/joy/CardContent';

interface FinalCheckProps {
  onComplete: () => void;
  onBack: () => void;
}

function FinalCheck({ onComplete, onBack }: FinalCheckProps) {
  return (
    <Box>
      <Typography level="h4" sx={{ mb: 2 }}>
        Setup Complete!
      </Typography>
      <Typography level="body-sm" sx={{ mb: 3 }}>
        Your environment is ready. You can now create projects and start exploring.
      </Typography>

      <Card variant="soft" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="title-md" sx={{ mb: 1 }}>
            Configuration Summary
          </Typography>
          <Typography level="body-sm">
            • Python: Ready<br />
            • Model: Ollama (Local)<br />
            • Platform Tools: ADB, Playwright
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button fullWidth variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button fullWidth variant="solid" onClick={onComplete}>
          Start Using Klever Desktop
        </Button>
      </Box>
    </Box>
  );
}

export default FinalCheck;
