import { motion } from 'framer-motion'
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepIndicator,
  stepClasses,
  stepIndicatorClasses,
} from '@mui/joy'
import { CheckCircle as CheckCircleIcon } from '@mui/icons-material'
import { StepConfig } from '../types'

interface SetupStepperProps {
  steps: StepConfig[]
  currentStep: number
}

export function SetupStepper({ steps, currentStep }: SetupStepperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      style={{ minWidth: 'fit-content' }}
    >
      <Stepper
        orientation="vertical"
        sx={(theme) => ({
          '--Stepper-verticalGap': { xs: '1rem', md: '2rem' },
          '--StepIndicator-size': { xs: '2rem', md: '2.5rem' },
          '--Step-gap': { xs: '0.5rem', md: '1rem' },
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
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
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
  )
}
