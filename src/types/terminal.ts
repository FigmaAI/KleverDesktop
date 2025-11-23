/**
 * Terminal Types
 * Type definitions for the Universal Terminal UI
 */

export type TerminalSource = 'env' | 'task' | 'project' | 'integration'
export type TerminalType = 'stdout' | 'stderr' | 'system'
export type TerminalLevel = 'info' | 'warning' | 'error'
export type TerminalTab = 'all' | 'tasks' | 'projects' | 'setup'
export type ProcessStatus = 'running' | 'completed' | 'failed' | 'cancelled'

export interface TerminalLine {
  id: string
  timestamp: Date
  source: TerminalSource
  sourceId?: string // taskId, projectId, etc.
  type: TerminalType
  level: TerminalLevel
  content: string
  color?: string
}

export interface TerminalProcess {
  id: string
  type: TerminalSource
  name: string
  status: ProcessStatus
  startedAt: Date
  completedAt?: Date
  exitCode?: number
  hasError: boolean
}

export interface TerminalSettings {
  autoScroll: boolean
  autoOpen: boolean // Open on process start
  autoOpenOnError: boolean // Always open on error
  autoClose: boolean // Close on successful completion
  autoCloseDelay: number // Delay in seconds before auto-close
  maxLines: number // Maximum lines to keep in memory
}

export interface TerminalState {
  lines: TerminalLine[]
  processes: TerminalProcess[]
  isOpen: boolean
  height: number // 30-70 (%)
  settings: TerminalSettings
  errorCount: number
  warningCount: number
}

export interface TerminalContextValue extends TerminalState {
  setIsOpen: (isOpen: boolean | ((prev: boolean) => boolean)) => void
  setHeight: (height: number | ((prev: number) => number)) => void
  updateSettings: (settings: Partial<TerminalSettings>) => void
  addLine: (line: Omit<TerminalLine, 'id' | 'timestamp' | 'level'>) => void
  addProcess: (process: Omit<TerminalProcess, 'startedAt' | 'hasError'>) => void
  updateProcess: (id: string, updates: Partial<TerminalProcess>) => void
  removeProcess: (id: string) => void
  clearLines: () => void
  clearNotifications: () => void
}
