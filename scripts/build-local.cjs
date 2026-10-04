const path = require('node:path');
const { build } = require('vite');

async function main() {
  const root = path.resolve(__dirname, '..');
  await build({ root, configFile: path.join(root, 'vite.config.ts') });
  await build({
    root,
    configFile: path.join(root, 'vite.main.config.js'),
    define: { MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined', MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window') },
    build: {
      outDir: path.join(root, '.vite', 'build'),
      lib: { entry: path.join(root, 'main', 'index.ts'), formats: ['cjs'], fileName: () => 'index.js' },
    },
  });
  await build({
    root,
    configFile: path.join(root, 'vite.preload.config.js'),
    build: {
      outDir: path.join(root, '.vite', 'build'), emptyOutDir: false,
      lib: { entry: path.join(root, 'main', 'preload.ts'), formats: ['cjs'], fileName: () => 'preload.js' },
    },
  });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
