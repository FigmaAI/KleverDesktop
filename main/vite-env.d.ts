/**
 * Type definitions for Electron Forge Vite plugin environment variables
 * These are injected by @electron-forge/plugin-vite at build/runtime
 */

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

declare module 'electron-squirrel-startup' {
  const check: boolean;
  export default check;
}