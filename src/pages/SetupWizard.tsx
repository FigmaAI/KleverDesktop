import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle } from 'lucide-react'

const steps = [
  { id: 1, title: 'Platform Tools', description: 'Check Python, ADB, Playwright' },
  { id: 2, title: 'Model Setup', description: 'Configure Ollama or API' },
  { id: 3, title: 'Final Check', description: 'Verify configuration' },
]

export function SetupWizard() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    } else {
      // Setup complete, navigate to projects
      navigate('/projects')
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to Klever Desktop</CardTitle>
            <CardDescription>
              Let's set up your environment for AI-powered UI automation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Step {currentStep} of {steps.length}</span>
                <span>{Math.round(progress)}% Complete</span>
              </div>
            </div>

            {/* Step Indicators */}
            <div className="flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      step.id < currentStep
                        ? 'border-primary bg-primary text-primary-foreground'
                        : step.id === currentStep
                        ? 'border-primary bg-background text-primary'
                        : 'border-muted bg-background text-muted-foreground'
                    }`}
                  >
                    {step.id < currentStep ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="min-h-[300px] rounded-lg border bg-muted/30 p-6">
              {currentStep === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Platform & Runtime Tools Check</h3>
                  <p className="text-sm text-muted-foreground">
                    We're checking if all required tools are installed and configured correctly.
                  </p>
                  {/* TODO: Implement actual checks */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span>Python 3.11+</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                      <span>Python Packages</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                      <span>ADB (Android Debug Bridge)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Circle className="h-5 w-5 text-muted-foreground" />
                      <span>Playwright (Web Automation)</span>
                    </div>
                  </div>
                </div>
              )}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Model Configuration</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose how you want to run AI models: locally with Ollama or via API
                  </p>
                  {/* TODO: Implement model selection */}
                </div>
              )}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Setup Complete!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your environment is ready. You can now create projects and start exploring.
                  </p>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                Back
              </Button>
              <Button onClick={handleNext}>
                {currentStep === steps.length ? 'Get Started' : 'Next'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
