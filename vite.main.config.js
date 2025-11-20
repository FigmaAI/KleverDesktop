import { defineConfig } from 'vite';

// Vite config for Electron main process (managed by @electron-forge/plugin-vite)
// DO NOT specify outDir - electron-forge manages build output automatically
export default defineConfig({
  resolve: {
    // Some libraries that can run in both Web and Node.js environments require this
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
