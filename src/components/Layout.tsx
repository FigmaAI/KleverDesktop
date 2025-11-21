import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Home, Settings, Terminal, Plus } from 'lucide-react'
import { InteractiveGridPattern } from '@/components/magicui/interactive-grid-pattern'
import { Dock, DockIcon } from '@/components/magicui/dock'
import { cn } from '@/lib/utils'

export function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

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
        // TODO: Open terminal panel
        console.log('Terminal clicked')
      },
      isActive: false,
    },
    {
      icon: Plus,
      label: 'New Project',
      path: '/projects/new',
      isActive: location.pathname === '/projects/new',
    },
  ]

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Animated Grid Background */}
      <InteractiveGridPattern
        className="absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,white,transparent_85%)]"
        width={60}
        height={60}
        numSquares={50}
        maxOpacity={0.3}
        duration={3}
        repeatDelay={1}
      />

      {/* Main Content */}
      <main className="relative z-10 flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Floating Dock Navigation */}
      <div className="relative z-20 pb-8">
        <Dock magnification={60} distance={140} direction="bottom">
          {dockItems.map((item, index) => (
            <DockIcon
              key={index}
              className={cn(
                'bg-background/80 backdrop-blur-md border border-border/50 transition-all duration-300',
                item.isActive && 'bg-primary/20 border-primary/50'
              )}
            >
              <button
                onClick={() => {
                  if (item.path) {
                    navigate(item.path)
                  } else if (item.onClick) {
                    item.onClick()
                  }
                }}
                className="flex h-full w-full items-center justify-center"
                title={item.label}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    item.isActive ? 'text-primary' : 'text-foreground'
                  )}
                />
              </button>
            </DockIcon>
          ))}
        </Dock>
      </div>
    </div>
  )
}
