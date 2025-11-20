import { defineConfig } from 'vite';
import path from 'path';

// Vite config for Electron main process
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: 'main/index.ts',
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'fs',
        'path',
        'child_process',
        'os',
        'js-yaml',
        ...Object.keys(require('./package.json').dependencies || {}),
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    emptyOutDir: false, // Don't delete the whole directory
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './main'),
    },
  },
});
