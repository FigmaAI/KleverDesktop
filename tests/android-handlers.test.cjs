const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');

function fixture(driver = {}) {
  const handlers = {};
  const opened = [];
  const calls = [];
  const window = { isDestroyed: () => false };
  const module = load('main/handlers/android.ts', {
    electron: {
      shell: { openExternal: async url => opened.push(url) },
      dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: ['/tmp/test.apk'] }) },
    },
    '../utils/config-storage': { loadAppConfig: () => ({ android: { sdkPath: '/configured/sdk' } }) },
    '../utils/android-driver': {
      getAndroidStatus: async options => { calls.push({ method: 'status', options }); return { adbAvailable: true, adbPath: '/configured/sdk/platform-tools/adb', devices: [], emulators: [] }; },
      listAndroidDevices: async options => { calls.push({ method: 'devices', options }); return [{ serial: 'emulator-5580', state: 'device', model: 'Pixel Tablet' }, { serial: 'locked', state: 'unauthorized' }]; },
      listAndroidEmulators: async options => { calls.push({ method: 'emulators', options }); return ['Pixel_Tablet']; },
      startAndroidEmulator: async options => { calls.push({ method: 'start', options }); return { serial: 'emulator-5580', owned: true }; },
      ...driver,
    },
  }, { Error });
  module.registerAndroidHandlers({ handle: (channel, action) => { handlers[channel] = action; } }, () => window);
  return { handlers, opened, calls, module };
}

test('native Android status, device, and emulator APIs expose the agreed flat renderer contract', async () => {
  const f = fixture();
  const status = await f.handlers['android:status']();
  assert.equal(status.success, true); assert.equal(status.ready, true); assert.equal(status.sdkPath, '/configured/sdk');
  assert.equal(status.adbPath, '/configured/sdk/platform-tools/adb');
  const devices = await f.handlers['android:devices']();
  assert.equal(devices.success, true); assert.equal(devices.devices[0].id, 'emulator-5580');
  assert.equal(devices.devices[0].model, 'Pixel Tablet'); assert.equal(devices.devices[1].state, 'unauthorized');
  assert.deepEqual(JSON.parse(JSON.stringify(await f.handlers['android:emulators']())), { success: true, names: ['Pixel_Tablet'] });
  assert.ok(f.calls.every(call => call.options.sdkPath === '/configured/sdk'));
  assert.equal(f.handlers['env:check'], undefined); assert.equal(f.handlers['python:download'], undefined);
});

test('SDK setup opens the official manual guide without claiming tools were installed', async () => {
  const f = fixture();
  const result = await f.handlers['android:installTools']();
  assert.equal(result.success, true); assert.equal(result.needsManualInstall, true);
  assert.deepEqual(f.opened, ['https://developer.android.com/studio']);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.handlers['apk:selectFile']()).path, '/tmp/test.apk');
});

test('emulator startup validates the requested AVD and shutdown aborts only an owned setup operation', async () => {
  let signal;
  const f = fixture({ startAndroidEmulator: options => new Promise((_resolve, reject) => {
    signal = options.signal;
    options.signal.addEventListener('abort', () => reject(new Error('Emulator startup cancelled')));
  }) });
  assert.equal((await f.handlers['android:start-emulator'](null, '../unsafe')).success, false);
  assert.equal(signal, undefined);
  const pending = f.handlers['android:start-emulator'](null, 'Pixel_Tablet');
  assert.equal(signal.aborted, false);
  f.module.cleanupAndroidSetup();
  assert.equal(signal.aborted, true);
  const result = await pending;
  assert.equal(result.success, false); assert.match(result.error, /cancelled/);
});
