import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  Button,
  Typography,
  Sheet,
  Stack,
  Stepper,
  Step,
  StepIndicator,
  stepClasses,
  stepIndicatorClasses,
} from '@mui/joy'
import { CheckCircle as CheckCircleIcon, CircleOutlined as CircleOutlinedIcon } from '@mui/icons-material'

const steps = [
  { label: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Verify configuration' },
]

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      navigate('/projects')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.body',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 4, flex: 1 }}>
          {/* Header Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Box sx={{ mb: 2 }}>
              <Typography level="h2" fontWeight="bold" sx={{ mb: 0.5 }}>
                Welcome to Klever Desktop
              </Typography>
              <Typography level="body-md" textColor="text.secondary">
                Let&apos;s set up your environment for AI-powered UI automation
              </Typography>
            </Box>
          </motion.div>

          {/* Stepper and Content Layout */}
          <Box sx={{ display: 'flex', gap: 4, flex: 1 }}>
            {/* Vertical Stepper on the left */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              style={{ minWidth: 240 }}
            >
              <Stepper
                orientation="vertical"
                sx={(theme) => ({
                  '--Stepper-verticalGap': '2rem',
                  '--StepIndicator-size': '2.5rem',
                  '--Step-gap': '1rem',
                  '--Step-connectorInset': '0.5rem',
                  '--Step-connectorRadius': '1rem',
                  '--Step-connectorThickness': '4px',
                  [`& .${stepClasses.completed}`]: {
                    '&::after': { bgcolor: 'primary.solidBg' },
                  },
                  [`& .${stepClasses.active}`]: {
                    [`& .${stepIndicatorClasses.root}`]: {
                      border: '4px solid',
                      borderColor: theme.vars.palette.primary[500],
                      boxShadow: `0 0 0 1px ${theme.vars.palette.primary[200]}`,
                    },
                  },
                  [`& .${stepClasses.disabled} *`]: {
                    color: 'neutral.softDisabledColor',
                  },
                })}
              >
                {steps.map((step, index) => {
                  const isCompleted = index < currentStep
                  const isActive = index === currentStep

                  return (
                    <Step
                      key={index}
                      completed={isCompleted}
                      active={isActive}
                      disabled={index > currentStep}
                      indicator={
                        <StepIndicator
                          variant={isCompleted ? 'solid' : isActive ? 'solid' : 'outlined'}
                          color={isCompleted ? 'primary' : isActive ? 'primary' : 'neutral'}
                        >
                          {isCompleted ? <CheckCircleIcon /> : index + 1}
                        </StepIndicator>
                      }
                    >
                      <Box>
                        <Typography level="body-sm" fontWeight="md">
                          {step.label}
                        </Typography>
                        <Typography level="body-xs" textColor="text.secondary">
                          {step.description}
                        </Typography>
                      </Box>
                    </Step>
                  )
                })}
              </Stepper>
            </motion.div>

            {/* Step Content on the right */}
            <Box sx={{ flex: 1 }}>
              <AnimatePresence mode="wait">
                {currentStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Sheet
                      variant="outlined"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        bgcolor: 'background.surface',
                      }}
                    >
                      <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
                        Platform & Runtime Tools Check
                      </Typography>
                      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                        We&apos;re checking if all required tools are installed and configured correctly.
                      </Typography>

                      <Stack spacing={1.5}>
                        {[
                          { label: 'Python 3.11+', completed: true },
                          { label: 'Python Packages', completed: false },
                          { label: 'ADB (Android Debug Bridge)', completed: false },
                          { label: 'Playwright (Web Automation)', completed: false },
                        ].map((tool, idx) => (
                          <motion.div
                            key={tool.label}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 * (idx + 1) }}
                          >
                            <Sheet
                              variant="soft"
                              color={tool.completed ? 'success' : 'neutral'}
                              sx={{
                                p: 2,
                                borderRadius: 'sm',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                              }}
                            >
                              {tool.completed ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <CircleOutlinedIcon sx={{ color: 'neutral.400' }} />
                              )}
                              <Typography
                                level="body-sm"
                                fontWeight={tool.completed ? 'md' : 'normal'}
                                textColor={tool.completed ? 'text.primary' : 'text.secondary'}
                              >
                                {tool.label}
                              </Typography>
                            </Sheet>
                          </motion.div>
                        ))}
                      </Stack>
                    </Sheet>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Sheet
                      variant="outlined"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        bgcolor: 'background.surface',
                      }}
                    >
                      <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
                        Model Configuration
                      </Typography>
                      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                        Choose how you want to run AI models: locally with Ollama or via API
                      </Typography>

                      <Stack direction="row" spacing={2}>
                        <motion.div
                          style={{ flex: 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 3,
                              borderRadius: 'md',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              bgcolor: 'background.surface',
                              '&:hover': {
                                borderColor: 'primary.outlinedBorder',
                                bgcolor: 'background.level1',
                              },
                            }}
                          >
                            <Typography level="title-md" fontWeight="bold" sx={{ mb: 1 }}>
                              Local (Ollama)
                            </Typography>
                            <Typography level="body-sm" textColor="text.secondary">
                              Run models locally with Ollama. Requires installation.
                            </Typography>
                          </Sheet>
                        </motion.div>

                        <motion.div
                          style={{ flex: 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 3,
                              borderRadius: 'md',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              bgcolor: 'background.surface',
                              '&:hover': {
                                borderColor: 'primary.outlinedBorder',
                                bgcolor: 'background.level1',
                              },
                            }}
                          >
                            <Typography level="title-md" fontWeight="bold" sx={{ mb: 1 }}>
                              API
                            </Typography>
                            <Typography level="body-sm" textColor="text.secondary">
                              Use cloud APIs. Requires API key configuration.
                            </Typography>
                          </Sheet>
                        </motion.div>
                      </Stack>
                    </Sheet>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Sheet
                      variant="outlined"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        bgcolor: 'background.surface',
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}
                      >
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            bgcolor: 'success.solidBg',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 40, color: 'success.solidColor' }} />
                        </Box>
                      </motion.div>

                      <Typography level="h4" fontWeight="bold" textAlign="center" sx={{ mb: 1 }}>
                        Setup Complete!
                      </Typography>
                      <Typography level="body-sm" textAlign="center" textColor="text.secondary">
                        Your environment is ready. You can now create projects and start exploring AI-powered UI automation.
                      </Typography>
                    </Sheet>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>
          </Box>

          {/* Navigation Buttons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ pt: 2 }}>
              <Button
                variant="outlined"
                color="neutral"
                onClick={handleBack}
                disabled={currentStep === 0}
                sx={{ minWidth: 100 }}
              >
                Back
              </Button>
              <Button
                variant="solid"
                color="primary"
                onClick={handleNext}
                sx={{ minWidth: 100 }}
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </Stack>
          </motion.div>
        </Box>
      </motion.div>
    </Box>
  )
}
