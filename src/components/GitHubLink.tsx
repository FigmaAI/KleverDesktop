import { useState, useEffect } from 'react'
import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const GITHUB_REPO = 'FigmaAI/KleverDesktop'
const GITHUB_URL = `https://github.com/${GITHUB_REPO}`

export function GitHubLink({ className }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('[GitHubLink] Fetching GitHub stars for:', GITHUB_REPO)

    // Fetch GitHub stars via IPC (bypasses CSP restrictions)
    window.electronAPI.fetchGitHubStars(GITHUB_REPO)
      .then((result) => {
        console.log('[GitHubLink] IPC result:', result)
        if (result.success && result.stars !== undefined) {
          console.log('[GitHubLink] Stars count:', result.stars)
          setStars(result.stars)
        } else {
          console.warn('[GitHubLink] Failed to fetch stars:', result.error)
        }
        setLoading(false)
      })
      .catch((error) => {
        console.error('[GitHubLink] IPC error:', error)
        setLoading(false)
      })
  }, [])

  const handleClick = () => {
    window.electronAPI.openExternal(GITHUB_URL)
  }

  const formatStars = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`
    }
    return count.toLocaleString()
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleClick}
            size="sm"
            variant="ghost"
            className={className}
          >
            <Github className="h-4 w-4" />
            {loading ? (
              <Skeleton className="h-4 w-8 ml-1.5" />
            ) : stars !== null ? (
              <span className="ml-1.5 text-xs font-medium tabular-nums flex items-center gap-1">
                <span className="hidden sm:inline">{stars.toLocaleString()}</span>
                <span className="sm:hidden">{formatStars(stars)}</span>
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Star on GitHub</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
