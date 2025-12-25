/**
 * ANSI Parser Utility
 * Converts ANSI escape codes to React elements with proper styling
 * Uses Tailwind CSS classes for light/dark mode support
 */

import { Fragment, type JSX } from 'react'

// ANSI color code to Tailwind class mapping
// Format: 'light-mode-class dark:dark-mode-class'
const ANSI_COLOR_CLASSES: Record<string, string> = {
  // Foreground colors
  '30': 'text-zinc-900 dark:text-zinc-900', // Black
  '31': 'text-red-600 dark:text-red-400', // Red
  '32': 'text-green-600 dark:text-green-400', // Green
  '33': 'text-amber-600 dark:text-amber-400', // Yellow
  '34': 'text-blue-600 dark:text-blue-400', // Blue
  '35': 'text-purple-600 dark:text-purple-400', // Magenta
  '36': 'text-cyan-600 dark:text-cyan-400', // Cyan
  '37': 'text-zinc-700 dark:text-zinc-300', // White
  '90': 'text-zinc-500 dark:text-zinc-500', // Bright Black (Gray)
  '91': 'text-red-500 dark:text-red-400', // Bright Red
  '92': 'text-green-500 dark:text-green-400', // Bright Green
  '93': 'text-yellow-600 dark:text-yellow-400', // Bright Yellow
  '94': 'text-blue-500 dark:text-blue-400', // Bright Blue
  '95': 'text-purple-500 dark:text-purple-400', // Bright Magenta
  '96': 'text-cyan-500 dark:text-cyan-400', // Bright Cyan
  '97': 'text-zinc-900 dark:text-white', // Bright White
}

const ANSI_BG_CLASSES: Record<string, string> = {
  '40': 'bg-zinc-900 dark:bg-zinc-900', // Black
  '41': 'bg-red-600 dark:bg-red-500', // Red
  '42': 'bg-green-600 dark:bg-green-500', // Green
  '43': 'bg-amber-500 dark:bg-amber-500', // Yellow
  '44': 'bg-blue-600 dark:bg-blue-500', // Blue
  '45': 'bg-purple-600 dark:bg-purple-500', // Magenta
  '46': 'bg-cyan-600 dark:bg-cyan-500', // Cyan
  '47': 'bg-zinc-200 dark:bg-zinc-300', // White
  '100': 'bg-zinc-500 dark:bg-zinc-500', // Bright Black
  '101': 'bg-red-500 dark:bg-red-400', // Bright Red
  '102': 'bg-green-500 dark:bg-green-400', // Bright Green
  '103': 'bg-yellow-500 dark:bg-yellow-400', // Bright Yellow
  '104': 'bg-blue-500 dark:bg-blue-400', // Bright Blue
  '105': 'bg-purple-500 dark:bg-purple-400', // Bright Magenta
  '106': 'bg-cyan-500 dark:bg-cyan-400', // Bright Cyan
  '107': 'bg-white dark:bg-white', // Bright White
}

interface TextSegment {
  text: string
  colorClass?: string
  bgClass?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/**
 * Parse ANSI escape codes and convert to styled text segments
 */
export function parseAnsi(text: string): TextSegment[] {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[([0-9;]*)m|\[([0-9;]*)m/g

  const segments: TextSegment[] = []
  let currentStyle: Partial<TextSegment> = {}
  let lastIndex = 0

  let match: RegExpExecArray | null

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this ANSI code
    if (match.index > lastIndex) {
      const textContent = text.substring(lastIndex, match.index)
      segments.push({
        text: textContent,
        ...currentStyle,
      })
    }

    // Parse the ANSI code
    const codeString = match[1] || match[2] || ''
    const codes = codeString.split(';').filter((c) => c !== '')

    // Apply codes to current style
    for (const code of codes) {
      if (code === '0' || code === '') {
        // Reset
        currentStyle = {}
      } else if (code === '1') {
        // Bold
        currentStyle.bold = true
      } else if (code === '3') {
        // Italic
        currentStyle.italic = true
      } else if (code === '4') {
        // Underline
        currentStyle.underline = true
      } else if (ANSI_COLOR_CLASSES[code]) {
        // Foreground color
        currentStyle.colorClass = ANSI_COLOR_CLASSES[code]
      } else if (ANSI_BG_CLASSES[code]) {
        // Background color
        currentStyle.bgClass = ANSI_BG_CLASSES[code]
      }
    }

    lastIndex = ansiRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.substring(lastIndex)
    segments.push({
      text: textContent,
      ...currentStyle,
    })
  }

  // If no ANSI codes found, return the whole text as one segment
  if (segments.length === 0) {
    segments.push({ text })
  }

  return segments
}

/**
 * Render ANSI text as React elements with Tailwind classes
 */
export function renderAnsi(text: string): JSX.Element {
  const segments = parseAnsi(text)

  return (
    <>
      {segments.map((segment, index) => {
        const classes: string[] = []

        if (segment.colorClass) {
          classes.push(segment.colorClass)
        }
        if (segment.bgClass) {
          classes.push(segment.bgClass)
        }
        if (segment.bold) {
          classes.push('font-bold')
        }
        if (segment.italic) {
          classes.push('italic')
        }
        if (segment.underline) {
          classes.push('underline')
        }

        // If no styles, just return text
        if (classes.length === 0) {
          return <Fragment key={index}>{segment.text}</Fragment>
        }

        return (
          <span key={index} className={classes.join(' ')}>
            {segment.text}
          </span>
        )
      })}
    </>
  )
}
