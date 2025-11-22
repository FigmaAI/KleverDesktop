import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SearchButton() {
  const handleOpenCommandMenu = () => {
    // Trigger Cmd+K / Ctrl+K keyboard shortcut
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: typeof window !== 'undefined' && window.navigator.platform.includes('Mac'),
      ctrlKey: typeof window !== 'undefined' && !window.navigator.platform.includes('Mac'),
      bubbles: true
    })
    document.dispatchEvent(event)
  }

  return (
    <Button onClick={handleOpenCommandMenu} variant="outline" size="sm">
      <Search className="h-4 w-4" />
      Search
      <kbd className="ml-2 hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">{typeof window !== 'undefined' && window.navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}</span>K
      </kbd>
    </Button>
  )
}
