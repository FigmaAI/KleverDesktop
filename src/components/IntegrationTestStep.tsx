import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface IntegrationTestStepProps {
  integrationTestRunning: boolean
  integrationTestComplete: boolean
  integrationTestSuccess: boolean
  onRunTest: () => void
  onStopTest: () => void
}

export function IntegrationTestStep({
  integrationTestRunning,
  integrationTestComplete,
  integrationTestSuccess,
  onRunTest,
  onStopTest,
}: IntegrationTestStepProps) {
  return (
    <BlurFade key="step-2" delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>Final Integration Test</CardTitle>
          <CardDescription>Run the integration test to verify your setup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!integrationTestRunning && !integrationTestComplete && (
              <Button onClick={onRunTest} className="w-full">
                Run Integration Test
              </Button>
            )}

            {/* Guide message when test is running */}
            {integrationTestRunning && (
              <Alert>
                <AlertDescription>
                  <p className="font-semibold text-sm mb-1">Test in progress...</p>
                  <p className="text-sm">
                    Please wait while the browser opens and closes. The terminal below will show
                    detailed progress.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Retry/Stop Button */}
            {(integrationTestRunning || integrationTestComplete) && (
              <Button
                variant={integrationTestRunning ? 'destructive' : 'outline'}
                onClick={integrationTestRunning ? onStopTest : onRunTest}
                className="w-full"
              >
                {integrationTestRunning ? (
                  'Stop Test'
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Test
                  </>
                )}
              </Button>
            )}

            {integrationTestComplete && integrationTestSuccess && (
              <Alert variant="success">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Setup complete! All tests passed successfully.
                </AlertDescription>
              </Alert>
            )}

            {integrationTestComplete && !integrationTestSuccess && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Integration test failed. Please review the output and fix any issues.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
