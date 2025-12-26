/**
 * Terminal Context
 * Global state management for the Universal Terminal
 */

/* eslint-disable react-refresh/only-export-components */
import { createContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react'
import type {
  TerminalLine,
  TerminalProcess,
  TerminalContextValue,
  TerminalSettings,
  TerminalType,
  TerminalLevel,
} from '@/types/terminal'

const DEFAULT_SETTINGS: TerminalSettings = {
  autoScroll: true,
  autoOpen: true,
  autoOpenOnError: true,
  autoClose: false,
  autoCloseDelay: 3,
  maxLines: 1000,
}

export const TerminalContext = createContext<TerminalContextValue | null>(null)

interface TerminalProviderProps {
  children: ReactNode
}

export function TerminalProvider({ children }: TerminalProviderProps) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [processes, setProcesses] = useState<TerminalProcess[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [height, setHeight] = useState(50)
  const [settings, setSettings] = useState<TerminalSettings>(DEFAULT_SETTINGS)
  const [errorCount, setErrorCount] = useState(0)
  const [warningCount, setWarningCount] = useState(0)

  // Detect log level from content
  const detectLevel = useCallback((content: string, type: TerminalType): TerminalLevel => {
    const lowerContent = content.toLowerCase()

    // Error patterns
    if (
      type === 'stderr' ||
      lowerContent.includes('error:') ||
      lowerContent.includes('error -') ||
      lowerContent.includes('exception:') ||
      lowerContent.includes('traceback') ||
      lowerContent.includes('failed') ||
      lowerContent.includes('❌') ||
      lowerContent.includes('[error]') ||
      /\berror\b/.test(lowerContent)
    ) {
      return 'error'
    }

    // Warning patterns
    if (
      lowerContent.includes('warning:') ||
      lowerContent.includes('warn:') ||
      lowerContent.includes('⚠️') ||
      lowerContent.includes('[warning]') ||
      lowerContent.includes('[warn]')
    ) {
      return 'warning'
    }

    return 'info'
  }, [])

  // Add a new line to the terminal
  const addLine = useCallback(
    (line: Omit<TerminalLine, 'id' | 'timestamp' | 'level'>) => {
      const level = detectLevel(line.content, line.type)

      const newLine: TerminalLine = {
        id: window.crypto.randomUUID(),
        timestamp: new Date(),
        level,
        ...line,
      }

      setLines((prev) => {
        const updated = [...prev, newLine]
        // Keep only maxLines
        if (updated.length > settings.maxLines) {
          return updated.slice(-settings.maxLines)
        }
        return updated
      })

      // Update error/warning counts
      if (level === 'error') {
        setErrorCount((prev) => prev + 1)
        // Auto-open on error (always)
        if (settings.autoOpenOnError) {
          setIsOpen(true)
        }
      } else if (level === 'warning') {
        setWarningCount((prev) => prev + 1)
      }
    },
    [detectLevel, settings.maxLines, settings.autoOpenOnError]
  )

  // Add a new process
  const addProcess = useCallback((process: Omit<TerminalProcess, 'startedAt' | 'hasError'>) => {
    const newProcess: TerminalProcess = {
      ...process,
      startedAt: new Date(),
      hasError: false,
    }

    setProcesses((prev) => [...prev, newProcess])

    // Auto-open on process start
    if (settings.autoOpen && !isOpen) {
      setIsOpen(true)
    }
  }, [settings.autoOpen, isOpen])

  // Update a process
  const updateProcess = useCallback((id: string, updates: Partial<TerminalProcess>) => {
    setProcesses((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
            ...p,
            ...updates,
            completedAt: updates.status && updates.status !== 'running' ? new Date() : p.completedAt,
          }
          : p
      )
    )

    // Auto-close on successful completion
    if (updates.status === 'completed' && settings.autoClose && !errorCount) {
      setTimeout(() => {
        setIsOpen(false)
      }, settings.autoCloseDelay * 1000)
    }
  }, [settings.autoClose, settings.autoCloseDelay, errorCount])

  // Remove a process
  const removeProcess = useCallback((id: string) => {
    setProcesses((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Clear all lines
  const clearLines = useCallback(() => {
    setLines([])
    setErrorCount(0)
    setWarningCount(0)
  }, [])

  // Clear notification badges
  const clearNotifications = useCallback(() => {
    setErrorCount(0)
    setWarningCount(0)
  }, [])

  // Update settings
  const updateSettings = useCallback((newSettings: Partial<TerminalSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }, [])

  // Note: Notification badges are cleared when terminal button is clicked
  // This is handled in the TerminalButton component

  // Setup IPC event listeners
  useEffect(() => {
    // Task events
    const handleTaskOutput = (data: { projectId: string; taskId: string; output: string }) => {
      addLine({
        source: 'task',
        sourceId: data.taskId,
        type: 'stdout',
        content: data.output,
      })
    }

    const handleTaskError = (data: { projectId: string; taskId: string; error: string }) => {
      addLine({
        source: 'task',
        sourceId: data.taskId,
        type: 'stderr',
        content: data.error,
      })
    }

    const handleTaskComplete = (data: { projectId: string; taskId: string; code: number }) => {
      updateProcess(`task-${data.taskId}`, {
        status: data.code === 0 ? 'completed' : 'failed',
        exitCode: data.code,
        hasError: data.code !== 0,
      })
    }

    // Environment events
    const handleEnvProgress = (data: string) => {
      // console.log('[TerminalContext] Received env:progress:', data);
      addLine({
        source: 'env',
        type: 'stdout',
        content: data,
      })
    }

    // Python download events
    const handlePythonProgress = (data: string) => {
      addLine({
        source: 'env',
        type: 'stdout',
        content: data,
      })
    }

    // Installation events
    const handleInstallProgress = (data: string) => {
      addLine({
        source: 'env',
        type: 'stdout',
        content: data,
      })
    }

    // Project events
    const handleProjectOutput = (data: string) => {
      addLine({
        source: 'project',
        type: 'stdout',
        content: data,
      })
    }

    const handleProjectError = (data: string) => {
      addLine({
        source: 'project',
        type: 'stderr',
        content: data,
      })
    }

    // Integration test events
    const handleIntegrationOutput = (data: string) => {
      addLine({
        source: 'integration',
        type: 'stdout',
        content: data,
      })
    }

    const handleIntegrationComplete = (success: boolean) => {
      // This is handled by useIntegrationTest hook for state management
      // We just log the completion here
      console.log('[TerminalContext] Integration test complete:', success)
    }

    // Register listeners and collect cleanup functions
    const cleanups = [
      window.electronAPI.onTaskOutput(handleTaskOutput),
      window.electronAPI.onTaskError(handleTaskError),
      window.electronAPI.onTaskComplete(handleTaskComplete),
      window.electronAPI.onEnvProgress(handleEnvProgress),
      window.electronAPI.onPythonProgress(handlePythonProgress),
      window.electronAPI.onInstallProgress(handleInstallProgress),
      window.electronAPI.onProjectOutput(handleProjectOutput),
      window.electronAPI.onProjectError(handleProjectError),
      window.electronAPI.onIntegrationTestOutput(handleIntegrationOutput),
      window.electronAPI.onIntegrationTestComplete(handleIntegrationComplete),
      window.electronAPI.onOllamaPullProgress((data: string) => {
        addLine({
          source: 'ollama',
          type: 'stdout',
          content: data,
        })
      }),
    ]

    // Cleanup when effect re-runs (e.g., when addLine/updateProcess changes)
    return () => {
      cleanups.forEach(cleanup => cleanup?.())
    }
  }, [addLine, updateProcess])

  const value: TerminalContextValue = useMemo(
    () => ({
      lines,
      processes,
      isOpen,
      height,
      settings,
      errorCount,
      warningCount,
      setIsOpen,
      setHeight,
      updateSettings,
      addLine,
      addProcess,
      updateProcess,
      removeProcess,
      clearLines,
      clearNotifications,
    }),
    [
      lines,
      processes,
      isOpen,
      height,
      settings,
      errorCount,
      warningCount,
      addLine,
      addProcess,
      updateProcess,
      removeProcess,
      clearLines,
      clearNotifications,
      updateSettings,
    ]
  )

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
}
