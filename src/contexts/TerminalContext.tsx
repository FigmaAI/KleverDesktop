/**
 * Terminal Context
 * Global state management for the Universal Terminal
 */

import { createContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react'
import type {
  TerminalLine,
  TerminalProcess,
  TerminalContextValue,
  TerminalTab,
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
  const [activeTab, setActiveTab] = useState<TerminalTab>('all')
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

  // Get filtered lines based on active tab
  const getFilteredLines = useCallback(() => {
    if (activeTab === 'all') return lines

    const sourceMap: Record<TerminalTab, string[]> = {
      all: [],
      tasks: ['task'],
      projects: ['project'],
      setup: ['env', 'integration'],
    }

    const sources = sourceMap[activeTab]
    return lines.filter((line) => sources.includes(line.source))
  }, [lines, activeTab])

  // Note: Notification badges are cleared when terminal button is clicked
  // This is handled in the TerminalButton component

  // Setup IPC event listeners
  useEffect(() => {
    console.log('[TerminalContext] Setting up IPC event listeners')

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

    // NOTE: Integration test events are handled by useIntegrationTest hook directly

    // Register listeners
    window.electronAPI.onTaskOutput(handleTaskOutput)
    window.electronAPI.onTaskError(handleTaskError)
    window.electronAPI.onTaskComplete(handleTaskComplete)
    window.electronAPI.onEnvProgress(handleEnvProgress)
    window.electronAPI.onPythonProgress(handlePythonProgress)
    window.electronAPI.onInstallProgress(handleInstallProgress)
    window.electronAPI.onProjectOutput(handleProjectOutput)
    window.electronAPI.onProjectError(handleProjectError)
    // NOTE: Integration test events are handled by useIntegrationTest hook directly
    // window.electronAPI.onIntegrationTestOutput(handleIntegrationOutput)
    // window.electronAPI.onIntegrationTestComplete(handleIntegrationComplete)

    // Cleanup
    return () => {
      console.log('[TerminalContext] Cleaning up IPC event listeners')
      window.electronAPI.removeAllListeners('task:output')
      window.electronAPI.removeAllListeners('task:error')
      window.electronAPI.removeAllListeners('task:complete')
      window.electronAPI.removeAllListeners('env:progress')
      window.electronAPI.removeAllListeners('python:progress')
      window.electronAPI.removeAllListeners('install:progress')
      window.electronAPI.removeAllListeners('project:output')
      window.electronAPI.removeAllListeners('project:error')
      window.electronAPI.removeAllListeners('integration:output')
      window.electronAPI.removeAllListeners('integration:complete')
    }
  }, [addLine, updateProcess])

  const value: TerminalContextValue = useMemo(
    () => ({
      lines,
      processes,
      isOpen,
      height,
      activeTab,
      settings,
      errorCount,
      warningCount,
      setIsOpen,
      setHeight,
      setActiveTab,
      updateSettings,
      addLine,
      addProcess,
      updateProcess,
      removeProcess,
      clearLines,
      clearNotifications,
      getFilteredLines,
    }),
    [
      lines,
      processes,
      isOpen,
      height,
      activeTab,
      settings,
      errorCount,
      warningCount,
      addLine,
      addProcess,
      updateProcess,
      removeProcess,
      clearLines,
      clearNotifications,
      getFilteredLines,
      updateSettings,
    ]
  )

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
}
