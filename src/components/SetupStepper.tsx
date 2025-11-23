import { CheckCircle } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { cn } from '@/lib/utils'
import { StepConfig } from '@/types/setupWizard'

interface SetupStepperProps {
  steps: StepConfig[]
  currentStep: number
}

export function SetupStepper({ steps, currentStep }: SetupStepperProps) {
  return (
    <BlurFade delay={0.3} className="min-w-fit">
      <nav aria-label="Progress" className="space-y-4 md:space-y-8">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep
          const isActive = index === currentStep
          const isDisabled = index > currentStep

          return (
            <div key={index} className="relative flex items-start">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute left-3 top-8 md:left-4 md:top-10 h-full w-0.5 rounded-full',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                  style={{
                    height: 'calc(100% + 1rem)',
                  }}
                />
              )}

              {/* Step indicator */}
              <div className="relative z-10 flex-shrink-0">
                <div
                  className={cn(
                    'flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full text-xs font-semibold transition-all',
                    isCompleted &&
                      'bg-primary text-primary-foreground',
                    isActive &&
                      'bg-primary text-primary-foreground ring-4 ring-primary/20 border-4 border-background',
                    isDisabled &&
                      'bg-muted text-muted-foreground border-2 border-border'
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 md:h-5 md:w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>

              {/* Step content */}
              <div className="ml-3 md:ml-4 min-w-0 flex-1 hidden md:block">
                <p
                  className={cn(
                    'text-sm font-medium',
                    isActive && 'text-foreground',
                    isCompleted && 'text-foreground',
                    isDisabled && 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </p>
                <p
                  className={cn(
                    'text-xs mt-0.5',
                    isDisabled ? 'text-muted-foreground/60' : 'text-muted-foreground'
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          )
        })}
      </nav>
    </BlurFade>
  )
}
