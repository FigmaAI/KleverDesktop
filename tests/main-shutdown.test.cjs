const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-typescript.cjs');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function mainFixture(rotationActive) {
  const callbacks = {};
  const cleanup = deferred();
  const budgets = [];
  const exits = [];
  const timers = [];
  let cleanupCalls = 0;
  load('main/index.ts', {
    'electron-squirrel-startup': false,
    electron: {
      app: { requestSingleInstanceLock: () => true, on: (event, action) => { callbacks[event] = action; },
        whenReady: () => new Promise(() => {}), exit: code => exits.push(code) },
      crashReporter: { start: () => {} },
    },
    './handlers': { registerAllHandlers: () => {}, cleanupAllProcesses: graceMs => { cleanupCalls++; budgets.push(graceMs); return cleanup.promise; } },
    './utils/project-storage': { cleanupZombieTasks: () => {} }, './menu': { createMenu: () => {} },
    './handlers/updater': { initializeUpdater: () => {} },
    './utils/chatgpt-auth': { isChatGPTCredentialRotationActive: () => rotationActive },
  }, { setTimeout: (action, delay) => { const timer = { action, delay, cleared: false }; timers.push(timer); return timer; },
    clearTimeout: timer => { timer.cleared = true; } });
  return { callbacks, cleanup, budgets, exits, timers, cleanupCalls: () => cleanupCalls };
}

for (const rotationActive of [false, true]) {
  test(`app quit grants ${rotationActive ? '90 seconds only for a protected credential rotation' : 'the normal 6 second shutdown bound'}`, async () => {
    const f = mainFixture(rotationActive);
    let prevented = 0;
    f.callbacks['before-quit']({ preventDefault: () => { prevented++; } });
    f.callbacks['before-quit']({ preventDefault: () => { prevented++; } });
    assert.equal(prevented, 2); assert.equal(f.cleanupCalls(), 1);
    assert.deepEqual(f.budgets, [rotationActive ? 90000 : 6000]);
    assert.equal(f.timers[0].delay, rotationActive ? 90000 : 6000);
    assert.deepEqual(f.exits, []);
    f.cleanup.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.exits, [0]); assert.equal(f.timers[0].cleared, true);
  });
}

test('a bounded quit exits once even if the SDK drain completes after its deadline', async () => {
  const f = mainFixture(true);
  f.callbacks['before-quit']({ preventDefault: () => {} });
  f.timers[0].action();
  assert.deepEqual(f.exits, [0]);
  f.cleanup.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.exits, [0]);
});

test('handler cleanup aborts both owners and waits for SDK rotation and terminal run evidence together', async () => {
  const run = deferred(); const auth = deferred(); const calls = [];
  const { cleanupAllProcesses } = load('main/handlers/index.ts', {
    './android': { registerAndroidHandlers: () => {}, cleanupAndroidSetup: () => calls.push('android-abort') },
    './config': {}, './utilities': {}, './project': {}, './dialogs': {}, './github': {}, './schedule': {}, './testcase': {}, './chatgpt': {},
    './task': { cleanupTaskProcesses: timeout => { calls.push(['run-abort', timeout]); return run.promise; } },
    '../utils/chatgpt-auth': { isChatGPTCredentialRotationActive: () => true, cleanupChatGPTAuth: () => { calls.push('auth-abort'); return auth.promise; } },
    '../utils/schedule-queue-manager': { scheduleQueueManager: { shutdown: () => calls.push('schedule-stop') } },
  });
  let settled = false;
  const pending = cleanupAllProcesses().then(() => { settled = true; });
  assert.deepEqual(calls, ['schedule-stop', 'android-abort', ['run-abort', 89750], 'auth-abort']);
  auth.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'SDK commit alone must not skip the owned run recording');
  run.resolve(); await pending;
  assert.equal(settled, true);
});

test('an SDK cleanup error cannot exit before the owned run finishes saving', async () => {
  const run = deferred(); let settled = false;
  const { cleanupAllProcesses } = load('main/handlers/index.ts', {
    './android': { cleanupAndroidSetup: () => {} }, './config': {}, './utilities': {}, './project': {},
    './dialogs': {}, './github': {}, './schedule': {}, './testcase': {}, './chatgpt': {},
    './task': { cleanupTaskProcesses: () => run.promise },
    '../utils/chatgpt-auth': { isChatGPTCredentialRotationActive: () => false,
      cleanupChatGPTAuth: async () => { throw new Error('Synthetic SDK cleanup failure'); } },
    '../utils/schedule-queue-manager': { scheduleQueueManager: { shutdown: () => {} } },
  });
  const rejection = assert.rejects(cleanupAllProcesses().finally(() => { settled = true; }), /Synthetic SDK cleanup failure/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false);
  run.resolve(); await rejection;
  assert.equal(settled, true);
});

function startupFixture() {
  const ready = deferred(); const callbacks = {}; const windows = []; const exits = [];
  let appReady = false; let readyCalls = 0; let registered = 0;
  class Window {
    constructor() {
      assert.equal(appReady, true, 'Electron must be ready before BrowserWindow construction');
      this.destroyed = false; this.handlers = {}; this.webContents = { openDevTools: () => {} };
      windows.push(this);
    }
    static getAllWindows() { return windows.filter(window => !window.destroyed); }
    on(event, action) { this.handlers[event] = action; }
    loadURL() {} loadFile() {} isDestroyed() { return this.destroyed; }
    isMinimized() { return false; } restore() {} show() {} focus() {}
  }
  const app = {
    requestSingleInstanceLock: () => true,
    on: (event, action) => { callbacks[event] = action; },
    whenReady: () => { readyCalls++; return ready.promise; }, isReady: () => appReady,
    getVersion: () => 'synthetic', getAppPath: () => '/synthetic/app', getPath: () => '/synthetic/data',
    isPackaged: false, exit: code => exits.push(code),
  };
  load('main/index.ts', {
    'electron-squirrel-startup': false,
    electron: { app, BrowserWindow: Window, ipcMain: {}, crashReporter: { start: () => {} },
      session: { defaultSession: { webRequest: { onHeadersReceived: () => {} } } } },
    './handlers': { registerAllHandlers: () => { registered++; }, cleanupAllProcesses: async () => {} },
    './utils/project-storage': { cleanupZombieTasks: () => {} }, './menu': { createMenu: () => {} },
    './handlers/updater': { initializeUpdater: () => {} },
    './utils/chatgpt-auth': { isChatGPTCredentialRotationActive: () => false },
  }, { MAIN_WINDOW_VITE_DEV_SERVER_URL: undefined,
    console: { log: () => {}, error: () => {} },
    setTimeout: () => ({}), clearTimeout: () => {} });
  return { callbacks, windows, exits, registered: () => registered, readyCalls: () => readyCalls,
    becomeReady: async () => { appReady = true; ready.resolve(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('activation before Electron readiness queues one window and coalesces duplicate activation requests', async () => {
  const f = startupFixture();
  f.callbacks.activate(); f.callbacks.activate(); f.callbacks.activate();
  assert.equal(f.windows.length, 0);
  assert.equal(f.readyCalls(), 2, 'startup and a single coalesced activation wait for readiness');
  f.callbacks['second-instance']();
  await f.becomeReady();
  assert.equal(f.windows.length, 1, 'startup, activation, and second-instance paths share one owned window');
  assert.equal(f.registered(), 1);
  f.callbacks.activate(); f.callbacks['second-instance']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.windows.length, 1);
});

test('a queued activation cannot reopen a window once shutdown has started', async () => {
  const f = startupFixture();
  f.callbacks.activate();
  f.callbacks['before-quit']({ preventDefault: () => {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(f.exits, [0]);
  await f.becomeReady();
  assert.equal(f.windows.length, 0);
  assert.equal(f.registered(), 0, 'shutdown must not restart handlers or the scheduler after readiness');
});

test('a delayed close event from an old window cannot discard the replacement window owner', async () => {
  const f = startupFixture(); await f.becomeReady();
  const old = f.windows[0];
  old.destroyed = true;
  f.callbacks.activate();
  assert.equal(f.windows.length, 2);
  old.handlers.closed();
  f.callbacks['second-instance']();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.windows.length, 2, 'second-instance should focus the replacement, not create a duplicate');
});
