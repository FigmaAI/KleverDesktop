import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, Settings, Terminal, Github, Search } from 'lucide-react'
import { DotPattern } from '@/components/magicui/dot-pattern'
import { Dock, DockIcon } from '@/components/magicui/dock'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { CommandMenu } from '@/components/CommandMenu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer'
import { TerminalHeader } from '@/components/UniversalTerminal/TerminalHeader'
import { TerminalOutput } from '@/components/UniversalTerminal/TerminalOutput'
import { useTerminal } from '@/hooks/useTerminal'
import { cn } from '@/lib/utils'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [commandOpen, setCommandOpen] = useState(false)
  const { isOpen: terminalOpen, setIsOpen: setTerminalOpen } = useTerminal()

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      const isMac = typeof window !== 'undefined' && window.navigator.platform.includes('Mac')
      const modKey = isMac ? e.metaKey : e.ctrlKey

      // Search: Cmd+K / Ctrl+K
      if (e.key === 'k' && modKey) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }

      // Projects: Cmd+P / Ctrl+P
      if (e.key === 'p' && modKey) {
        e.preventDefault()
        navigate('/projects')
      }

      // Settings: Cmd+, / Ctrl+,
      if (e.key === ',' && modKey) {
        e.preventDefault()
        navigate('/settings')
      }

      // Terminal: Ctrl+Shift+`
      if (e.key === '`' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setTerminalOpen((open) => !open)
      }

      // GitHub: Cmd+G / Ctrl+G
      if (e.key === 'g' && modKey) {
        e.preventDefault()
        window.electronAPI.openExternal('https://github.com/FigmaAI/KleverDesktop')
      }

      // Theme: Cmd+\ / Ctrl+\
      if (e.key === '\\' && modKey) {
        e.preventDefault()
        // Toggle theme logic is handled by AnimatedThemeToggler internally usually,
        // but since we need to trigger it programmatically, we might need a context or just toggle class.
        // For now, let's manually toggle the class on documentElement as a fallback or dispatch event.
        // However, AnimatedThemeToggler likely uses useTheme or similar.
        // Let's try to simulate a click or just toggle the class directly if simple.
        // Assuming simple class toggle for now as seen in App.tsx
        if (document.documentElement.classList.contains('dark')) {
          document.documentElement.classList.remove('dark')
        } else {
          document.documentElement.classList.add('dark')
        }
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [navigate, setTerminalOpen])

  const dockItems = [
    {
      icon: Home,
      label: 'Projects',
      shortcut: '⌘P',
      path: '/projects',
      isActive: location.pathname.startsWith('/projects'),
    },
    {
      icon: Settings,
      label: 'Settings',
      shortcut: '⌘,',
      path: '/settings',
      isActive: location.pathname === '/settings',
    },
    {
      icon: Terminal,
      label: 'Terminal',
      shortcut: '⌃⇧`',
      onClick: () => {
        setTerminalOpen(!terminalOpen)
      },
      isActive: terminalOpen,
    },
  ]

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Static Dot Background */}
      <DotPattern
        className={cn(
          "[mask-image:radial-gradient(300px_circle_at_center,white,transparent)]",
        )}
      />

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Command Menu */}
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} />

      {/* Terminal Drawer */}
      <Drawer open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="flex flex-col h-full min-h-[60vh] overflow-hidden">
            <TerminalHeader />
            <TerminalOutput />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Floating Dock Navigation */}
      <div className="relative z-20 pb-8">
        <TooltipProvider>
          <Dock direction="middle">
            {dockItems.map((item) => (
              <DockIcon key={item.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (item.path) {
                          navigate(item.path)
                        } else if (item.onClick) {
                          item.onClick()
                        }
                      }}
                      aria-label={item.label}
                      className="flex size-full items-center justify-center outline-none"
                    >
                      <item.icon className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.label} <kbd className="ml-1 text-xs text-muted-foreground font-sans">{item.shortcut}</kbd></p>
                  </TooltipContent>
                </Tooltip>
              </DockIcon>
            ))}
            <Separator orientation="vertical" className="h-full py-2" />

            {/* Search Button */}
            <DockIcon>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCommandOpen(true)}
                    aria-label="Search"
                    className="flex size-full items-center justify-center outline-none"
                  >
                    <Search className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search <kbd className="ml-1 text-xs text-muted-foreground font-sans">⌘K</kbd></p>
                </TooltipContent>
              </Tooltip>
            </DockIcon>

            {/* GitHub Link */}
            <DockIcon>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      window.electronAPI.openExternal('https://github.com/FigmaAI/KleverDesktop')
                    }}
                    aria-label="GitHub"
                    className="flex size-full items-center justify-center outline-none"
                  >
                    <Github className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GitHub <kbd className="ml-1 text-xs text-muted-foreground font-sans">⌘G</kbd></p>
                </TooltipContent>
              </Tooltip>
            </DockIcon>

            <Separator orientation="vertical" className="h-full py-2" />

            {/* Theme Toggle */}
            <DockIcon>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex size-full items-center justify-center">
                    <AnimatedThemeToggler />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle Theme <kbd className="ml-1 text-xs text-muted-foreground font-sans">⌘\</kbd></p>
                </TooltipContent>
              </Tooltip>
            </DockIcon>
          </Dock>
        </TooltipProvider>
      </div>
    </div>
  )
}
