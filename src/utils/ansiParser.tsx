/**
 * ANSI Parser Utility
 * Converts ANSI escape codes to React elements with proper styling
 */

import { Fragment } from 'react'

// ANSI color codes mapping
const ANSI_COLORS: Record<string, string> = {
  // Foreground colors
  '30': '#000000', // Black
  '31': '#e06c75', // Red
  '32': '#98c379', // Green
  '33': '#e5c07b', // Yellow
  '34': '#61afef', // Blue
  '35': '#c678dd', // Magenta
  '36': '#56b6c2', // Cyan
  '37': '#abb2bf', // White
  '90': '#5c6370', // Bright Black (Gray)
  '91': '#e06c75', // Bright Red
  '92': '#98c379', // Bright Green
  '93': '#e5c07b', // Bright Yellow
  '94': '#61afef', // Bright Blue
  '95': '#c678dd', // Bright Magenta
  '96': '#56b6c2', // Bright Cyan
  '97': '#ffffff', // Bright White

  // Background colors
  '40': 'bgBlack',
  '41': 'bgRed',
  '42': 'bgGreen',
  '43': 'bgYellow',
  '44': 'bgBlue',
  '45': 'bgMagenta',
  '46': 'bgCyan',
  '47': 'bgWhite',
  '100': 'bgBrightBlack',
  '101': 'bgBrightRed',
  '102': 'bgBrightGreen',
  '103': 'bgBrightYellow',
  '104': 'bgBrightBlue',
  '105': 'bgBrightMagenta',
  '106': 'bgBrightCyan',
  '107': 'bgBrightWhite',
}

const ANSI_BG_COLORS: Record<string, string> = {
  bgBlack: '#000000',
  bgRed: '#e06c75',
  bgGreen: '#98c379',
  bgYellow: '#e5c07b',
  bgBlue: '#61afef',
  bgMagenta: '#c678dd',
  bgCyan: '#56b6c2',
  bgWhite: '#abb2bf',
  bgBrightBlack: '#5c6370',
  bgBrightRed: '#e06c75',
  bgBrightGreen: '#98c379',
  bgBrightYellow: '#e5c07b',
  bgBrightBlue: '#61afef',
  bgBrightMagenta: '#c678dd',
  bgBrightCyan: '#56b6c2',
  bgBrightWhite: '#ffffff',
}

interface TextSegment {
  text: string
  color?: string
  bgColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/**
 * Parse ANSI escape codes and convert to styled text segments
 */
export function parseAnsi(text: string): TextSegment[] {
  // Remove common ANSI escape sequences patterns
  // Pattern: \x1b[<codes>m or \x1b[<codes>m or \[<codes>m
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
      } else if (ANSI_COLORS[code]) {
        // Color code
        const firstChar = code.charAt(0)
        const firstTwoChars = code.substring(0, 2)
        if (firstChar === '4' || firstTwoChars === '10') {
          // Background color
          const bgName = ANSI_COLORS[code]
          currentStyle.bgColor = ANSI_BG_COLORS[bgName]
        } else {
          // Foreground color
          currentStyle.color = ANSI_COLORS[code]
        }
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
 * Render ANSI text as React elements
 */
export function renderAnsi(text: string): JSX.Element {
  const segments = parseAnsi(text)

  return (
    <>
      {segments.map((segment, index) => {
        const style: React.CSSProperties = {}

        if (segment.color) {
          style.color = segment.color
        }
        if (segment.bgColor) {
          style.backgroundColor = segment.bgColor
        }
        if (segment.bold) {
          style.fontWeight = 'bold'
        }
        if (segment.italic) {
          style.fontStyle = 'italic'
        }
        if (segment.underline) {
          style.textDecoration = 'underline'
        }

        // If no styles, just return text
        if (Object.keys(style).length === 0) {
          return <Fragment key={index}>{segment.text}</Fragment>
        }

        return (
          <span key={index} style={style}>
            {segment.text}
          </span>
        )
      })}
    </>
  )
}
