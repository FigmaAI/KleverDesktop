import { useState } from 'react'
import { TerminalOutput } from 'react-terminal-ui'
import { ModelConfig } from '../types'

export function useIntegrationTest() {
  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)
  const [terminalLines, setTerminalLines] = useState<React.ReactNode[]>([])
  const [integrationTerminalExpanded, setIntegrationTerminalExpanded] = useState(false)

  const handleRunIntegrationTest = async (modelConfig: ModelConfig) => {
    setIntegrationTestRunning(true)
    setIntegrationTestComplete(false)
    setIntegrationTestSuccess(false)
    setTerminalLines([])

    try {
      // Start the integration test with model config
      await window.electronAPI.runIntegrationTest(modelConfig)

      // Listen for stdout
      window.electronAPI.onIntegrationTestOutput((data: string) => {
        setTerminalLines((prev) => [...prev, <TerminalOutput key={prev.length}>{data}</TerminalOutput>])
      })

      // Listen for completion
      window.electronAPI.onIntegrationTestComplete((success: boolean) => {
        setIntegrationTestRunning(false)
        setIntegrationTestComplete(true)
        setIntegrationTestSuccess(success)

        if (success) {
          setTerminalLines((prev) => [
            ...prev,
            <TerminalOutput key={prev.length}>
              <span style={{ color: '#4caf50' }}>✓ Integration test completed successfully!</span>
            </TerminalOutput>,
          ])
        } else {
          setTerminalLines((prev) => [
            ...prev,
            <TerminalOutput key={prev.length}>
              <span style={{ color: '#f44336' }}>✗ Integration test failed. Please check the output above.</span>
            </TerminalOutput>,
          ])
        }
      })
    } catch (error) {
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(false)
      setTerminalLines((prev) => [
        ...prev,
        <TerminalOutput key={prev.length}>
          <span style={{ color: '#f44336' }}>Error: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </TerminalOutput>,
      ])
    }
  }

  const handleStopIntegrationTest = async () => {
    await window.electronAPI.stopIntegrationTest()
  }

  return {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    terminalLines,
    integrationTerminalExpanded,
    setIntegrationTerminalExpanded,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  }
}
