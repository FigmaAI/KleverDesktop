import { useState } from 'react'
import { ModelConfig } from '@/types/setupWizard'
import { useTerminal } from './useTerminal'

export function useIntegrationTest() {
  const { addLine, addProcess, updateProcess, clearLines, setIsOpen, setActiveTab } = useTerminal()

  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)

  const handleRunIntegrationTest = async (modelConfig: ModelConfig) => {
    setIntegrationTestRunning(true)
    setIntegrationTestComplete(false)
    setIntegrationTestSuccess(false)
    clearLines()
    setIsOpen(true)
    setActiveTab('setup')

    const processId = 'integration-test'
    addProcess({
      id: processId,
      name: 'Integration Test',
      type: 'integration',
      status: 'running',
    })

    try {
      // Start the integration test with model config
      await window.electronAPI.runIntegrationTest(modelConfig)

      // Listen for stdout
      window.electronAPI.onIntegrationTestOutput((data: string) => {
        addLine({
          source: 'integration',
          sourceId: processId,
          type: 'stdout',
          content: data,
        })
      })

      // Listen for completion
      window.electronAPI.onIntegrationTestComplete((success: boolean) => {
        setIntegrationTestRunning(false)
        setIntegrationTestComplete(true)
        setIntegrationTestSuccess(success)

        updateProcess(processId, {
          status: success ? 'completed' : 'failed',
          exitCode: success ? 0 : 1,
          hasError: !success,
        })

        if (success) {
          addLine({
            source: 'integration',
            sourceId: processId,
            type: 'stdout',
            content: '✓ Integration test completed successfully!',
          })
        } else {
          addLine({
            source: 'integration',
            sourceId: processId,
            type: 'stderr',
            content: '✗ Integration test failed. Please check the output above.',
          })
        }
      })
    } catch (error) {
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(false)
      updateProcess(processId, {
        status: 'failed',
        exitCode: 1,
        hasError: true,
      })
      addLine({
        source: 'integration',
        sourceId: processId,
        type: 'stderr',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleStopIntegrationTest = async () => {
    await window.electronAPI.stopIntegrationTest()
    updateProcess('integration-test', {
      status: 'cancelled',
      exitCode: 1,
      hasError: true,
    })
    addLine({
      source: 'integration',
      sourceId: 'integration-test',
      type: 'stderr',
      content: 'Integration test cancelled by user.',
    })
  }

  return {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  }
}
