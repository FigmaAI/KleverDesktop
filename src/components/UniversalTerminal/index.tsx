/**
 * Universal Terminal
 * Bottom Sheet terminal UI for all Python process outputs
 */

import { useState, useRef, useEffect } from 'react'
import { useTerminal } from '@/hooks/useTerminal'
import { TerminalHeader } from './TerminalHeader'
import { TerminalOutput } from './TerminalOutput'
import { cn } from '@/lib/utils'

export function UniversalTerminal() {
  const { isOpen, setIsOpen, height, setHeight } = useTerminal()
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const initialY = useRef<number>(0)
  const initialHeight = useRef<number>(height)

  // Handle resize drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    initialY.current = e.clientY
    initialHeight.current = height
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const windowHeight = window.innerHeight
      const deltaY = initialY.current - e.clientY
      const deltaPercent = (deltaY / windowHeight) * 100
      const newHeight = Math.min(70, Math.max(30, initialHeight.current + deltaPercent))
      setHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, setHeight])

  // Keyboard shortcut: Cmd+J or Ctrl+`
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Cmd+J (Mac) or Ctrl+J (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
      // Ctrl+` (backtick)
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 left-0 right-0 flex flex-col shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-[1000] bg-background"
      style={{ height: `${height}%` }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute top-0 left-0 right-0 h-1 cursor-ns-resize bg-transparent',
          'hover:bg-primary/20 active:bg-primary'
        )}
      />

      {/* Terminal content */}
      <div className="flex flex-col h-full overflow-hidden">
        <TerminalHeader />
        <TerminalOutput />
      </div>
    </div>
  )
}

// Export sub-components for external use if needed
export { TerminalButton } from './TerminalButton'
