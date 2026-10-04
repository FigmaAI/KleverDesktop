/** Development launch only; production packaging keeps Forge's existing signing. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { ensureElectronRuntime, electronEnvironment } = require('./electron-runtime.cjs');

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode !== 'start' && mode !== 'electron') throw new Error('Use electron-launch.cjs start or electron.');
  const runtime = await ensureElectronRuntime();
  let executable = runtime.executable, argumentsToPass = ['.', ...args];
  if (mode === 'start') {
    const metadataPath = require.resolve('@electron-forge/cli/package.json');
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    executable = process.execPath;
    argumentsToPass = [path.resolve(path.dirname(metadataPath), metadata.bin['electron-forge']), 'start', ...args];
  }
  const child = spawn(executable, argumentsToPass, { cwd: path.resolve(__dirname, '..'), env: electronEnvironment(runtime), stdio: 'inherit', windowsHide: true });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { if (child.exitCode === null && child.signalCode === null) child.kill(signal); });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
