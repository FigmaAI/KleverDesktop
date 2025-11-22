import React from 'react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  logo?: React.ReactNode
  title?: string
  subtitle?: string
  backButton?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({
  logo,
  title,
  subtitle,
  backButton,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('sticky top-0 z-50 w-full bg-background', className)}>
      <div className="container-wrapper px-6">
        <div className="flex h-14 items-center gap-2 **:data-[slot=separator]:!h-4">
          {/* Left: Logo or Back Button */}
          {logo ? (
            <>
              {logo}
              {(title || subtitle) && <Separator orientation="vertical" className="mx-2" />}
            </>
          ) : backButton ? (
            <>
              {backButton}
              <Separator orientation="vertical" className="mx-2" />
            </>
          ) : null}

          {/* Center: Title & Subtitle */}
          {(title || subtitle) && (
            <div className="flex flex-col justify-center">
              {title && <div className="text-sm font-semibold leading-none">{title}</div>}
              {subtitle && (
                <div className="text-xs text-muted-foreground leading-none mt-1">{subtitle}</div>
              )}
            </div>
          )}

          {/* Right: Actions */}
          {actions && (
            <div className="ml-auto flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </div>
      <Separator />
    </header>
  )
}
