import { useState, useCallback, useRef, useEffect } from 'react'
import { ModelConfig } from '@/types/setupWizard'
import { useTerminal } from './useTerminal'

export function useIntegrationTest() {
  const { addLine, addProcess, updateProcess, clearLines, setIsOpen, setActiveTab } = useTerminal()

  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)

  // Track if listeners are registered to avoid duplicates
  const listenersRegistered = useRef(false)

  // Register event listeners once on mount
  // NOTE: TerminalContext already handles integration:output events
  // We only need to handle integration:complete for state management
  useEffect(() => {
    if (listenersRegistered.current) return

    listenersRegistered.current = true

    const processId = 'integration-test'

    // Listen for completion (state management only)
    window.electronAPI.onIntegrationTestComplete((success: boolean) => {
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(success)

      updateProcess(processId, {
        status: success ? 'completed' : 'failed',
        exitCode: success ? 0 : 1,
        hasError: !success,
      })
    })

    // Cleanup on unmount
    return () => {
      window.electronAPI.removeAllListeners('integration:complete')
      listenersRegistered.current = false
    }
  }, [updateProcess])

  const handleRunIntegrationTest = useCallback(async (modelConfig: ModelConfig) => {
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
      // Event listeners are already registered in useEffect
      const result = await window.electronAPI.runIntegrationTest(modelConfig)

      if (!result.success) {
        throw new Error('Failed to start integration test')
      }
    } catch (error) {
      console.error('[useIntegrationTest] Error starting test:', error)
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
  }, [addLine, addProcess, updateProcess, clearLines, setIsOpen, setActiveTab])

  const handleStopIntegrationTest = useCallback(async () => {
    await window.electronAPI.stopIntegrationTest()
    setIntegrationTestRunning(false)
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
  }, [updateProcess, addLine])

  return {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  }
}
