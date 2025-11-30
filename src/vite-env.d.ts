/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare module '*.css' {
  const content: string
  export default content
}

declare module '*.scss' {
  const content: string
  export default content
}