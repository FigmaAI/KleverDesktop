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

  // Keyboard shortcut for command menu (Cmd+K or Ctrl+K)
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const dockItems = [
    {
      icon: Home,
      label: 'Projects',
      path: '/projects',
      isActive: location.pathname.startsWith('/projects'),
    },
    {
      icon: Settings,
      label: 'Settings',
      path: '/settings',
      isActive: location.pathname === '/settings',
    },
    {
      icon: Terminal,
      label: 'Terminal',
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
        <DrawerContent className="max-h-[85vh] h-[85vh]">
          <div className="flex flex-col h-full overflow-hidden">
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
                      className="flex size-full items-center justify-center"
                    >
                      <item.icon className="size-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{item.label}</p>
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
                    className="flex size-full items-center justify-center"
                  >
                    <Search className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Search ⌘K</p>
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
                    className="flex size-full items-center justify-center"
                  >
                    <Github className="size-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GitHub</p>
                </TooltipContent>
              </Tooltip>
            </DockIcon>

            <Separator orientation="vertical" className="h-full py-2" />

            {/* Theme Toggle */}
            <DockIcon>
              <AnimatedThemeToggler
                className="flex size-full items-center justify-center"
                title="Toggle theme"
              />
            </DockIcon>
          </Dock>
        </TooltipProvider>
      </div>
    </div>
  )
}
