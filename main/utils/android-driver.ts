/** Native Android transport. Every host command uses a fixed executable and argv. */
import { execFile, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { nativeImage } from 'electron';
import { loadAppConfig } from './config-storage';
import type { ApkSource, AppBuildMetadata, DeviceMetadata } from '../types/project';

export interface AndroidDriverOptions { sdkPath?: string; signal?: AbortSignal }
export interface AndroidDevice { serial: string; state: string; model?: string }
export type AndroidAction =
  | { type: 'tap'; x: number; y: number }
  | { type: 'swipe'; startX: number; startY: number; endX: number; endY: number; durationMs?: number }
  | { type: 'text'; text: string }
  | { type: 'back' | 'enter' }
  | { type: 'wait'; durationMs: number };

function cancelled(): Error { const error = new Error('Android operation cancelled.'); error.name = 'AbortError'; return error; }
function checkAbort(signal?: AbortSignal): void { if (signal?.aborted) throw cancelled(); }
function configuredSDK(options: AndroidDriverOptions): string {
  return options.sdkPath ?? loadAppConfig().android.sdkPath ?? '';
}
function sdkRoots(options: AndroidDriverOptions): string[] {
  return [...new Set([
    configuredSDK(options), process.env.ANDROID_SDK_PATH, process.env.ANDROID_SDK_ROOT, process.env.ANDROID_HOME,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'), path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk'),
    '/opt/android-sdk',
  ].filter((value): value is string => !!value))];
}
function resolveTool(name: string, options: AndroidDriverOptions): string {
  const executable = `${name}${process.platform === 'win32' ? '.exe' : ''}`;
  const subfolder = name === 'emulator' ? 'emulator' : 'platform-tools';
  const roots = sdkRoots(options);
  const configured = configuredSDK(options);
  if (configured) {
    const candidate = path.join(configured, subfolder, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  for (const root of roots) {
    const candidate = path.join(root, subfolder, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  if (name === 'adb') {
    for (const directory of ['/opt/homebrew/bin', '/usr/local/bin']) {
      const candidate = path.join(directory, executable);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return executable;
}
function toolEnv(options: AndroidDriverOptions): NodeJS.ProcessEnv {
  const sdkPath = configuredSDK(options);
  return { ...process.env, ...(sdkPath ? { ANDROID_SDK_ROOT: sdkPath, ANDROID_HOME: sdkPath } : {}) };
}

/** Resolve/reject only after execFile observes the owned CLI process close. */
function runTool(executable: string, args: string[], options: AndroidDriverOptions, timeoutMs = 10000, maxBuffer = 2 * 1024 * 1024): Promise<Buffer> {
  checkAbort(options.signal);
  return new Promise((resolve, reject) => {
    let child: ChildProcess | undefined;
    let finished = false;
    let aborted = false;
    let closed = false;
    let forceKill: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { if (forceKill) clearTimeout(forceKill); options.signal?.removeEventListener('abort', abort); };
    const finishCancellation = () => {
      if (finished || !closed) return;
      finished = true;
      cleanup();
      reject(cancelled());
    };
    const abort = () => {
      if (finished || aborted) return;
      aborted = true;
      child?.kill('SIGTERM');
      forceKill = setTimeout(() => { if (!finished) child?.kill('SIGKILL'); }, 1000);
      finishCancellation();
    };
    child = execFile(executable, args, {
      encoding: 'buffer', timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer,
      env: toolEnv(options), windowsHide: true, shell: false,
    }, (error, stdout, stderr) => {
      if (aborted || options.signal?.aborted) { finishCancellation(); return; }
      finished = true;
      cleanup();
      if (error) {
        const details = Buffer.isBuffer(stderr) ? stderr.toString('utf8') : String(stderr || '');
        return reject(new Error(details.trim().slice(0, 2048) || error.message));
      }
      resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout || ''));
    });
    child.once('close', () => {
      closed = true;
      if (aborted || options.signal?.aborted) finishCancellation();
    });
    if (!finished) {
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
    }
  });
}
async function adb(args: string[], options: AndroidDriverOptions, timeoutMs?: number, maxBuffer?: number): Promise<string> {
  return (await runTool(resolveTool('adb', options), args, options, timeoutMs, maxBuffer)).toString('utf8').trim();
}
function validateSerial(serial: string): void {
  if (typeof serial !== 'string' || !serial || /[\s\0]/.test(serial) || serial.startsWith('-')) throw new Error('Select a valid Android device.');
}
function validatePackage(packageName: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName)) throw new Error('Enter a valid Android package name.');
}
async function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, milliseconds);
    const abort = () => { clearTimeout(timer); cleanup(); reject(cancelled()); };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

export async function listAndroidDevices(options: AndroidDriverOptions = {}): Promise<AndroidDevice[]> {
  const output = await adb(['devices', '-l'], options);
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.trim().match(/^(\S+)\s+(device|offline|unauthorized|recovery|sideload|bootloader|no permissions)\b(.*)$/);
    if (!match) return [];
    const model = match[3].match(/\bmodel:(\S+)/)?.[1];
    return [{ serial: match[1], state: match[2], ...(model ? { model: model.replace(/_/g, ' ') } : {}) }];
  });
}
export async function listAndroidEmulators(options: AndroidDriverOptions = {}): Promise<string[]> {
  const output = (await runTool(resolveTool('emulator', options), ['-list-avds'], options)).toString('utf8');
  return output.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}
export async function getAndroidStatus(options: AndroidDriverOptions = {}): Promise<{ adbAvailable: boolean; adbPath?: string; devices: AndroidDevice[]; emulators: string[] }> {
  const adbPath = resolveTool('adb', options);
  try {
    await runTool(adbPath, ['version'], options);
    const devices = await listAndroidDevices(options);
    let emulators: string[] = [];
    try { emulators = await listAndroidEmulators(options); }
    catch (error) { if (options.signal?.aborted) throw error; }
    return { adbAvailable: true, adbPath, devices, emulators };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    return { adbAvailable: false, adbPath, devices: [], emulators: [] };
  }
}

let emulatorStarting = false;
export async function startAndroidEmulator(options: AndroidDriverOptions & { avdName?: string; timeoutMs?: number } = {}): Promise<{ serial: string; owned: true }> {
  checkAbort(options.signal);
  if (emulatorStarting) throw new Error('An Android emulator is already starting.');
  emulatorStarting = true;
  let child: ChildProcess | undefined;
  let aborted = false;
  let exited = false;
  let closed = false;
  let startupError = '';
  const stopOwned = () => {
    if (!child?.pid || closed) return;
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false }, () => undefined);
    } else {
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch { child.kill('SIGKILL'); }
    }
  };
  const onAbort = () => { aborted = true; stopOwned(); };
  try {
    const avds = await listAndroidEmulators(options);
    const avdName = options.avdName || avds[0];
    if (!avdName || !avds.includes(avdName)) throw new Error('Create an Android Virtual Device in Android Studio, then select it here.');
    const before = await listAndroidDevices(options);
    const occupied = new Set(before.filter(device => device.serial.startsWith('emulator-')).map(device => Number(device.serial.slice(9))));
    let port = 5554;
    while (occupied.has(port) && port <= 5682) port += 2;
    if (port > 5682) throw new Error('No Android emulator port is available.');
    const serial = `emulator-${port}`;
    child = spawn(resolveTool('emulator', options), ['-avd', avdName, '-port', String(port)], {
      env: toolEnv(options), windowsHide: true, shell: false, detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr?.on('data', data => { startupError = (startupError + data.toString()).slice(-2048); });
    child.once('error', error => { startupError = error.message; exited = true; });
    child.once('exit', () => { exited = true; });
    child.once('close', () => { closed = true; });
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const timeoutMs = Math.max(1, Math.min(options.timeoutMs || 180000, 300000));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (aborted) throw cancelled();
      if (exited) throw new Error(startupError || 'The Android emulator exited before it was ready.');
      const devices = await listAndroidDevices(options);
      if (devices.some(device => device.serial === serial && device.state === 'device')) {
        const ready = await adb(['-s', serial, 'shell', 'getprop', 'sys.boot_completed'], options);
        if (ready === '1') { child.unref(); return { serial, owned: true }; }
      }
      await wait(Math.min(1000, Math.max(1, deadline - Date.now())), options.signal);
    }
    throw new Error('The Android emulator did not finish starting in time.');
  } catch (error) {
    stopOwned();
    if (child && !closed) {
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timeout); child?.removeListener('close', done); resolve(); };
        const timeout = setTimeout(done, 2000);
        child!.once('close', done);
        if (closed) done();
      });
    }
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
    emulatorStarting = false;
  }
}

function resolveAPKTool(options: AndroidDriverOptions): string | undefined {
  const suffix = process.platform === 'win32' ? '.exe' : '';
  for (const root of sdkRoots(options)) {
    const directory = path.join(root, 'build-tools');
    if (!fs.existsSync(directory)) continue;
    const versions = fs.readdirSync(directory).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      for (const name of ['aapt2', 'aapt']) {
        const executable = path.join(directory, version, name + suffix);
        if (fs.existsSync(executable)) return executable;
      }
    }
  }
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    for (const name of ['aapt2', 'aapt']) {
      const executable = path.join(directory, name + suffix);
      if (directory && fs.existsSync(executable)) return executable;
    }
  }
}
async function apkPackageName(source: ApkSource, options: AndroidDriverOptions): Promise<string> {
  const executable = resolveAPKTool(options);
  if (!executable) {
    if (source.packageName) { validatePackage(source.packageName); return source.packageName; }
    throw new Error('Install Android SDK Build Tools to read the APK package name, or enter its package name.');
  }
  const output = (await runTool(executable, ['dump', 'badging', source.path!], options, 30000)).toString('utf8');
  const packageName = output.match(/package:\s+name='([^']+)'/)?.[1];
  if (!packageName) throw new Error('Could not read the Android package name from this APK.');
  validatePackage(packageName);
  if (source.packageName && source.packageName !== packageName) throw new Error('The supplied package name does not match the selected APK.');
  return packageName;
}

export async function getAndroidMetadata(serial: string, packageName?: string, options: AndroidDriverOptions = {}): Promise<{ device: DeviceMetadata; app: AppBuildMetadata }> {
  validateSerial(serial);
  if (packageName) validatePackage(packageName);
  const device: DeviceMetadata = { serial };
  const app: AppBuildMetadata = packageName ? { packageName } : {};
  for (const [key, property] of [
    ['manufacturer', 'ro.product.manufacturer'], ['model', 'ro.product.model'],
    ['androidVersion', 'ro.build.version.release'], ['apiLevel', 'ro.build.version.sdk'],
  ] as const) {
    try { const value = await adb(['-s', serial, 'shell', 'getprop', property], options, 5000); if (value) device[key] = value.slice(0, 256); }
    catch (error) { if (options.signal?.aborted) throw error; }
  }
  if (packageName) {
    try {
      const output = await adb(['-s', serial, 'shell', 'dumpsys', 'package', packageName], options, 10000);
      const versionName = output.match(/^\s*versionName=(.+)$/m)?.[1]?.trim();
      const versionCode = output.match(/\bversionCode=(\d+)/)?.[1];
      if (versionName) app.versionName = versionName.slice(0, 256);
      if (versionCode) app.versionCode = versionCode;
    } catch (error) { if (options.signal?.aborted) throw error; }
  }
  return { device, app };
}

export async function prepareAndroidApp(source: ApkSource, serial?: string, options: AndroidDriverOptions = {}): Promise<{ device: DeviceMetadata; app: AppBuildMetadata }> {
  checkAbort(options.signal);
  if (!source || !['apk_file', 'installed_package', 'play_store_url'].includes(source.type)) throw new Error('Select an Android app to test.');
  const devices = await listAndroidDevices(options);
  if (serial) {
    validateSerial(serial);
    if (!devices.some(device => device.serial === serial && device.state === 'device')) throw new Error('The selected Android device is not ready. Check its USB debugging authorization.');
  } else {
    const ready = devices.filter(device => device.state === 'device');
    if (!ready.length) throw new Error('Connect an Android device or start an emulator before testing.');
    if (ready.length > 1) throw new Error('Select an Android device for this test.');
    serial = ready[0].serial;
  }
  let packageName = source.packageName || '';
  if (source.type === 'apk_file') {
    if (!source.path || !fs.existsSync(source.path) || !fs.statSync(source.path).isFile()) throw new Error('Select an existing APK file.');
    packageName = await apkPackageName(source, options);
    const output = await adb(['-s', serial, 'install', '-r', '-t', source.path], options, 180000);
    if (!/\bSuccess\b/.test(output) || /INSTALL_FAILED|\bFailure\b/.test(output)) throw new Error(output || 'ADB did not confirm APK installation.');
  } else if (source.type === 'play_store_url' && !packageName) {
    let url: URL;
    try { url = new URL(source.url || ''); } catch { throw new Error('Enter a valid Google Play app URL.'); }
    if (!((url.protocol === 'https:' && url.hostname === 'play.google.com') ||
          (url.protocol === 'market:' && url.hostname === 'details'))) throw new Error('Enter a valid Google Play app URL.');
    packageName = url.searchParams.get('id') || '';
  }
  validatePackage(packageName);
  const installed = await adb(['-s', serial, 'shell', 'pm', 'path', packageName], options);
  if (!installed.split(/\r?\n/).some(line => line.startsWith('package:'))) throw new Error(`Install ${packageName} on the selected device before testing.`);
  const resolved = await adb(['-s', serial, 'shell', 'cmd', 'package', 'resolve-activity', '--brief', '-a', 'android.intent.action.MAIN', '-c', 'android.intent.category.LAUNCHER', packageName], options);
  const component = resolved.split(/\r?\n/).reverse().find(line => /^[A-Za-z0-9_.]+\/[A-Za-z0-9_.$]+$/.test(line.trim()))?.trim();
  if (!component) throw new Error('The selected Android app does not expose a launcher activity.');
  await adb(['-s', serial, 'shell', 'am', 'force-stop', packageName], options);
  const launched = await adb(['-s', serial, 'shell', 'am', 'start', '-W', '-n', component], options, 30000);
  if (/(?:^|\n)\s*(?:Error:|Exception)/.test(launched)) throw new Error(launched.slice(0, 2048));
  return getAndroidMetadata(serial, packageName, options);
}

export async function captureAndroidScreen(serial: string, filename: string, options: AndroidDriverOptions = {}): Promise<{ path: string; width: number; height: number }> {
  validateSerial(serial);
  checkAbort(options.signal);
  const image = await runTool(resolveTool('adb', options), ['-s', serial, 'exec-out', 'screencap', '-p'], options, 20000, 20 * 1024 * 1024);
  const decoded = nativeImage.createFromBuffer(image);
  const { width, height } = decoded.getSize();
  if (decoded.isEmpty() || !width || !height || image.length < 24 || !image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Android did not return a readable screenshot.');
  checkAbort(options.signal);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, image, { flag: 'wx' });
  return { path: filename, width, height };
}
function coordinate(value: number): void { if (!Number.isSafeInteger(value) || value < 0) throw new Error('Android action coordinates must be non-negative integers.'); }
function duration(value: number, maximum: number): void { if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error('Android action duration is invalid.'); }
/** ADB joins remote-shell arguments. Quote text there, never invoke a host shell. */
function remoteLiteral(value: string): string { return `'${value.replace(/'/g, `'\\''`)}'`; }
export async function executeAndroidAction(serial: string, action: AndroidAction, options: AndroidDriverOptions = {}): Promise<void> {
  validateSerial(serial);
  checkAbort(options.signal);
  const base = ['-s', serial, 'shell', 'input'];
  let args: string[];
  switch (action.type) {
    case 'tap': coordinate(action.x); coordinate(action.y); args = [...base, 'tap', String(action.x), String(action.y)]; break;
    case 'swipe': {
      [action.startX, action.startY, action.endX, action.endY].forEach(coordinate);
      const milliseconds = action.durationMs ?? 400;
      duration(milliseconds, 10000);
      args = [...base, 'swipe', String(action.startX), String(action.startY), String(action.endX), String(action.endY), String(milliseconds)]; break;
    }
    case 'text': {
      if (typeof action.text !== 'string' || !action.text.length || action.text.length > 10000) throw new Error('Enter text for the Android action.');
      if (/[^\x20-\x7e]/.test(action.text)) throw new Error('ADB can send printable ASCII key events only. The active keyboard controls the resulting text; Unicode entry is unavailable.');
      if (action.text.includes('%s')) throw new Error('Android input cannot faithfully enter the literal sequence %s.');
      args = [...base, 'text', remoteLiteral(action.text.replace(/ /g, '%s'))]; break;
    }
    case 'back': args = [...base, 'keyevent', 'KEYCODE_BACK']; break;
    case 'enter': args = [...base, 'keyevent', 'KEYCODE_ENTER']; break;
    case 'wait': duration(action.durationMs, 30000); await wait(action.durationMs, options.signal); return;
    default: throw new Error('Unsupported Android action.');
  }
  const output = await adb(args, options);
  if (/Exception|Error:|SecurityException/.test(output)) throw new Error(output.slice(0, 2048));
}
