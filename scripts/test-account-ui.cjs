/** Official ChatGPT components with mock-only renderer IPC; no account or device calls. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ensureElectronRuntime, electronEnvironment } = require('./electron-runtime.cjs');

async function main() {
  const { build } = await import('vite');
  const repository = path.resolve(__dirname, '..');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-account-ui-smoke-'));
  let child;
  try {
    await build({ root: repository, configFile: path.join(repository, 'vite.config.ts'), logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: { outDir: path.join(scratch, 'renderer'), lib: { entry: path.join(repository, 'scripts/account-ui-smoke-renderer.tsx'), formats: ['es'], fileName: () => 'ui.js' } } });
    const styles = fs.readdirSync(path.join(scratch, 'renderer')).filter(name => name.endsWith('.css')).map(name => `<link rel="stylesheet" href="./${name}">`).join('');
    fs.writeFileSync(path.join(scratch, 'renderer/index.html'), `<html><head>${styles}</head><body><div id="root"></div><script type="module" src="./ui.js"></script></body></html>`);
    await build({ root: repository, configFile: path.join(repository, 'vite.main.config.js'), logLevel: 'warn', build: { outDir: path.join(scratch, 'entry'), emptyOutDir: true, lib: { entry: path.join(repository, 'scripts/account-ui-smoke-entry.ts'), formats: ['cjs'], fileName: () => 'main.cjs' } } });
    const runtime = await ensureElectronRuntime();
    const environment = electronEnvironment(runtime, { KLEVER_ACCOUNT_UI_ROOT: scratch, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' });
    delete environment.ELECTRON_RUN_AS_NODE;
    await new Promise((resolve, reject) => {
      child = spawn(runtime.executable, [path.join(scratch, 'entry/main.cjs')], { cwd: repository, env: environment, stdio: 'inherit', windowsHide: true });
      const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Account UI smoke exceeded 30 seconds.')); }, 30000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timer); code === 0 && !signal ? resolve() : reject(new Error(`Account UI smoke failed: ${signal || code}`)); });
    });
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
