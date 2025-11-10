import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Stepper } from '@/components/ui/stepper'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

const steps = [
  { label: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
  { label: 'Model Setup', description: 'Configure Ollama or API' },
  { label: 'Final Check', description: 'Verify configuration' },
]

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)

  const progress = (currentStep / (steps.length - 1)) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      // Setup complete, navigate to projects
      navigate('/projects')
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50" />

      <motion.div
        className="relative z-10 w-full max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <CardTitle className="text-3xl font-bold text-center">
                Welcome to Klever Desktop
              </CardTitle>
              <CardDescription className="text-center text-base mt-2">
                Let's set up your environment for AI-powered UI automation
              </CardDescription>
            </motion.div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Progress Bar */}
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Step {currentStep + 1} of {steps.length}</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
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
            <div className="min-h-[320px]">
              <AnimatePresence mode="wait">
                {currentStep === 0 && (
                  <motion.div
                    key="step-0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="rounded-lg border bg-gradient-to-br from-muted/50 to-muted/30 p-6">
                      <h3 className="text-xl font-semibold mb-3">Platform & Runtime Tools Check</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        We're checking if all required tools are installed and configured correctly.
                      </p>

                      <div className="space-y-3">
                        <motion.div
                          className="flex items-center gap-3 p-3 rounded-md bg-background/80"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          <span className="text-sm font-medium">Python 3.11+</span>
                        </motion.div>

                        <motion.div
                          className="flex items-center gap-3 p-3 rounded-md bg-background/80"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                        >
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground">Python Packages</span>
                        </motion.div>

                        <motion.div
                          className="flex items-center gap-3 p-3 rounded-md bg-background/80"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground">ADB (Android Debug Bridge)</span>
                        </motion.div>

                        <motion.div
                          className="flex items-center gap-3 p-3 rounded-md bg-background/80"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 }}
                        >
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium text-muted-foreground">Playwright (Web Automation)</span>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="rounded-lg border bg-gradient-to-br from-muted/50 to-muted/30 p-6">
                      <h3 className="text-xl font-semibold mb-3">Model Configuration</h3>
                      <p className="text-sm text-muted-foreground mb-6">
                        Choose how you want to run AI models: locally with Ollama or via API
                      </p>

                      <div className="grid gap-4 md:grid-cols-2">
                        <motion.div
                          className="p-4 rounded-lg border-2 border-muted bg-background/80 hover:border-primary transition-colors cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <h4 className="font-semibold mb-2">Local (Ollama)</h4>
                          <p className="text-xs text-muted-foreground">
                            Run models locally with Ollama. Requires installation.
                          </p>
                        </motion.div>

                        <motion.div
                          className="p-4 rounded-lg border-2 border-muted bg-background/80 hover:border-primary transition-colors cursor-pointer"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <h4 className="font-semibold mb-2">API</h4>
                          <p className="text-xs text-muted-foreground">
                            Use cloud APIs. Requires API key configuration.
                          </p>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 p-6">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="flex justify-center mb-4"
                      >
                        <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center">
                          <CheckCircle2 className="h-10 w-10 text-white" />
                        </div>
                      </motion.div>

                      <h3 className="text-xl font-semibold text-center mb-3">Setup Complete!</h3>
                      <p className="text-sm text-center text-muted-foreground">
                        Your environment is ready. You can now create projects and start exploring AI-powered UI automation.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <motion.div
              className="flex justify-between pt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
                className="min-w-[100px]"
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                className="min-w-[100px]"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
