import { useRef, useEffect } from 'react'
import { CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Terminal, AnimatedSpan } from '@/components/ui/terminal'
import { useTerminal } from '@/hooks/useTerminal'
import { renderAnsi } from '@/utils/ansiParser'

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
  const { lines } = useTerminal()
  const outputRef = useRef<HTMLDivElement>(null)

  // Filter lines for integration test
  const integrationLines = lines.filter((line) => line.source === 'integration')

  // Auto-scroll to bottom when new lines are added
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [integrationLines])

  return (
    <BlurFade key="step-2" delay={0.1}>
      <Card className="h-full min-h-[480px]" >
        <CardContent className="p-6 h-full">
          <div className="grid grid-cols-8 gap-6">
            {/* Left: Title, Description, and Controls */}
            <div className="col-span-3 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Final Integration Test</h3>
                <p className="text-sm text-muted-foreground">
                  Run the integration test to verify your setup
                </p>
              </div>

              {!integrationTestRunning && !integrationTestComplete && (
                <Button onClick={onRunTest}>Run Integration Test</Button>
              )}

              {/* Retry/Stop Button */}
              {(integrationTestRunning || integrationTestComplete) && (
                <Button
                  variant={integrationTestRunning ? 'destructive' : 'outline'}
                  onClick={integrationTestRunning ? onStopTest : onRunTest}
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

              {/* Guide message when test is running */}
              {integrationTestRunning && (
                <Alert>
                  <AlertDescription>
                    <p className="font-semibold text-sm mb-1">Test in progress...</p>
                    <p className="text-sm">
                      Please wait while the browser opens and closes. The terminal on the right
                      shows detailed progress.
                    </p>
                  </AlertDescription>
                </Alert>
              )}



              {integrationTestComplete && integrationTestSuccess && (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle className="h-4 w-4 text-green-500" />
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

            {/* Right: Terminal Output */}
            <div className="col-span-5 flex h-full flex-col">
              <div className="flex h-full overflow-hidden rounded-lg border">
                <div ref={outputRef} className="h-full min-h-[400px] max-h-[420px] overflow-y-auto">
                  <Terminal
                    sequence={false}
                    className="h-full border-0 rounded-none max-w-none"
                    title="Terminal Output"
                  >
                    {integrationLines.length === 0 ? (
                      <AnimatedSpan className="text-muted-foreground">
                        No output yet. Click &quot;Run Integration Test&quot; to start.
                      </AnimatedSpan>
                    ) : (
                      <>
                        {integrationLines.map((line) => (
                          <AnimatedSpan key={line.id} className="font-mono text-xs">
                            {renderAnsi(line.content)}
                          </AnimatedSpan>
                        ))}
                      </>
                    )}
                  </Terminal>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </BlurFade>
  )
}
