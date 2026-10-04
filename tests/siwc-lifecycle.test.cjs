/** Offline SIWC state-machine tests. All credentials and authorization results are synthetic. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const lockfile = require('proper-lockfile');
const load = require('./load-typescript.cjs');
const sdk = 'vendor/sign-in-with-chatgpt-devkit/packages/local/src';
const globals = { Error, Uint8Array, structuredClone };
const scopes = ['openid', 'offline_access', 'chatgpt.tokens.use.direct'];
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const newConnection = clientId => ({ version: 1, clientId, status: 'connected', scopes: [...scopes],
  subject: 'synthetic-subject', identity: { email: 'synthetic@example.invalid' }, savedAt: new Date().toISOString(),
  credentials: { accessToken: 'synthetic-new-access', refreshToken: 'synthetic-new-refresh', expiresAt: Date.now() + 3600000 } });

async function fixture(t, { prior = false, onEncrypt, onRelease, refresh, revoke } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'klever-siwc-lifecycle-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const key = crypto.randomBytes(32);
  let client;
  const provider = {
    id: 'synthetic-lifecycle-provider', isAvailable: () => true,
    async encrypt(plaintext) {
      await onEncrypt?.(JSON.parse(plaintext), client);
      const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
    },
    decrypt(buffer) {
      const bytes = Buffer.from(buffer); const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
  const errors = load(`${sdk}/errors.ts`, {}, globals);
  const storage = load(`${sdk}/storage.ts`, {
    './errors.js': errors,
    'proper-lockfile': { ...lockfile, async lock(...args) {
      const release = await lockfile.lock(...args);
      return async () => { await release(); await onRelease?.(client); };
    } },
  }, globals);
  const store = new storage.ConnectionStore(directory, provider);
  const initial = { version: 2, profiles: [], pendingRegistrations: [] };
  if (prior) {
    initial.activeProfileId = 'profile-one';
    initial.profiles.push({ ...newConnection('synthetic_client'), id: 'profile-one', label: 'Existing profile',
      credentials: { accessToken: 'synthetic-old-access', refreshToken: 'synthetic-old-refresh', expiresAt: Date.now() + 30000 } });
  }
  await store.withLock(() => store.write(initial));
  let modelCalls = 0;
  const module = load(`${sdk}/index.ts`, {
    './errors.js': errors, './storage.js': storage,
    './models.js': { listModels: async () => { modelCalls++; return []; } },
    './responses.js': { streamResponse: async () => { throw new Error('No inference belongs in a lifecycle regression'); } },
    './oauth.js': {
      identityVerificationUnavailable: () => new errors.ChatGPTError('identity_verification_unavailable', 'Synthetic unavailable identity'),
      authorize: async (_config, previous, _host, signal, options) => {
        const clientId = previous?.clientId || 'synthetic_client';
        await options.onRegistration(clientId);
        signal.throwIfAborted();
        return newConnection(clientId);
      },
      refreshConnection: refresh || (async previous => previous),
      revokeConnection: revoke || (async () => {}),
    },
  }, globals);
  client = module.createChatGPT({ appName: 'Lifecycle regression', appId: 'lifecycle-regression', redirectPort: 0,
    storageDir: directory, credentialEncryption: provider });
  return { client, store, directory, modelCalls: () => modelCalls, initial, read: () => store.withLock(() => store.read()) };
}

for (const prior of [false, true]) {
  test(`cancel during credential encryption restores ${prior ? 'the previous profile' : 'the pending registration'} before publication`, async t => {
    let cancelled = false;
    const f = await fixture(t, { prior, onEncrypt: async (state, client) => {
      if (client && !cancelled && state.profiles.some(profile => profile.credentials?.accessToken === 'synthetic-new-access')) {
        cancelled = true;
        client.cancelSignIn();
        await new Promise(resolve => setImmediate(resolve));
      }
    } });
    const publications = []; f.client.subscribe(state => publications.push(state));
    await assert.rejects(f.client.signIn(), error => error.code === 'cancelled');
    const state = await f.read();
    assert.equal(JSON.stringify(state).includes('synthetic-new-access'), false);
    assert.equal(JSON.stringify(state).includes('synthetic-new-refresh'), false);
    if (prior) {
      assert.equal(state.activeProfileId, 'profile-one');
      assert.equal(state.profiles[0].credentials.accessToken, 'synthetic-old-access');
      assert.equal((await f.client.getSession()).status, 'connected');
    } else {
      assert.equal(state.profiles.length, 0);
      assert.equal(state.pendingRegistrations.length, 1);
      assert.equal(state.pendingRegistrations[0].clientId, 'synthetic_client');
      assert.equal((await f.client.getSession()).status, 'disconnected');
      assert.equal(publications.some(state => state.status === 'connected'), false);
    }
  });
}

test('cancel during lock release occurs after the committed sign-in was already published', async t => {
  let committed = false; let tested = false; const publications = [];
  const f = await fixture(t, {
    onEncrypt: state => { if (state.profiles.some(profile => profile.credentials?.accessToken === 'synthetic-new-access')) committed = true; },
    onRelease: client => {
      if (!client || !committed || tested) return;
      tested = true;
      assert.equal(publications.at(-1).status, 'connected');
      client.cancelSignIn();
    },
  });
  f.client.subscribe(state => publications.push(state));
  assert.equal((await f.client.signIn()).status, 'connected');
  assert.equal(tested, true);
  assert.equal((await f.client.getSession()).status, 'connected');
  assert.equal((await f.read()).profiles[0].credentials.accessToken, 'synthetic-new-access');
});

test('disconnect waits for the rotated credentials then removes them without sending a late API request', async t => {
  const entered = deferred(); const rotationReady = deferred(); let revoked;
  const f = await fixture(t, { prior: true,
    refresh: async (previous, _signal, persistRotation) => {
      entered.resolve(); await rotationReady.promise;
      const credentials = { accessToken: 'synthetic-successor-access', refreshToken: 'synthetic-successor-refresh', expiresAt: Date.now() + 3600000 };
      await persistRotation({ credentials, scopes: [...scopes], idToken: 'synthetic-id-token', receivedAt: Date.now() });
      return { ...previous, credentials, savedAt: new Date().toISOString() };
    },
    revoke: async profile => { revoked = profile.credentials.refreshToken; },
  });
  const request = f.client.listModels();
  const rejection = assert.rejects(request, error => error.code === 'cancelled');
  await entered.promise;
  const logout = f.client.disconnect();
  rotationReady.resolve();
  await logout; await rejection;
  assert.equal(revoked, 'synthetic-successor-refresh');
  assert.equal(f.modelCalls(), 0);
  const state = await f.read();
  assert.equal(state.profiles[0].status, 'disconnected');
  assert.equal(state.profiles[0].credentials, undefined);
  assert.equal(state.profiles[0].pendingRefresh, undefined);
  assert.equal((await f.client.getSession()).sharing, false);
});

function localGet(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => { response.resume(); response.once('end', () => resolve(response.statusCode)); });
    request.once('error', reject);
  });
}

function callbackSDK(fakeFetch, identity) {
  const runtime = { ...globals, fetch: fakeFetch };
  const errors = load(`${sdk}/errors.ts`, {}, runtime);
  return load(`${sdk}/oauth.ts`, {
    './errors.js': errors,
    jose: {
      createRemoteJWKSet: () => { if (!identity) throw new Error('Identity verification must not run'); return async () => ({}); },
      jwtVerify: async () => { if (!identity) throw new Error('Identity verification must not run'); return { payload: identity() }; },
      customFetch: Symbol('synthetic-fetch'),
    },
  }, runtime);
}
const discovery = () => Response.json({ issuer: 'https://auth.openai.com',
  authorization_endpoint: 'https://auth.openai.com/authorize', token_endpoint: 'https://auth.openai.com/token', jwks_uri: 'https://auth.openai.com/jwks' });
async function promptly(promise) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('The SDK waited for the unresolved browser opener')), 1000);
    })]);
  } finally { clearTimeout(timer); }
}

test('cancelling an official authorization closes its loopback listener without exchanging a code', async () => {
  const opened = deferred(); let authorization; let tokenRequests = 0;
  const oauth = callbackSDK(async url => {
    if (String(url).endsWith('/.well-known/openid-configuration')) return discovery();
    tokenRequests++; throw new Error('No remote request belongs in the cancelled callback test');
  });
  const controller = new AbortController();
  const pending = oauth.authorize({ appName: 'Loopback regression', appId: 'loopback-regression', redirectPort: 0,
    openBrowser: async url => { authorization = new URL(url); opened.resolve(); } }, undefined, 'synthetic-host', controller.signal);
  const rejection = assert.rejects(pending, error => error.code === 'cancelled');
  await opened.promise;
  const callback = new URL(authorization.searchParams.get('redirect_uri'));
  callback.searchParams.set('state', 'unrelated-state'); callback.searchParams.set('code', 'synthetic-code');
  assert.equal(await localGet(callback), 400);
  controller.abort(); await rejection;
  await assert.rejects(localGet(callback), error => error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET');
  assert.equal(tokenRequests, 0);
});

test('cancellation does not wait for an unresolved OS browser opener', async () => {
  const opened = deferred(); const browser = deferred(); let authorization; let tokenRequests = 0;
  const oauth = callbackSDK(async url => {
    if (String(url).endsWith('/.well-known/openid-configuration')) return discovery();
    tokenRequests++; throw new Error('No code exchange belongs in a cancelled opener test');
  });
  const controller = new AbortController();
  const pending = oauth.authorize({ appName: 'Blocked opener regression', appId: 'blocked-opener', redirectPort: 0,
    openBrowser: url => { authorization = new URL(url); opened.resolve(); return browser.promise; } }, undefined, 'synthetic-host', controller.signal);
  const rejection = assert.rejects(pending, error => error.code === 'cancelled');
  try {
    await opened.promise;
    controller.abort();
    await promptly(rejection);
    await assert.rejects(localGet(authorization.searchParams.get('redirect_uri')), error => error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET');
    assert.equal(tokenRequests, 0);
  } finally { browser.resolve(); }
});

test('a validated loopback callback completes while the OS browser opener remains unresolved', async () => {
  const opened = deferred(); const browser = deferred(); let authorization; let tokenRequests = 0;
  const oauth = callbackSDK(async (url, options) => {
    if (String(url).endsWith('/.well-known/openid-configuration')) return discovery();
    assert.equal(String(url), 'https://auth.openai.com/token'); tokenRequests++;
    assert.equal(options.body.get('code'), 'synthetic-code');
    return Response.json({ id_token: 'synthetic-id-token', access_token: 'synthetic-callback-access', refresh_token: 'synthetic-callback-refresh',
      scope: scopes.join(' '), token_type: 'Bearer', expires_in: 3600 });
  }, () => ({ sub: 'synthetic-subject', nonce: authorization.searchParams.get('nonce') }));
  const controller = new AbortController();
  const pending = oauth.authorize({ appName: 'Completed callback regression', appId: 'completed-callback', redirectPort: 0,
    openBrowser: url => { authorization = new URL(url); opened.resolve(); return browser.promise; } }, undefined, 'synthetic-host', controller.signal);
  try {
    await opened.promise;
    const callback = new URL(authorization.searchParams.get('redirect_uri'));
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('code', 'synthetic-code'); callback.searchParams.set('client_id', 'synthetic_callback_client');
    assert.equal(await localGet(callback), 200);
    const result = await promptly(pending);
    assert.equal(result.status, 'connected'); assert.equal(result.clientId, 'synthetic_callback_client');
    assert.equal(tokenRequests, 1);
  } finally { controller.abort(); browser.resolve(); }
});

test('protected rotation drains before local sign-out, while delayed remote revocation cannot retain credentials', async t => {
  const entered = deferred(); const rotation = deferred(); const remoteEntered = deferred(); const remote = deferred();
  const f = await fixture(t, { prior: true,
    refresh: async (previous, _signal, persistRotation) => {
      entered.resolve(); await rotation.promise;
      const credentials = { accessToken: 'synthetic-successor-access', refreshToken: 'synthetic-successor-refresh', expiresAt: Date.now() + 3600000 };
      await persistRotation({ credentials, scopes: [...scopes], idToken: 'synthetic-id-token', receivedAt: Date.now() });
      return { ...previous, credentials, savedAt: new Date().toISOString() };
    },
    revoke: async profile => { remoteEntered.resolve(profile); await remote.promise; },
  });
  assert.equal(f.client.isCredentialRotationPending(), false);
  const request = f.client.listModels();
  const requestCancelled = assert.rejects(request, error => error.code === 'cancelled');
  await entered.promise;
  assert.equal(f.client.isCredentialRotationPending(), true);
  let drained = false; let logoutCompleted = false;
  const drain = f.client.waitForCredentialTransactions().then(() => { drained = true; });
  const logout = f.client.disconnect().then(() => { logoutCompleted = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(drained, false); assert.equal(logoutCompleted, false);
  rotation.resolve();
  const revoked = await remoteEntered.promise;
  assert.equal(revoked.credentials.refreshToken, 'synthetic-successor-refresh');
  await drain; await requestCancelled;
  assert.equal(f.client.isCredentialRotationPending(), false);
  assert.equal(f.modelCalls(), 0);
  // The remote request is deliberately still pending. Local sign-out is already durable.
  const saved = await f.read();
  assert.equal(saved.profiles[0].status, 'disconnected');
  assert.equal(saved.profiles[0].credentials, undefined);
  assert.equal(saved.profiles[0].pendingRefresh, undefined);
  assert.equal((await f.client.getSession()).sharing, false);
  assert.equal(logoutCompleted, false);
  remote.resolve(); await logout;
  assert.equal((await f.client.getSession()).status, 'disconnected');
});
