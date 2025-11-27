import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"
import { MoonIcon, SunIcon } from "@radix-ui/react-icons"

interface AnimatedThemeTogglerProps
  extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  ...props
}: AnimatedThemeTogglerProps) => {
  const [isDark, setIsDark] = useState(() => {
    // Initialize from localStorage or system preference
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('theme')
      if (stored === 'dark') return true
      if (stored === 'light') return false
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Apply theme on mount and when isDark changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }
  }, [isDark])

  // Watch for external theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    const observer = new window.MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  const toggleTheme = useCallback(async () => {
    console.log('[ThemeToggler] Toggle clicked, current isDark:', isDark)
    if (!buttonRef.current) {
      console.log('[ThemeToggler] No button ref!')
      return
    }

    const newTheme = !isDark
    console.log('[ThemeToggler] Setting new theme to:', newTheme ? 'dark' : 'light')

    // Check if View Transition API is supported
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      console.log('[ThemeToggler] Using View Transition API')
      try {
        await document.startViewTransition(() => {
          flushSync(() => {
            setIsDark(newTheme)
          })
        }).ready

        const { top, left, width, height } =
          buttonRef.current.getBoundingClientRect()
        const x = left + width / 2
        const y = top + height / 2
        const maxRadius = Math.hypot(
          Math.max(left, window.innerWidth - left),
          Math.max(top, window.innerHeight - top)
        )

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${x}px ${y}px)`,
              `circle(${maxRadius}px at ${x}px ${y}px)`,
            ],
          },
          {
            duration,
            easing: "ease-in-out",
            pseudoElement: "::view-transition-new(root)",
          }
        )
      } catch (error) {
        console.error('[ThemeToggler] View Transition error:', error)
        setIsDark(newTheme)
      }
    } else {
      console.log('[ThemeToggler] Fallback mode (no View Transition API)')
      setIsDark(newTheme)
    }
  }, [isDark, duration])

  return (
    <button
      ref={buttonRef}
      onClick={toggleTheme}
      className={cn("flex items-center justify-center", className)}
      {...props}
    >
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
