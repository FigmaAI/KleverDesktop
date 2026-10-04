const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const load = require('./load-typescript.cjs');
let sdkModule;
test.before(async () => { sdkModule = await import('@siwc/local'); });
const HOST = 'urn:uuid:01234567-89ab-4cde-8123-0123456789ab';
const scopes = ['openid', 'profile', 'email', 'offline_access', 'resource.invoke', 'chatgpt.tokens.use.direct'];
const encode = text => Buffer.from(Buffer.from(text).toString('base64'));
const decode = value => Buffer.from(Buffer.from(value).toString(), 'base64').toString();

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-sdk-auth-'));
  const storage = path.join(directory, 'chatgpt');
  fs.mkdirSync(storage, { recursive: true, mode: 0o700 });
  const state = { authorization: undefined, tokens: [], network: [], signals: [] };
  const previousFetch = global.fetch;
  global.fetch = async (url, init = {}) => {
    if (String(url).startsWith('http://127.0.0.1:')) return previousFetch(url, init);
    state.network.push(String(url));
    if (String(url).endsWith('/.well-known/openid-configuration')) return Response.json({ issuer: 'https://auth.openai.com', authorization_endpoint: 'https://auth.openai.com/api/accounts/authorize', token_endpoint: 'https://auth.openai.com/api/accounts/oauth/token', jwks_uri: 'https://auth.openai.com/.well-known/jwks.json', revocation_endpoint: 'https://auth.openai.com/oauth/revoke' });
    if (String(url).endsWith('/oauth/revoke')) return new Response(null, { status: 200 });
    throw new Error('An offline SDK auth test attempted an unexpected network request.');
  };
  const module = load('main/utils/chatgpt-auth.ts', {
    '@siwc/local': sdkModule,
    electron: {
      app: { whenReady: async () => undefined, isReady: () => true, getPath: () => directory },
      safeStorage: { isEncryptionAvailable: () => options.secureStorage !== false,
        getSelectedStorageBackend: () => 'gnome_libsecret', encryptString: encode, decryptString: decode },
      shell: { openExternal: async url => { state.authorization = new URL(url); } },
    },
    './chatgpt-inference': {
      ChatGPTRequestError: class extends Error {},
      inferStructuredAndroidStep: async (request, token) => {
        state.tokens.push(token); state.signals.push(request.signal);
        if (options.pendingInference) await new Promise((_resolve, reject) => request.signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
        return { step: { observation: 'Offline goal visible.', intent: 'Finish.', assessment: 'passed', reason: 'Offline fixture.',
          action: { type: 'finish', x: null, y: null, endX: null, endY: null, durationMs: null, text: null } },
          usage: { input_tokens: 12, output_tokens: 8, total_tokens: 20 }, model: 'gpt-6-luna' };
      },
    },
  }, { structuredClone });
  const encryption = { id: 'electron-safe-storage-v1', isAvailable: () => options.secureStorage !== false, encrypt: encode, decrypt: decode };
  const store = new sdkModule.ConnectionStore(storage, encryption);
  const legacy = (values = {}) => {
    const tokens = { accessToken: 'offline-access', refreshToken: 'offline-refresh', idToken: 'offline-id', expiresAt: Date.now() + 3600000 };
    const record = { version: 1, hostId: HOST, account: { clientId: 'oaiapp_offline', issuer: 'https://auth.openai.com', subject: 'offline-subject',
      email: 'person@example.test', scopes, encryptedTokens: encode(JSON.stringify(tokens)).toString('base64') }, ...values };
    fs.writeFileSync(path.join(storage, 'account.json'), JSON.stringify(record), { mode: 0o600 });
    return record;
  };
  t.after(async () => { await module.cleanupChatGPTAuth(); global.fetch = previousFetch; fs.rmSync(directory, { recursive: true, force: true }); });
  return { directory, storage, state, module, store, legacy };
}

async function waitFor(predicate) {
  for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
  throw new Error('Offline SDK operation did not reach the expected state');
}

test('official SDK migration preserves registration, host, identity and encrypted credentials once', async t => {
  const f = fixture(t); f.legacy();
  const old = fs.readFileSync(path.join(f.storage, 'account.json'));
  const status = await f.module.getChatGPTStatus();
  assert.equal(status.authenticated, true);
  assert.equal(status.email, 'person@example.test');
  assert.equal(status.sdkSession.status, 'connected');
  assert.equal(status.sdkSession.sharing, true);
  assert.equal(fs.existsSync(path.join(f.storage, 'account.json')), false);
  assert.deepEqual(fs.readFileSync(path.join(f.storage, 'account.json.migrated')), old);
  const raw = fs.readFileSync(path.join(f.storage, 'chatgpt-auth.json'), 'utf8');
  assert.equal(JSON.parse(raw).version, 3);
  assert.equal(raw.includes('offline-access'), false);
  assert.equal(JSON.stringify(status).includes('offline-refresh'), false);
  const canonical = await f.store.withLock(async () => ({ saved: await f.store.read(), host: await f.store.getHostId() }));
  assert.equal(canonical.host, HOST);
  assert.equal(canonical.saved.profiles[0].clientId, 'oaiapp_offline');
  assert.equal(canonical.saved.profiles[0].subject, 'offline-subject');
  assert.equal(canonical.saved.profiles[0].profileIdToken, 'offline-id');
  assert.equal(canonical.saved.profiles[0].credentials.accessToken, 'offline-access');
  const bytes = fs.readFileSync(path.join(f.storage, 'chatgpt-auth.json'));
  await f.module.getChatGPTStatus();
  assert.deepEqual(fs.readFileSync(path.join(f.storage, 'chatgpt-auth.json')), bytes);
  assert.deepEqual(f.state.network, []);
});

test('migration does not overwrite an existing SDK disconnected profile or revive an old login', async t => {
  const f = fixture(t); f.legacy();
  await f.store.withLock(() => f.store.write({ version: 2, activeProfileId: 'profile-offline', pendingRegistrations: [], profiles: [
    { version: 1, id: 'profile-offline', label: 'Connection 1', clientId: 'oaiapp_current', subject: 'current-subject', status: 'disconnected', scopes: [], savedAt: new Date().toISOString() },
  ] }));
  assert.equal((await f.module.getChatGPTStatus()).authenticated, false);
  const saved = await f.store.withLock(() => f.store.read());
  assert.equal(saved.profiles[0].clientId, 'oaiapp_current');
  assert.equal(saved.profiles[0].credentials, undefined);
});

test('a damaged legacy record is retained and never replaced by an empty SDK profile', async t => {
  const f = fixture(t); f.legacy({ hostId: 'invalid-host' });
  const bytes = fs.readFileSync(path.join(f.storage, 'account.json'));
  const status = await f.module.getChatGPTStatus();
  assert.equal(status.authenticated, false);
  assert.equal(status.sdkSession.status, 'reauth_required');
  assert.deepEqual(fs.readFileSync(path.join(f.storage, 'account.json')), bytes);
  assert.equal(fs.existsSync(path.join(f.storage, 'chatgpt-auth.json')), false);
});

test('identity-only connection remains signed in but cannot use ChatGPT plan inference', async t => {
  const f = fixture(t); const record = f.legacy();
  record.account.scopes = ['openid', 'profile', 'email'];
  f.legacy(record);
  const status = await f.module.getChatGPTStatus();
  assert.equal(status.authenticated, false);
  assert.equal(status.sdkSession.status, 'connected');
  assert.equal(status.sdkSession.sharing, false);
  await assert.rejects(f.module.inferAndroidStep({ prompt: 'Test.', images: [] }), /sharing is disabled/);
  assert.deepEqual(f.state.tokens, []);
});

test('official withAccessToken invokes the SDK transport only in the main process', async t => {
  const f = fixture(t); f.legacy();
  const result = await f.module.inferAndroidStep({ prompt: 'Verify.', images: [] });
  assert.equal(result.step.assessment, 'passed');
  assert.equal(result.usage.total_tokens, 20);
  assert.equal(result.response, undefined);
  assert.deepEqual(f.state.tokens, ['offline-access']);
  assert.equal(JSON.stringify(await f.module.getChatGPTStatus()).includes('offline-access'), false);
});

test('official SDK logout revokes and clears credentials while retaining registration and host', async t => {
  const f = fixture(t); f.legacy(); await f.module.getChatGPTStatus();
  const result = await f.module.logoutChatGPT();
  assert.equal(result.authenticated, false);
  const saved = await f.store.withLock(async () => ({ profile: (await f.store.read()).profiles[0], host: await f.store.getHostId() }));
  assert.equal(saved.profile.clientId, 'oaiapp_offline');
  assert.equal(saved.profile.subject, 'offline-subject');
  assert.equal(saved.profile.credentials, undefined);
  assert.equal(saved.host, HOST);
  const recovery = JSON.parse(fs.readFileSync(path.join(f.storage, 'account.json.migrated'), 'utf8'));
  assert.equal(recovery.account.encryptedTokens, undefined);
  assert.equal(recovery.account.clientId, 'oaiapp_offline');
  assert.ok(f.state.network.some(url => url.endsWith('/oauth/revoke')));
  assert.equal((await f.module.getChatGPTStatus()).authenticated, false);
});

test('disconnect aborts the provided SDK request signal and cannot return a late native action', async t => {
  const f = fixture(t, { pendingInference: true }); f.legacy();
  const result = f.module.inferAndroidStep({ prompt: 'Verify.', images: [] });
  const rejected = assert.rejects(result, /cancelled/);
  await waitFor(() => f.state.signals.length === 1);
  await f.module.logoutChatGPT(); await rejected;
  assert.equal(f.state.signals[0].aborted, true);
  assert.equal((await f.module.getChatGPTStatus()).authenticated, false);
});

test('app cleanup aborts inference without signing out the saved SDK connection', async t => {
  const f = fixture(t, { pendingInference: true }); f.legacy();
  const result = f.module.inferAndroidStep({ prompt: 'Verify.', images: [] });
  const rejected = assert.rejects(result, /cancelled/);
  await waitFor(() => f.state.signals.length === 1);
  await f.module.cleanupChatGPTAuth(); await rejected;
  assert.equal((await f.module.getChatGPTStatus()).authenticated, true);
});

test('reconsent is explicit and official SDK cancellation closes its loopback listener', async t => {
  const f = fixture(t); f.legacy(); await f.module.getChatGPTStatus();
  assert.equal((await f.module.startChatGPTLogin({ reconsent: true })).loginPending, true);
  await waitFor(() => !!f.state.authorization);
  assert.equal(f.state.authorization.searchParams.get('client_id'), 'oaiapp_offline');
  assert.equal(f.state.authorization.searchParams.get('ext_agent_host_id'), HOST);
  assert.equal(f.state.authorization.searchParams.get('prompt'), 'consent');
  const callback = new URL(f.state.authorization.searchParams.get('redirect_uri'));
  assert.equal(callback.hostname, '127.0.0.1');
  const cancelled = await f.module.cancelChatGPTLogin();
  assert.equal(cancelled.loginPending, false);
  assert.equal(cancelled.authenticated, true, 'Reauthorization cancellation preserves the prior connection.');
  await assert.rejects(fetch(callback));
  assert.equal(f.state.network.some(url => url.endsWith('/oauth/token')), false);
});

test('unavailable OS encryption preserves legacy credentials and exposes only safe SDK status', async t => {
  const f = fixture(t, { secureStorage: false }); f.legacy();
  const before = fs.readFileSync(path.join(f.storage, 'account.json'));
  const status = await f.module.getChatGPTStatus();
  assert.equal(status.authenticated, false);
  assert.match(status.error, /Secure credential storage/);
  assert.deepEqual(fs.readFileSync(path.join(f.storage, 'account.json')), before);
  assert.equal(JSON.stringify(status).includes('offline-access'), false);
});


test('caller cancellation keeps the healthy SDK account free of a cancellation banner', async t => {
  const f = fixture(t, { pendingInference: true }); f.legacy();
  const controller = new AbortController();
  const result = f.module.inferAndroidStep({ prompt: 'Verify.', images: [], signal: controller.signal });
  const rejected = assert.rejects(result, /cancelled/);
  await waitFor(() => f.state.signals.length === 1);
  controller.abort(); await rejected;
  const status = await f.module.getChatGPTStatus();
  assert.equal(status.authenticated, true);
  assert.equal(status.sdkSession.error, undefined);
});

test('shutdown refuses new login/inference operations while status remains readable', async t => {
  const f = fixture(t); f.legacy(); await f.module.getChatGPTStatus();
  await f.module.cleanupChatGPTAuth();
  await assert.rejects(f.module.startChatGPTLogin(), /shutting down/);
  await assert.rejects(f.module.inferAndroidStep({ prompt: 'Verify.', images: [] }), /shutting down/);
  assert.equal((await f.module.getChatGPTStatus()).authenticated, true);
  assert.deepEqual(f.state.network, []);
});
