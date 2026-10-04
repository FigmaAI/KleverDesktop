/**
 * macOS development runtime only. The official archive and node_modules stay untouched.
 * Seal a cached internal-APFS copy with ad-hoc signatures; keep existing identifiers,
 * entitlements and runtime/security flags. Distribution still uses Forge's signing config.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const SEAL_VERSION = 1;
const LINKER_PROVENANCE_FLAG = 0x20000;
const executableInDist = dist => path.join(dist, 'Electron.app/Contents/MacOS/Electron');

function command(binary, args) {
  const result = spawnSync(binary, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${path.basename(binary)} failed: ${result.stderr.trim() || result.error?.message || result.status}`);
  return result;
}
function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function verifyBundle(dist, version) {
  if (fs.readFileSync(path.join(dist, 'version'), 'utf8').trim().replace(/^v/, '') !== version) throw new Error('The development Electron version does not match package.json.');
  command('/usr/bin/codesign', ['--verify', '--deep', '--strict', path.join(dist, 'Electron.app')]);
}
function internalTemporaryDirectory() {
  const directory = fs.realpathSync(os.tmpdir());
  // Avoid a user-supplied TMPDIR on an external project volume.
  if (directory.startsWith('/private/var/') || directory.startsWith('/var/')) return directory;
  return '/private/var/tmp';
}
function metadata(file) {
  const result = command('/usr/bin/codesign', ['--display', '--verbose=4', '--entitlements', '-', file]);
  return {
    identifier: result.stderr.match(/^Identifier=(.*)$/m)?.[1],
    flags: result.stderr.match(/flags=(0x[\da-f]+)/)?.[1],
    runtime: result.stderr.match(/^Runtime Version=(.*)$/m)?.[1] || null,
    entitlementsHash: crypto.createHash('sha256').update(result.stdout).digest('hex'),
  };
}
function sealBundle(dist) {
  const app = path.join(dist, 'Electron.app');
  const binaries = [], bundles = [], bundleExecutables = new Map();
  function walk(directory) {
    if (directory.endsWith('.app') || directory.endsWith('.framework')) bundles.push(directory);
    for (const name of fs.readdirSync(directory)) {
      const file = path.join(directory, name), entry = fs.lstatSync(file);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { walk(file); continue; }
      const descriptor = fs.openSync(file, 'r'), magic = Buffer.alloc(4);
      try { fs.readSync(descriptor, magic, 0, 4, 0); } finally { fs.closeSync(descriptor); }
      if (['cffaedfe', 'cefaedfe', 'feedfacf', 'feedface', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca'].includes(magic.toString('hex'))) binaries.push(file);
    }
  }
  walk(app);
  for (const bundle of bundles) {
    const isApp = bundle.endsWith('.app');
    const info = path.join(bundle, isApp ? 'Contents/Info.plist' : 'Resources/Info.plist');
    let name;
    for (const key of ['CFBundleExecutable', 'CFBundleName']) {
      const result = spawnSync('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', info], { encoding: 'utf8' });
      if (result.status === 0) { name = result.stdout.trim(); break; }
    }
    if (!name) throw new Error(`No executable name in ${info}.`);
    bundleExecutables.set(bundle, fs.realpathSync(path.join(bundle, isApp ? 'Contents/MacOS' : '', name)));
  }
  const originals = new Map(binaries.map(file => [fs.realpathSync(file), metadata(file)]));
  const mainExecutables = new Set(bundleExecutables.values());
  const deepestFirst = (left, right) => right.split(path.sep).length - left.split(path.sep).length;
  const targets = [...binaries.filter(file => !mainExecutables.has(fs.realpathSync(file))).sort(deepestFirst), ...bundles.sort(deepestFirst)];
  for (const target of targets) {
    const original = originals.get(bundleExecutables.get(target) || fs.realpathSync(target));
    if (!original?.identifier) throw new Error(`No original code identifier for ${target}.`);
    command('/usr/bin/codesign', ['--force', '--sign', '-', '--identifier', original.identifier, '--preserve-metadata=entitlements,requirements,flags,runtime', '--timestamp=none', target]);
  }
  for (const file of binaries) {
    const original = originals.get(fs.realpathSync(file)), sealed = metadata(file);
    // Sealing replaces a linker-generated signature. This marker is provenance,
    // not a permission, hardened-runtime setting, or security-policy flag.
    const sameSecurityFlags = (parseInt(original.flags, 16) & ~LINKER_PROVENANCE_FLAG) === (parseInt(sealed.flags, 16) & ~LINKER_PROVENANCE_FLAG);
    if (original.identifier !== sealed.identifier || original.runtime !== sealed.runtime || original.entitlementsHash !== sealed.entitlementsHash || !sameSecurityFlags) throw new Error(`Development signing changed security metadata for ${file}.`);
  }
  return { signedObjects: targets.length, machOBinaries: binaries.length, securityMetadataPreserved: true };
}
async function sha256(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

async function ensureElectronRuntime() {
  if (process.platform !== 'darwin') return { executable: require('electron'), distPath: process.env.ELECTRON_OVERRIDE_DIST_PATH, developmentSigned: false };
  const packagePath = require.resolve('electron/package.json');
  const packageDirectory = path.dirname(packagePath);
  const version = json(packagePath).version;
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    const distPath = fs.realpathSync(process.env.ELECTRON_OVERRIDE_DIST_PATH);
    verifyBundle(distPath, version);
    return { executable: executableInDist(distPath), distPath, developmentSigned: true, explicitOverride: true };
  }
  let arch = process.arch;
  if (arch === 'x64') {
    const translated = spawnSync('/usr/sbin/sysctl', ['-in', 'sysctl.proc_translated'], { encoding: 'utf8' });
    if (translated.status === 0 && translated.stdout.trim() === '1') arch = 'arm64';
  }
  const artifact = `electron-v${version}-darwin-${arch}.zip`;
  const checksums = json(path.join(packageDirectory, 'checksums.json'));
  const expectedSHA256 = checksums[artifact];
  if (!expectedSHA256) throw new Error(`No official checksum is available for ${artifact}.`);
  const cache = path.join(internalTemporaryDirectory(), `klever-electron-development-${process.getuid()}`);
  fs.mkdirSync(cache, { recursive: true, mode: 0o700 });
  const key = `${version}-${arch}-${expectedSHA256.slice(0, 16)}-seal${SEAL_VERSION}`;
  const distPath = path.join(cache, key), manifest = path.join(distPath, 'development-runtime.json');
  if (fs.existsSync(manifest)) {
    try {
      const saved = json(manifest);
      if (saved.version !== version || saved.arch !== arch || saved.archiveSHA256 !== expectedSHA256 || saved.sealVersion !== SEAL_VERSION) throw new Error('Cached runtime metadata does not match.');
      verifyBundle(distPath, version);
      return { executable: executableInDist(distPath), distPath, developmentSigned: true, cached: true };
    } catch {
      // Replace only our disposable cache, preserving evidence of a failed copy.
      fs.renameSync(distPath, `${distPath}.invalid-${Date.now()}`);
    }
  }
  const stage = fs.mkdtempSync(path.join(cache, '.build-'));
  try {
    const { downloadArtifact } = createRequire(packagePath)('@electron/get');
    const archive = await downloadArtifact({ version, artifactName: 'electron', platform: 'darwin', arch, checksums });
    const archiveSHA256 = await sha256(archive);
    if (archiveSHA256 !== expectedSHA256) throw new Error('The Electron archive checksum does not match the official package.');
    command('/usr/bin/ditto', ['-x', '-k', archive, stage]);
    const sealed = sealBundle(stage);
    verifyBundle(stage, version);
    fs.writeFileSync(path.join(stage, 'development-runtime.json'), JSON.stringify({ version, arch, archiveSHA256, sealVersion: SEAL_VERSION, ...sealed }, null, 2) + '\n');
    try { fs.renameSync(stage, distPath); }
    catch (error) { if (!fs.existsSync(manifest)) throw error; verifyBundle(distPath, version); }
    return { executable: executableInDist(distPath), distPath, developmentSigned: true, cached: false };
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
function electronEnvironment(runtime, additional = {}) {
  const environment = { ...process.env, ...additional };
  if (runtime.distPath) environment.ELECTRON_OVERRIDE_DIST_PATH = runtime.distPath;
  delete environment.ELECTRON_RUN_AS_NODE;
  return environment;
}
module.exports = { ensureElectronRuntime, electronEnvironment };
if (require.main === module) ensureElectronRuntime().then(runtime => console.log(JSON.stringify(runtime, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
