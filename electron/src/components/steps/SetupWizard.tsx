import React, { useState } from 'react';
import Box from '@mui/joy/Box';
import Container from '@mui/joy/Container';
import Stepper from '@mui/joy/Stepper';
import Step from '@mui/joy/Step';
import StepIndicator from '@mui/joy/StepIndicator';
import Typography from '@mui/joy/Typography';
import Button from '@mui/joy/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import PlatformCheck from './PlatformCheck';
import ModelCheck from './ModelCheck';
import FinalCheck from './FinalCheck';

interface SetupWizardProps {
  onComplete: () => void;
}

function SetupWizard({ onComplete }: SetupWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [platformCheckComplete, setPlatformCheckComplete] = useState(false);
  const [modelCheckComplete, setModelCheckComplete] = useState(false);

  const steps = [
    { label: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
    { label: 'Model Setup', description: 'Configure Ollama or API' },
    { label: 'Final Check', description: 'Verify configuration' },
  ];

  const handleNext = () => {
    if (activeStep < steps.length - 1) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handlePlatformComplete = () => {
    setPlatformCheckComplete(true);
    handleNext();
  };

  const handleModelComplete = () => {
    setModelCheckComplete(true);
    handleNext();
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography level="h2" sx={{ mb: 1 }}>
          Welcome to Klever Desktop
        </Typography>
        <Typography level="body-md" color="neutral">
          Let's set up your environment for AI-powered UI automation
        </Typography>
      </Box>

      {/* Stepper */}
      <Stepper sx={{ mb: 4 }}>
        {steps.map((step, index) => (
          <Step
            key={step.label}
            indicator={
              <StepIndicator
                variant={activeStep === index ? 'solid' : 'soft'}
                color={activeStep > index ? 'success' : 'primary'}
              >
                {activeStep > index ? <CheckCircleIcon /> : index + 1}
              </StepIndicator>
            }
          >
            <Box>
              <Typography level="title-sm">{step.label}</Typography>
              <Typography level="body-xs">{step.description}</Typography>
            </Box>
          </Step>
        ))}
      </Stepper>

      {/* Step Content */}
      <Box sx={{ minHeight: 400 }}>
        {activeStep === 0 && (
          <PlatformCheck
            onComplete={handlePlatformComplete}
            onSkip={handleNext}
          />
        )}
        {activeStep === 1 && (
          <ModelCheck
            onComplete={handleModelComplete}
            onBack={handleBack}
          />
        )}
        {activeStep === 2 && (
          <FinalCheck
            onComplete={onComplete}
            onBack={handleBack}
          />
        )}
      </Box>

      {/* Navigation Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        <Button
          variant="outlined"
          color="neutral"
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          Back
        </Button>

        <Typography level="body-sm" color="neutral">
          Step {activeStep + 1} of {steps.length}
        </Typography>
      </Box>
    </Container>
  );
}

export default SetupWizard;
