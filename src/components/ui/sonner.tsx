import { useSyncExternalStore } from "react"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

// External store for theme
function getThemeSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function subscribeToTheme(callback: () => void): () => void {
  const observer = new window.MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === "class") {
        callback()
      }
    })
  })
  observer.observe(document.documentElement, { attributes: true })
  return () => observer.disconnect()
}

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "light" as const)

  return (
    <Sonner
      theme={theme as "light" | "dark"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
