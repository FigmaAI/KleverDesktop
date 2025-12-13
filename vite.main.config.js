import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// Vite config for Electron main process (managed by @electron-forge/plugin-vite)
// DO NOT specify outDir - electron-forge manages build output automatically
export default defineConfig({
  resolve: {
    // Some libraries that can run in both Web and Node.js environments require this
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules,
      ],
    },
  },
});
