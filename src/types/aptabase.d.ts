declare module '@aptabase/electron/renderer' {
  export function trackEvent(
    eventName: string,
    props?: Record<string, string | number | boolean>
  ): Promise<void>
}

declare module '@aptabase/electron/main' {
  export function initialize(appKey: string): void
}
