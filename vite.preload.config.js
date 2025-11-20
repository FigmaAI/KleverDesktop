import { defineConfig } from 'vite';
import path from 'path';

// Vite config for Electron preload script
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    lib: {
      entry: 'main/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...Object.keys(require('./package.json').dependencies || {}),
      ],
      output: {
        entryFileNames: '[name].js',
      },
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './main'),
    },
  },
});
