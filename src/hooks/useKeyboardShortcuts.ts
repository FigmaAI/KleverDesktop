import { useEffect, useCallback } from 'react'

/**
 * Keyboard shortcut definitions
 * 
 * Navigation:
 * - ⌘1 / Ctrl+1: Projects
 * - ⌘2 / Ctrl+2: Schedules
 * - ⌘3 / Ctrl+3 or ⌘, / Ctrl+,: Settings
 * - Escape: Go back
 * 
 * Actions:
 * - ⌘K / Ctrl+K: Search
 * - ⌘N / Ctrl+N: New Project
 * - ⌘T / Ctrl+T: New Task
 * - ⌘S / Ctrl+S: Save (in settings)
 * - ⌘G / Ctrl+G: Open GitHub
 * - ⌘\ / Ctrl+\: Toggle theme
 * - Ctrl+Shift+`: Toggle Terminal
 */

export interface KeyboardShortcutHandlers {
  onSearch?: () => void
  onProjects?: () => void
  onSchedules?: () => void
  onSettings?: () => void
  onNewProject?: () => void
  onNewTask?: () => void
  onSave?: () => void
  onToggleTerminal?: () => void
  onToggleTheme?: () => void
  onOpenGitHub?: () => void
  onEscape?: () => void
  onArrowDown?: () => void
  onArrowUp?: () => void
  onEnter?: () => void
  onDelete?: () => void
}

interface UseKeyboardShortcutsOptions {
  handlers: KeyboardShortcutHandlers
  enabled?: boolean
  canSave?: boolean
  canCreateTask?: boolean
}

export function useKeyboardShortcuts({
  handlers,
  enabled = true,
  canSave = false,
  canCreateTask = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    const isMac = typeof window !== 'undefined' && window.navigator.platform.includes('Mac')
    const modKey = isMac ? e.metaKey : e.ctrlKey

    // Skip if in input/textarea (except Escape)
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      if (e.key !== 'Escape') return
    }

    // Search: ⌘K / Ctrl+K
    if (e.key === 'k' && modKey) {
      e.preventDefault()
      handlers.onSearch?.()
      return
    }

    // Projects: ⌘1 / Ctrl+1
    if (e.key === '1' && modKey) {
      e.preventDefault()
      handlers.onProjects?.()
      return
    }

    // Schedules: ⌘2 / Ctrl+2
    if (e.key === '2' && modKey) {
      e.preventDefault()
      handlers.onSchedules?.()
      return
    }

    // Settings: ⌘3 / Ctrl+3 OR ⌘, / Ctrl+,
    if ((e.key === '3' || e.key === ',') && modKey) {
      e.preventDefault()
      handlers.onSettings?.()
      return
    }

    // New Project: ⌘N / Ctrl+N
    if (e.key === 'n' && modKey && !e.shiftKey) {
      e.preventDefault()
      handlers.onNewProject?.()
      return
    }

    // New Task: ⌘T / Ctrl+T
    if (e.key === 't' && modKey && canCreateTask) {
      e.preventDefault()
      handlers.onNewTask?.()
      return
    }

    // Save: ⌘S / Ctrl+S
    if (e.key === 's' && modKey && canSave) {
      e.preventDefault()
      handlers.onSave?.()
      return
    }

    // Terminal: Ctrl+Shift+`
    if (e.key === '`' && e.ctrlKey && e.shiftKey) {
      e.preventDefault()
      handlers.onToggleTerminal?.()
      return
    }

    // GitHub: ⌘G / Ctrl+G
    if (e.key === 'g' && modKey) {
      e.preventDefault()
      handlers.onOpenGitHub?.()
      return
    }

    // Theme: ⌘\ / Ctrl+\
    if (e.key === '\\' && modKey) {
      e.preventDefault()
      handlers.onToggleTheme?.()
      return
    }

    // Escape: Go back
    if (e.key === 'Escape') {
      e.preventDefault()
      handlers.onEscape?.()
      return
    }

    // Arrow navigation (only when not in dialogs)
    if (!target.closest('[role="dialog"]')) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        handlers.onArrowDown?.()
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        handlers.onArrowUp?.()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        handlers.onEnter?.()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handlers.onDelete?.()
        return
      }
    }
  }, [enabled, handlers, canSave, canCreateTask])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * Get platform-specific modifier key display
 */
export function getModifierKey(): string {
  const isMac = typeof window !== 'undefined' && window.navigator.platform.includes('Mac')
  return isMac ? '⌘' : 'Ctrl'
}

/**
 * Format shortcut for display
 */
export function formatShortcut(keys: string[]): string {
  return keys.join('')
}

/**
 * Keyboard shortcut definitions for help/display
 */
export const SHORTCUTS = {
  search: { keys: ['⌘', 'K'], description: 'Search' },
  projects: { keys: ['⌘', '1'], description: 'Projects' },
  schedules: { keys: ['⌘', '2'], description: 'Schedules' },
  settings: { keys: ['⌘', ','], description: 'Settings' },
  newProject: { keys: ['⌘', 'N'], description: 'New Project' },
  newTask: { keys: ['⌘', 'T'], description: 'New Task' },
  save: { keys: ['⌘', 'S'], description: 'Save' },
  terminal: { keys: ['⌃', '⇧', '`'], description: 'Terminal' },
  github: { keys: ['⌘', 'G'], description: 'GitHub' },
  theme: { keys: ['⌘', '\\'], description: 'Toggle Theme' },
  escape: { keys: ['Esc'], description: 'Go Back' },
} as const

