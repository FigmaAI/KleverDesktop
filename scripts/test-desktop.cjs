/** Build and run an isolated, offline Electron/preload/renderer IPC regression. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ensureElectronRuntime, electronEnvironment } = require('./electron-runtime.cjs');

async function main() {
  const { build } = await import('vite');
  const repository = path.resolve(__dirname, '..');
  for (const artifact of ['dist/index.html', '.vite/build/preload.js']) {
    if (!fs.existsSync(path.join(repository, artifact))) {
      throw new Error(`Missing ${artifact}. Run npm run build:local before the desktop smoke test.`);
    }
  }
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-desktop-smoke-'));
  let child;
  try {
    await build({
      root: repository,
      configFile: path.join(repository, 'vite.main.config.js'),
      logLevel: 'warn',
      build: {
        outDir: path.join(scratch, 'entry'),
        emptyOutDir: true,
        lib: { entry: path.join(repository, 'scripts/desktop-smoke-entry.ts'), formats: ['cjs'], fileName: () => 'smoke.cjs' },
      },
    });
    const runtime = await ensureElectronRuntime();
    const environment = electronEnvironment(runtime, {
      KLEVER_DESKTOP_SMOKE_ROOT: scratch,
      KLEVER_DESKTOP_SMOKE_REPOSITORY: repository,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    });
    // Launch a genuine Electron main process even from Node-oriented parent shells.
    delete environment.ELECTRON_RUN_AS_NODE;
    const exitCode = await new Promise((resolve, reject) => {
      child = spawn(runtime.executable, [path.join(scratch, 'entry/smoke.cjs')], {
        cwd: repository, env: environment, stdio: 'inherit', windowsHide: true,
      });
      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('The isolated desktop smoke test exceeded 90 seconds.'));
      }, 90_000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        if (signal) reject(new Error(`The isolated desktop smoke process exited with ${signal}.`));
        else resolve(code ?? 1);
      });
    });
    if (exitCode !== 0) throw new Error(`Desktop IPC smoke test failed (exit ${exitCode}).`);
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => {
        child.once('exit', resolve);
        const force = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
        force.unref();
      });
    }
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
