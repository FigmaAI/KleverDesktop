import { useEffect } from 'react'
import { DotPattern } from '@/components/magicui/dot-pattern'
import { MorphingText } from '@/components/magicui/morphing-text'
import { cn } from '@/lib/utils'

const loadingTexts = [
    'Local First AI',
    'UI Self Explorer',
    'Klever'
]

interface LoadingScreenProps {
    /**
     * Minimum duration to display the loading screen in milliseconds
     * @default 0
     */
    minDuration?: number
    /**
     * Callback function called after minimum duration has elapsed
     */
    onMinDurationComplete?: () => void
}

export function LoadingScreen({ minDuration = 0, onMinDurationComplete }: LoadingScreenProps = {}) {
    useEffect(() => {
        if (minDuration > 0 && onMinDurationComplete) {
            const timer = setTimeout(() => {
                onMinDurationComplete()
            }, minDuration)

            return () => clearTimeout(timer)
        }
    }, [minDuration, onMinDurationComplete])
    return (
        <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background">
            {/* Dot Pattern Background - Radial gradient mask for subtle effect */}
            <DotPattern
                className={cn(
                    '[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]'
                )}
            />

            {/* Morphing Text - Centered */}
            <div className="relative z-10 flex w-full flex-col items-center justify-center gap-8 px-4">
                <MorphingText
                    texts={loadingTexts}
                    className="!mx-auto whitespace-nowrap text-7xl font-bold text-foreground"
                />
                <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary [animation-delay:300ms]" />
                </div>
            </div>
        </div>
    )
}

