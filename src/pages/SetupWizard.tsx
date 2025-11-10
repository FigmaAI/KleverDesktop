import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Box from '@mui/joy/Box'
import Button from '@mui/joy/Button'
import Card from '@mui/joy/Card'
import CardContent from '@mui/joy/CardContent'
import LinearProgress from '@mui/joy/LinearProgress'
import Typography from '@mui/joy/Typography'
import Sheet from '@mui/joy/Sheet'
import Stack from '@mui/joy/Stack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'

const steps = [
  { label: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Verify configuration' },
]

// Custom Stepper Component using Joy UI
function Stepper({ steps, currentStep }: { steps: typeof steps; currentStep: number }) {
  return (
    <Stack direction="row" spacing={2} sx={{ width: '100%', alignItems: 'center' }}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep

        return (
          <Stack key={index} direction="row" spacing={2} sx={{ flex: 1, alignItems: 'center' }}>
            <Stack spacing={0.5} sx={{ flex: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 2,
                  borderColor: isCompleted || isCurrent ? 'primary.500' : 'neutral.300',
                  bgcolor: isCompleted ? 'primary.500' : 'background.surface',
                  color: isCompleted ? 'white' : isCurrent ? 'primary.500' : 'neutral.500',
                  fontWeight: 'bold',
                  transition: 'all 0.3s ease',
                  ...(isCurrent && {
                    boxShadow: 'md',
                    transform: 'scale(1.1)',
                  }),
                }}
              >
                {isCompleted ? <CheckCircleIcon /> : index + 1}
              </Box>
              <Typography level="body-sm" fontWeight="md" textAlign="center">
                {step.label}
              </Typography>
              <Typography level="body-xs" textColor="text.secondary" textAlign="center">
                {step.description}
              </Typography>
            </Stack>

            {index < steps.length - 1 && (
              <Box
                sx={{
                  height: 2,
                  flex: 0.3,
                  bgcolor: 'neutral.200',
                  position: 'relative',
                  borderRadius: 'sm',
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                    width: isCompleted ? '100%' : '0%',
                    bgcolor: 'primary.500',
                    transition: 'width 0.5s ease',
                  }}
                />
              </Box>
            )}
          </Stack>
        )
      })}
    </Stack>
  )
}

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  const progress = (currentStep / (steps.length - 1)) * 100

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
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        p: 2,
        background: 'linear-gradient(135deg, #e3f2fd 0%, #ffffff 50%, #f3e5f5 100%)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: 900, zIndex: 10 }}
      >
        <Card sx={{ boxShadow: 'xl' }}>
          <CardContent sx={{ gap: 3 }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Typography level="h2" textAlign="center" fontWeight="bold" sx={{ mb: 1 }}>
                Welcome to Klever Desktop
              </Typography>
              <Typography level="body-md" textAlign="center" textColor="text.secondary">
                Let's set up your environment for AI-powered UI automation
              </Typography>
            </motion.div>

            {/* Progress Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Stack spacing={1}>
                <LinearProgress
                  determinate
                  value={progress}
                  sx={{ height: 8, borderRadius: 'sm' }}
                />
                <Stack direction="row" justifyContent="space-between">
                  <Typography level="body-sm" textColor="text.secondary">
                    Step {currentStep + 1} of {steps.length}
                  </Typography>
                  <Typography level="body-sm" textColor="text.secondary">
                    {Math.round(progress)}% Complete
                  </Typography>
                </Stack>
              </Stack>
            </motion.div>

            {/* Custom Stepper */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Stepper steps={steps} currentStep={currentStep} />
            </motion.div>

            {/* Step Content with animations */}
            <Box sx={{ minHeight: 320 }}>
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
                        We're checking if all required tools are installed and configured correctly.
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
