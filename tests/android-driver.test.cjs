const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const load = require('./load-typescript.cjs');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64');
const DEVICE = 'selected-device';
const PACKAGE = 'com.example.app';

async function fixture(t, settings = {}) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'klever android driver '));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const platform = settings.platform || 'darwin';
  const suffix = platform === 'win32' ? '.exe' : '';
  const sdkPath = path.join(root, 'Configured Android SDK');
  const tools = {
    adb: path.join(sdkPath, 'platform-tools', `adb${suffix}`),
    emulator: path.join(sdkPath, 'emulator', `emulator${suffix}`),
    aapt: path.join(sdkPath, 'build-tools', '35.0.0', `aapt${suffix}`),
  };
  for (const filename of Object.values(tools)) {
    await fsp.mkdir(path.dirname(filename), { recursive: true });
    await fsp.writeFile(filename, 'offline fake executable');
    await fsp.chmod(filename, 0o755);
  }
  const calls = [];
  const children = [];
  const kills = [];
  const imageInputs = [];
  let emulatorStarted = false;
  let ownedSerial;
  let virtualElapsed = 0;

  function defaultResponse(call) {
    const args = call.args;
    if (args.includes('-list-avds')) return { stdout: 'Test_AVD\nSecond_AVD\n' };
    if (args[0] === 'version') return { stdout: 'Android Debug Bridge version 1.0.41\n' };
    if (args[0] === 'devices') return { stdout: `List of devices attached\n${DEVICE}\tdevice product:test model:Test_Phone transport_id:1\n` };
    if (args.includes('screencap')) return { stdout: PNG };
    const propertyValues = {
      'ro.product.manufacturer': 'Example Corp', 'ro.product.model': 'Test Phone',
      'ro.build.version.release': '15', 'ro.build.version.sdk': '35', 'sys.boot_completed': '1',
    };
    if (args.includes('getprop')) return { stdout: `${propertyValues[args.at(-1)] || ''}\n` };
    if (args.includes('dumpsys')) return { stdout: '  versionCode=9007199254740993 minSdk=24\n  versionName=2.1-test\n' };
    if (args.includes('badging')) return { stdout: `package: name='${PACKAGE}' versionCode='7' versionName='2.0'\n` };
    if (args.includes('install')) return { stdout: 'Success\n' };
    if (args.includes('packages') || args.includes('path')) return { stdout: `package:${PACKAGE}\n` };
    if (args.includes('resolve-activity')) return { stdout: `${PACKAGE}/.MainActivity\n` };
    return { stdout: '' };
  }

  function makeChild(call) {
    const child = new EventEmitter();
    child.pid = 1000 + children.length;
    child.killed = false;
    child.exitCode = null;
    child.unref = () => {};
    child.kill = (signal = 'SIGTERM') => {
      child.killed = true;
      kills.push({ call, signal, child });
      if (settings.autoCloseOnKill !== false) queueMicrotask(() => child.emit('close', null, signal));
      return true;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    children.push(child);
    return child;
  }

  const childProcess = {
    execFile(executable, args, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      const call = { kind: 'execFile', executable, args: [...args], options: options || {} };
      calls.push(call);
      const child = makeChild(call);
      const response = settings.respond?.(call, { emulatorStarted, ownedSerial, defaultResponse, calls }) ?? defaultResponse(call);
      if (response.pending) child.once('close', (_code, signal) => {
        const error = new Error(signal ? `Process closed after ${signal}` : 'Process closed');
        callback(error, Buffer.alloc(0), Buffer.alloc(0));
      });
      if (!response.pending) queueMicrotask(() => {
        const buffer = (value) => Buffer.isBuffer(value) ? value : Buffer.from(value || '');
        const output = options?.encoding === 'buffer' || options?.encoding === null ? buffer(response.stdout) : buffer(response.stdout).toString();
        const errors = options?.encoding === 'buffer' || options?.encoding === null ? buffer(response.stderr) : buffer(response.stderr).toString();
        callback(response.error || null, output, errors);
        child.exitCode = response.error ? 1 : 0;
        child.emit('close', child.exitCode, null);
      });
      return child;
    },
    spawn(executable, args, options) {
      const call = { kind: 'spawn', executable, args: [...args], options: options || {} };
      calls.push(call);
      emulatorStarted = true;
      const portIndex = args.indexOf('-port');
      ownedSerial = portIndex >= 0 ? `emulator-${args[portIndex + 1]}` : undefined;
      const child = makeChild(call);
      queueMicrotask(() => child.emit('spawn'));
      return child;
    },
  };
  const fsMock = {
    ...fs,
    existsSync(filename) { return filename === settings.extraExecutable || fs.existsSync(filename); },
    statSync(filename, ...args) {
      if (filename === settings.extraExecutable) return { isFile: () => true, isDirectory: () => false };
      return fs.statSync(filename, ...args);
    },
    accessSync(filename, ...args) {
      if (filename === settings.extraExecutable) return;
      return fs.accessSync(filename, ...args);
    },
  };
  const fakeProcess = Object.create(process);
  Object.defineProperty(fakeProcess, 'platform', { value: platform });
  Object.defineProperty(fakeProcess, 'env', { value: { ...process.env, PATH: '', ANDROID_HOME: '', ANDROID_SDK_ROOT: '', ANDROID_SDK_PATH: '' } });
  fakeProcess.kill = (pid, signal) => {
    const owned = children.find((child) => child.pid === Math.abs(pid));
    assert.ok(owned, 'Only a mocked process owned by this fixture can receive a signal');
    return owned.kill(signal);
  };
  const mocks = {
    child_process: childProcess, 'node:child_process': childProcess,
    fs: fsMock, 'node:fs': fsMock,
    os: { ...os, homedir: () => root }, 'node:os': { ...os, homedir: () => root },
    electron: { nativeImage: { createFromBuffer(buffer) {
      imageInputs.push(buffer);
      return { isEmpty: () => settings.invalidImage === true, getSize: () => ({ width: 1, height: 1 }) };
    } } },
    './config-storage': { loadAppConfig: () => ({ android: { sdkPath: settings.noConfiguredSdk ? '' : sdkPath } }) },
  };
  mocks['./native-source'] = load('main/utils/native-source.ts', { fs: fsMock });
  const driver = load('main/utils/android-driver.ts', mocks, {
    process: fakeProcess,
    Date: settings.fastTimers ? class extends Date { static now() { return Date.now() + virtualElapsed; } } : Date,
    setTimeout: settings.fastTimers ? (fn, ms, ...args) => setTimeout(() => { virtualElapsed += ms; fn(...args); }, Math.min(ms, 5)) : setTimeout,
  });
  return { root, sdkPath, tools, driver, calls, children, kills, imageInputs };
}

test('configured Windows SDK executables take priority and preserve paths with spaces', async (t) => {
  const f = await fixture(t, { platform: 'win32' });
  const status = await f.driver.getAndroidStatus();
  assert.equal(status.adbAvailable, true);
  assert.equal(status.adbPath, f.tools.adb);
  assert.equal(status.devices[0].serial, DEVICE);
  assert.equal(status.devices[0].state, 'device');
  assert.deepEqual(Array.from(status.emulators), ['Test_AVD', 'Second_AVD']);
  assert.ok(f.calls.some((call) => call.executable === f.tools.adb));
  assert.ok(f.calls.some((call) => call.executable === f.tools.emulator));
  assert.ok(f.calls.every((call) => call.options.shell !== true));
});

test('Homebrew adb is discovered when no SDK or PATH executable is configured', async (t) => {
  const f = await fixture(t, { noConfiguredSdk: true, extraExecutable: '/opt/homebrew/bin/adb' });
  const status = await f.driver.getAndroidStatus();
  assert.equal(status.adbAvailable, true);
  assert.equal(status.adbPath, '/opt/homebrew/bin/adb');
});

test('device list retains offline and unauthorized states without selecting them', async (t) => {
  const f = await fixture(t, { respond(call) {
    if (call.args[0] === 'devices') return { stdout: 'List of devices attached\nready\tdevice model:Ready_Phone\nlocked\tunauthorized\ndisconnected\toffline\n' };
  } });
  const devices = await f.driver.listAndroidDevices();
  assert.deepEqual(Array.from(devices, (device) => [device.serial, device.state]), [
    ['ready', 'device'], ['locked', 'unauthorized'], ['disconnected', 'offline'],
  ]);
});

test('APK installation treats quotes, shell syntax and Unicode filename as one argv', async (t) => {
  const f = await fixture(t);
  const apkPath = path.join(f.root, 'version 2 "$HOME" $(touch sentinel) 한글.apk');
  await fsp.writeFile(apkPath, 'fake apk');
  const metadata = await f.driver.prepareAndroidApp({ type: 'apk_file', path: apkPath, packageName: PACKAGE }, DEVICE);
  const install = f.calls.find((call) => call.args.includes('install'));
  assert.ok(install, 'The supplied APK must replace any installed prior build');
  assert.equal(install.args.at(-1), apkPath);
  assert.equal(install.args.filter((argument) => argument === apkPath).length, 1);
  assert.ok(install.args.includes('-r'));
  assert.notEqual(install.options.shell, true);
  assert.equal(metadata.app.packageName, PACKAGE);
});

test('installed package launch reads the existing build without reinstalling it', async (t) => {
  const f = await fixture(t);
  const metadata = await f.driver.prepareAndroidApp({ type: 'installed_package', packageName: PACKAGE }, DEVICE);
  assert.equal(metadata.device.serial, DEVICE);
  assert.equal(metadata.app.packageName, PACKAGE);
  assert.equal(f.calls.some((call) => call.args.includes('install')), false);
  assert.equal(f.calls.some((call) => call.args.includes('clear')), false);
});

test('fresh app launch stops only the selected package before starting and reading metadata', async (t) => {
  const f = await fixture(t);
  await f.driver.prepareAndroidApp({ type: 'installed_package', packageName: PACKAGE }, DEVICE);
  const stopIndex = f.calls.findIndex((call) => call.args.includes('force-stop'));
  const startIndex = f.calls.findIndex((call) => call.args.includes('am') && call.args.includes('start'));
  const metadataIndex = f.calls.findIndex((call) => call.args.includes('getprop') || call.args.includes('dumpsys'));
  assert.ok(stopIndex >= 0);
  assert.deepEqual(f.calls[stopIndex].args, ['-s', DEVICE, 'shell', 'am', 'force-stop', PACKAGE]);
  assert.ok(stopIndex < startIndex && startIndex < metadataIndex);
  assert.equal(f.calls.filter((call) => call.args.includes('force-stop')).length, 1);
  assert.equal(f.calls.some((call) => call.args.includes('clear') || call.args.includes('kill')), false);
  assert.equal(f.kills.length, 0);
});

test('metadata reads selected device via argv and preserves large build version literally', async (t) => {
  const f = await fixture(t);
  const metadata = await f.driver.getAndroidMetadata(DEVICE, PACKAGE);
  assert.equal(metadata.device.serial, DEVICE);
  assert.equal(metadata.device.manufacturer, 'Example Corp');
  assert.equal(metadata.device.model, 'Test Phone');
  assert.equal(metadata.device.androidVersion, '15');
  assert.equal(metadata.device.apiLevel, '35');
  assert.equal(metadata.app.versionName, '2.1-test');
  assert.equal(metadata.app.versionCode, '9007199254740993');
  assert.ok(f.calls.every((call) => call.args.includes(DEVICE) && call.options.shell !== true));
});

test('failed metadata queries keep known identity and omit unknown properties', async (t) => {
  const f = await fixture(t, { respond(call) {
    if (call.args.at(-1) === 'ro.product.model' || call.args.includes('dumpsys')) return { error: new Error('device read failed'), stderr: 'device read failed' };
  } });
  const metadata = await f.driver.getAndroidMetadata(DEVICE, PACKAGE);
  assert.equal(metadata.device.serial, DEVICE);
  assert.equal(metadata.device.manufacturer, 'Example Corp');
  assert.equal(metadata.device.model, undefined);
  assert.equal(metadata.app.packageName, PACKAGE);
  assert.equal(metadata.app.versionName, undefined);
  assert.equal(metadata.app.versionCode, undefined);
});

test('screenshot writes exact PNG bytes and returns Electron decoded dimensions', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.root, 'screens', 'before.png');
  const screen = await f.driver.captureAndroidScreen(DEVICE, filename);
  assert.equal(screen.path, filename);
  assert.equal(screen.width, 1);
  assert.equal(screen.height, 1);
  assert.deepEqual(await fsp.readFile(filename), PNG);
  assert.deepEqual(f.imageInputs[0], PNG);
  const capture = f.calls.find((call) => call.args.includes('screencap'));
  assert.deepEqual(capture.args.slice(-3), ['exec-out', 'screencap', '-p']);
});

test('invalid screenshot never reports a successful capture', async (t) => {
  const f = await fixture(t, { invalidImage: true });
  await assert.rejects(f.driver.captureAndroidScreen(DEVICE, path.join(f.root, 'invalid.png')), /image|screenshot|PNG/i);
});

test('capturing into an existing history file refuses to overwrite its evidence', async (t) => {
  const f = await fixture(t);
  const filename = path.join(f.root, 'existing-evidence.png');
  const original = Buffer.from('preserved historical evidence');
  await fsp.writeFile(filename, original);
  await assert.rejects(f.driver.captureAndroidScreen(DEVICE, filename), /exist/i);
  assert.deepEqual(await fsp.readFile(filename), original);
});

test('ASCII key events preserve literal metacharacters in the quoted Android shell argument', async (t) => {
  const f = await fixture(t);
  const text = "hello $(touch sentinel); 'quoted' & \"literal\"";
  await f.driver.executeAndroidAction(DEVICE, { type: 'text', text });
  const input = f.calls.find((call) => call.args.includes('shell'));
  assert.ok(input);
  assert.notEqual(input.options.shell, true);
  const command = input.args.slice(input.args.indexOf('shell') + 1).join(' ');
  const encoded = text.replace(/ /g, '%s');
  assert.equal(command, `input text '${encoded.replace(/'/g, "'\\''")}'`);
});

test('Unicode, control characters and literal percent-s text fail before any device command', async (t) => {
  const f = await fixture(t);
  for (const text of ['한글', 'emoji 🙂', 'line\nbreak', 'nul\0byte', 'literal%svalue']) {
    await assert.rejects(f.driver.executeAndroidAction(DEVICE, { type: 'text', text }), /ASCII|Unicode|text|supported|control|literal sequence/i);
  }
  assert.equal(f.calls.length, 0);
});

test('abort kills only its active CLI process and waits for the child to close', async (t) => {
  const f = await fixture(t, { autoCloseOnKill: false, respond: () => ({ pending: true }) });
  const controller = new AbortController();
  let settled = false;
  const pending = f.driver.executeAndroidAction(DEVICE, { type: 'tap', x: 12, y: 24 }, { signal: controller.signal })
    .then(() => { settled = true; return null; }, (error) => { settled = true; return error; });
  await new Promise((resolve) => setImmediate(resolve));
  controller.abort();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.kills.length, 1);
  assert.equal(settled, false, 'Cancellation must not return while its command remains alive');
  f.kills[0].child.emit('close', null, 'SIGTERM');
  const error = await pending;
  assert.ok(error);
  assert.match(error.message, /abort|cancel/i);
  assert.equal(f.calls.some((call) => call.args.includes('emu') && call.args.includes('kill')), false);
});

test('pre-aborted actions do not launch a CLI process', async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(f.driver.executeAndroidAction(DEVICE, { type: 'back' }, { signal: controller.signal }), /abort|cancel/i);
  assert.equal(f.calls.length, 0);
});

test('cancelling a wait action ends promptly without launching any CLI command', async (t) => {
  const f = await fixture(t);
  const controller = new AbortController();
  const pending = f.driver.executeAndroidAction(DEVICE, { type: 'wait', durationMs: 30000 }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, /abort|cancel/i);
  assert.equal(f.calls.length, 0);
});

test('invalid coordinates and durations fail before any device command', async (t) => {
  const f = await fixture(t);
  for (const action of [
    { type: 'tap', x: -1, y: 0 }, { type: 'tap', x: NaN, y: 0 }, { type: 'tap', x: 1.5, y: 0 },
    { type: 'swipe', startX: 0, startY: 0, endX: 10, endY: 20, durationMs: -1 },
    { type: 'wait', durationMs: 30001 },
  ]) await assert.rejects(f.driver.executeAndroidAction(DEVICE, action), /coordinate|duration/i);
  assert.equal(f.calls.length, 0);
});

test('emulator startup identifies only the new owned device and waits for boot completion', async (t) => {
  const f = await fixture(t, { fastTimers: true, respond(call, state) {
    if (call.args[0] === 'devices') return { stdout: `List of devices attached\nemulator-5554\tdevice\n${state.emulatorStarted ? `${state.ownedSerial}\tdevice\n` : ''}` };
  } });
  const started = await f.driver.startAndroidEmulator({ avdName: 'Test_AVD', timeoutMs: 1000 });
  assert.equal(started.serial, 'emulator-5556');
  assert.equal(started.owned, true);
  const spawn = f.calls.find((call) => call.kind === 'spawn');
  assert.equal(spawn.executable, f.tools.emulator);
  assert.ok(spawn.args.includes('Test_AVD'));
  assert.ok(f.calls.some((call) => call.args.includes('emulator-5556') && call.args.includes('sys.boot_completed')));
  assert.equal(f.kills.length, 0);
  assert.equal(f.calls.some((call) => call.args.includes('emulator-5554') && call.args.includes('kill')), false);
});

test('emulator startup timeout is bounded and cleans up only the process it started', async (t) => {
  const f = await fixture(t, { fastTimers: true, respond(call, state) {
    if (call.args[0] === 'devices') return { stdout: `List of devices attached\nemulator-5554\tdevice\n${state.emulatorStarted ? `${state.ownedSerial}\tdevice\n` : ''}` };
    if (call.args.includes('sys.boot_completed')) return { stdout: '0\n' };
  } });
  const started = Date.now();
  await assert.rejects(f.driver.startAndroidEmulator({ avdName: 'Test_AVD', timeoutMs: 50 }), /timeout|timed out|boot|starting in time/i);
  assert.ok(Date.now() - started < 1000);
  assert.ok(f.kills.some(({ call }) => call.kind === 'spawn'));
  assert.ok(f.kills.every(({ call }) => call.kind === 'spawn'));
  assert.equal(f.calls.some((call) => call.args.includes('emulator-5554') && call.args.includes('kill')), false);
});

test('startup cancellation waits for its owned emulator to close and leaves existing devices alone', async (t) => {
  const f = await fixture(t, { autoCloseOnKill: false, respond(call, state) {
    if (call.args[0] === 'devices') return { stdout: `List of devices attached\nemulator-5554\tdevice\n${state.emulatorStarted ? `${state.ownedSerial}\tdevice\n` : ''}` };
    if (call.args.includes('sys.boot_completed')) return { stdout: '0\n' };
  } });
  const controller = new AbortController();
  let settled = false;
  const pending = f.driver.startAndroidEmulator({ avdName: 'Test_AVD', timeoutMs: 5000, signal: controller.signal })
    .then(() => { settled = true; return null; }, (error) => { settled = true; return error; });
  for (let attempt = 0; attempt < 20 && !f.calls.some((call) => call.kind === 'spawn'); attempt++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(f.calls.some((call) => call.kind === 'spawn'), 'The fixture must reach owned emulator startup before cancellation');
  controller.abort();
  await new Promise((resolve) => setImmediate(resolve));
  const ownedKills = f.kills.filter(({ call }) => call.kind === 'spawn');
  assert.ok(ownedKills.length > 0);
  assert.equal(settled, false, 'Cancellation must wait for the owned emulator close acknowledgement');
  ownedKills[0].child.emit('close', null, 'SIGKILL');
  const error = await pending;
  assert.ok(error);
  assert.match(error.message, /abort|cancel/i);
  assert.ok(f.kills.every(({ call }) => call.kind === 'spawn'));
  assert.equal(f.calls.some((call) => call.args.includes('emulator-5554') && call.args.includes('kill')), false);
});
