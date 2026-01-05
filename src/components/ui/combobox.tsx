import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface ComboboxOption {
  value: string
  label: string
  itemLabel?: React.ReactNode  // Custom label for dropdown item (defaults to label)
  tooltip?: string  // Optional tooltip for the selected value
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  emptyText = "No results found.",
  searchPlaceholder = "Search...",
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [isTruncated, setIsTruncated] = React.useState(false)
  const buttonTextRef = React.useRef<HTMLSpanElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  // Check if text is truncated
  React.useEffect(() => {
    const checkTruncation = () => {
      if (buttonTextRef.current) {
        const isTrunc = buttonTextRef.current.scrollWidth > buttonTextRef.current.clientWidth
        setIsTruncated(isTrunc)
      }
    }

    checkTruncation()
    window.addEventListener('resize', checkTruncation)
    return () => window.removeEventListener('resize', checkTruncation)
  }, [selectedOption])

  // Enable wheel scrolling on the list
  React.useEffect(() => {
    if (!open) return
    
    // Wait for DOM to be ready
    const timeoutId = setTimeout(() => {
      const listElement = listRef.current
      if (!listElement) return

      // Find the actual scrollable element (cmdk uses a div with cmdk-list attribute)
      const scrollableElement = listElement.querySelector('[cmdk-list]') as HTMLElement || listElement
      
      const handleWheel = (e: globalThis.WheelEvent) => {
        const target = e.target as HTMLElement
        // Only handle if the event is on the list or its children
        if (!scrollableElement.contains(target)) return
        
        const { scrollTop, scrollHeight, clientHeight } = scrollableElement
        const isAtTop = scrollTop <= 0
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1
        
        // If scrolling would go beyond bounds, prevent default to stop page scroll
        if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
          e.preventDefault()
          e.stopPropagation()
        } else {
          // Allow normal scrolling within bounds
          e.stopPropagation()
        }
      }

      // Add event listener with capture to catch events early
      const options = { passive: false, capture: true }
      document.addEventListener('wheel', handleWheel, options)
      
      return () => {
        document.removeEventListener('wheel', handleWheel, options)
      }
    }, 0)
    
    return () => {
      clearTimeout(timeoutId)
    }
  }, [open])

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={selectedOption?.tooltip && isTruncated && !open ? undefined : false}>
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className={cn("justify-between", className)}
                disabled={disabled}
              >
                <span ref={buttonTextRef} className="truncate">
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <PopoverContent
            className="w-[380px] p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command className="overflow-hidden" loop={false}>
              <CommandInput placeholder={searchPlaceholder} />
              <CommandList
                ref={listRef}
                className="max-h-[300px] overflow-y-auto overflow-x-hidden scroll-smooth"
                style={{ 
                  overscrollBehavior: 'contain',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup className="p-1">
                  {options.map((option) => {
                    // Use full value for tooltip if available, otherwise use label
                    const tooltipText = option.tooltip || option.value
                    const displayContent = option.itemLabel ?? option.label

                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={(currentValue) => {
                          onValueChange?.(currentValue === value ? "" : currentValue)
                          setOpen(false)
                        }}
                        title={tooltipText}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {displayContent}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedOption?.tooltip && (
          <TooltipContent side="top" align="start">
            <p>{selectedOption.tooltip}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
