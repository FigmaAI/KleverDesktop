import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

// Vite config for Electron preload script (managed by @electron-forge/plugin-vite)
// DO NOT specify outDir - electron-forge manages build output automatically
export default defineConfig({
  resolve: {
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external: ['electron', ...builtinModules, ...builtinModules.map((name) => `node:${name}`)],
    },
  },
});
