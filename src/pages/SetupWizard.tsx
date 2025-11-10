import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme, PaletteRange } from '@mui/joy/styles'
import {
  Box,
  Button,
  Card,
  CardContent,
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
  const theme = useTheme()
  const [currentStep, setCurrentStep] = useState(0)

  // Color inversion gradient effect
  const color = 'primary'
  const shade = (x: keyof PaletteRange): string => theme.vars.palette[color][x]
  const color1 = shade(800)
  const color2 = shade(600)
  const color3 = shade(900)
  const gradient1 = `${color1}, ${color2} 65%`
  const gradient2 = `${color1} 65%, ${color3}`

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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sheet
                variant="solid"
                color="primary"
                invertedColors
                sx={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  p: 4,
                  borderRadius: 'md',
                  overflow: 'hidden',
                  bgcolor: shade(800),
                  '&::after': {
                    content: '""',
                    display: 'block',
                    width: '20rem',
                    height: '40rem',
                    background: `linear-gradient(to top, ${gradient1}, ${gradient2})`,
                    position: 'absolute',
                    transform: 'rotate(-45deg)',
                    top: '-70%',
                    right: '-15%',
                  },
                }}
              >
                <Typography level="h2" fontWeight="bold" sx={{ mb: 1, position: 'relative', zIndex: 1, color: shade(50) }}>
                  Welcome to Klever Desktop
                </Typography>
                <Typography level="body-md" sx={{ position: 'relative', zIndex: 1, color: shade(200) }}>
                  Let&apos;s set up your environment for AI-powered UI automation
                </Typography>
              </Sheet>
            </motion.div>

            {/* Stepper and Content Layout */}
            <Box sx={{ display: 'flex', gap: 3, minHeight: 400 }}>
              {/* Vertical Stepper on the left */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                style={{ minWidth: 200 }}
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
                      '&::after': { bgcolor: 'success.solidBg' },
                    },
                    [`& .${stepClasses.active}`]: {
                      [`& .${stepIndicatorClasses.root}`]: {
                        border: '4px solid',
                        borderColor: '#fff',
                        boxShadow: `0 0 0 1px ${theme.vars.palette.primary[500]}`,
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
                            color={isCompleted ? 'success' : isActive ? 'primary' : 'neutral'}
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
              <Box sx={{ flex: 1, minHeight: 320 }}>
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
                      variant="soft"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
                      }}
                    >
                      <Typography level="h4" fontWeight="bold" sx={{ mb: 1 }}>
                        Platform & Runtime Tools Check
                      </Typography>
                      <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>
                        We&apos;re checking if all required tools are installed and configured correctly.
                      </Typography>

                      <Stack spacing={1.5}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 'sm',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              bgcolor: 'background.surface',
                            }}
                          >
                            <CheckCircleIcon sx={{ color: 'success.500' }} />
                            <Typography level="body-sm" fontWeight="md">
                              Python 3.11+
                            </Typography>
                          </Sheet>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 'sm',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              bgcolor: 'background.surface',
                            }}
                          >
                            <CircleOutlinedIcon sx={{ color: 'neutral.400' }} />
                            <Typography level="body-sm" textColor="text.secondary">
                              Python Packages
                            </Typography>
                          </Sheet>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 'sm',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              bgcolor: 'background.surface',
                            }}
                          >
                            <CircleOutlinedIcon sx={{ color: 'neutral.400' }} />
                            <Typography level="body-sm" textColor="text.secondary">
                              ADB (Android Debug Bridge)
                            </Typography>
                          </Sheet>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Sheet
                            variant="outlined"
                            sx={{
                              p: 2,
                              borderRadius: 'sm',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              bgcolor: 'background.surface',
                            }}
                          >
                            <CircleOutlinedIcon sx={{ color: 'neutral.400' }} />
                            <Typography level="body-sm" textColor="text.secondary">
                              Playwright (Web Automation)
                            </Typography>
                          </Sheet>
                        </motion.div>
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
                      variant="soft"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
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
                                borderColor: 'primary.500',
                                boxShadow: 'sm',
                              },
                            }}
                          >
                            <Typography level="title-md" fontWeight="bold" sx={{ mb: 1 }}>
                              Local (Ollama)
                            </Typography>
                            <Typography level="body-xs" textColor="text.secondary">
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
                                borderColor: 'primary.500',
                                boxShadow: 'sm',
                              },
                            }}
                          >
                            <Typography level="title-md" fontWeight="bold" sx={{ mb: 1 }}>
                              API
                            </Typography>
                            <Typography level="body-xs" textColor="text.secondary">
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
                      variant="soft"
                      sx={{
                        p: 3,
                        borderRadius: 'md',
                        background: 'linear-gradient(135deg, rgba(76, 175, 80, 0.1) 0%, rgba(129, 199, 132, 0.1) 100%)',
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}
                      >
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            bgcolor: 'success.500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 40, color: 'white' }} />
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
              <Stack direction="row" justifyContent="space-between" sx={{ pt: 2 }}>
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
                  onClick={handleNext}
                  sx={{ minWidth: 100 }}
                >
                  {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                </Button>
              </Stack>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </Box>
  )
}
