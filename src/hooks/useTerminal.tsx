/**
 * useTerminal Hook
 * Custom hook to access Terminal Context
 */

import { useContext } from 'react'
import { TerminalContext } from '@/contexts/TerminalContext'

export function useTerminal() {
  const context = useContext(TerminalContext)

  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider')
  }

  return context
}
