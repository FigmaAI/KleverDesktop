import { Outlet, Link, useLocation } from 'react-router-dom'
import { Button } from './ui/button'
import { Settings as SettingsIcon, FolderKanban } from 'lucide-react'

export function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-6">
          <h1 className="text-xl font-bold">Klever Desktop</h1>

          <nav className="ml-auto flex gap-4">
            <Link to="/projects">
              <Button
                variant={location.pathname.startsWith('/projects') ? 'default' : 'ghost'}
                size="sm"
              >
                <FolderKanban className="mr-2 h-4 w-4" />
                Projects
              </Button>
            </Link>
            <Link to="/settings">
              <Button
                variant={location.pathname === '/settings' ? 'default' : 'ghost'}
                size="sm"
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                Settings
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
