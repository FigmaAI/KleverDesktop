import { useState, useEffect, useRef, useCallback } from 'react'
import { ModelConfig } from '@/types/setupWizard'
import { useTerminal } from './useTerminal'

export function useIntegrationTest() {
  const { addLine, clearLines } = useTerminal()

  const [integrationTestRunning, setIntegrationTestRunning] = useState(false)
  const [integrationTestComplete, setIntegrationTestComplete] = useState(false)
  const [integrationTestSuccess, setIntegrationTestSuccess] = useState(false)

  // Use ref to store latest addLine function
  const addLineRef = useRef(addLine)
  useEffect(() => {
    addLineRef.current = addLine
  }, [addLine])

  // Setup event listeners with useEffect (empty deps to run only once on mount)
  useEffect(() => {
    console.log('[useIntegrationTest] Setting up event listeners')

    const handleOutput = (data: string) => {
      console.log('[useIntegrationTest] Received output:', data.substring(0, 50))
      addLineRef.current({
        source: 'integration',
        sourceId: 'integration-test',
        type: 'stdout',
        content: data,
      })
    }

    const handleComplete = (success: boolean) => {
      console.log('[useIntegrationTest] ⭐⭐⭐ Integration test completed:', success)
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(success)

      if (success) {
        addLineRef.current({
          source: 'integration',
          sourceId: 'integration-test',
          type: 'stdout',
          content: '✓ Integration test completed successfully!',
        })
      } else {
        addLineRef.current({
          source: 'integration',
          sourceId: 'integration-test',
          type: 'stderr',
          content: '✗ Integration test failed. Please check the output above.',
        })
      }
    }

    // Register listeners
    console.log('[useIntegrationTest] Registering listeners...')
    window.electronAPI.onIntegrationTestOutput(handleOutput)
    window.electronAPI.onIntegrationTestComplete(handleComplete)
    console.log('[useIntegrationTest] Listeners registered!')

    // Cleanup on unmount
    return () => {
      console.log('[useIntegrationTest] Cleaning up event listeners')
      window.electronAPI.removeAllListeners('integration:output')
      window.electronAPI.removeAllListeners('integration:complete')
    }
  }, []) // Empty dependency array - run only once on mount!

  const handleRunIntegrationTest = useCallback(async (modelConfig: ModelConfig) => {
    console.log('[useIntegrationTest] handleRunIntegrationTest called')
    setIntegrationTestRunning(true)
    setIntegrationTestComplete(false)
    setIntegrationTestSuccess(false)
    clearLines()

    try {
      console.log('[useIntegrationTest] Starting integration test...')
      await window.electronAPI.runIntegrationTest(modelConfig)
      console.log('[useIntegrationTest] Integration test started')
    } catch (error) {
      console.error('[useIntegrationTest] Error starting test:', error)
      setIntegrationTestRunning(false)
      setIntegrationTestComplete(true)
      setIntegrationTestSuccess(false)
      addLineRef.current({
        source: 'integration',
        sourceId: 'integration-test',
        type: 'stderr',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }, [clearLines])

  const handleStopIntegrationTest = useCallback(async () => {
    await window.electronAPI.stopIntegrationTest()
    addLineRef.current({
      source: 'integration',
      sourceId: 'integration-test',
      type: 'stderr',
      content: 'Integration test cancelled by user.',
    })
  }, [])

  return {
    integrationTestRunning,
    integrationTestComplete,
    integrationTestSuccess,
    handleRunIntegrationTest,
    handleStopIntegrationTest,
  }
}
