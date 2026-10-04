import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createChatGPT } from '../dist/index.js';
import { ConnectionStore } from '../dist/storage.js';

const issuer = 'https://auth.openai.com';
const clientId = 'refresh_test_client';
const subject = 'refresh-test-subject';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const attacker = await generateKeyPair('RS256');
const jwks = { keys: [{ ...await exportJWK(publicKey), kid: 'refresh-test-key', use: 'sig', alg: 'RS256' }] };

// Ephemeral authenticated encryption for synthetic test data, never an app provider.
function encryption(key) {
  return {
    id: 'test-refresh-aes-gcm',
    isAvailable: () => true,
    encrypt(plaintext) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    },
    decrypt(ciphertext) {
      const bytes = Buffer.from(ciphertext);
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
    },
  };
}

async function identity(overrides = {}, key = privateKey) {
  return new SignJWT({ iss: issuer, aud: clientId, sub: subject, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600, ...overrides })
    .setProtectedHeader({ alg: 'RS256', kid: 'refresh-test-key' }).sign(key);
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'siwc-refresh-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const key = randomBytes(32);
  const provider = encryption(key);
  const store = new ConnectionStore(directory, provider);
  const config = { appName: 'Refresh Test', appId: 'refresh-test', redirectPort: 0, storageDir: directory, credentialEncryption: provider,
    openBrowser: () => assert.fail('Refresh recovery must not open a browser') };
  const client = createChatGPT(config);
  const state = {
    version: 2, activeProfileId: 'profile-1', pendingRegistrations: [],
    profiles: [{ version: 1, id: 'profile-1', label: 'Test account', clientId, subject, status: 'connected',
      scopes: ['openid', 'offline_access', 'chatgpt.tokens.use.direct'], savedAt: new Date().toISOString(),
      credentials: { accessToken: 'previous-test-access', refreshToken: 'previous-test-refresh', expiresAt: Date.now() + 30_000 } }],
  };
  await store.withLock(() => store.write(state));
  return { directory, key, provider, store, client, state, filename: join(directory, 'chatgpt-auth.json') };
}

const errorCode = (code) => (error) => error?.code === code;
const read = (store) => store.withLock(() => store.read());
const tokenResponse = (idToken) => ({ access_token: 'successor-test-access', refresh_token: 'successor-test-refresh', token_type: 'Bearer', expires_in: 3600,
  ...(idToken === undefined ? {} : { id_token: idToken }) });
const discoveryResponse = () => Response.json({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/oauth/token`, jwks_uri: `${issuer}/jwks`, revocation_endpoint: `${issuer}/revoke` });

function mockProvider(t, { token, keys = () => Response.json(jwks), models, revoke }) {
  const calls = { token: 0, keys: 0, models: 0, revoke: 0 };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === `${issuer}/.well-known/openid-configuration`) return discoveryResponse();
    if (url === `${issuer}/oauth/token`) {
      calls.token++;
      assert.equal(options.body.get('grant_type'), 'refresh_token');
      assert.equal(options.body.get('refresh_token'), 'previous-test-refresh');
      return token();
    }
    if (url === `${issuer}/jwks`) { calls.keys++; return keys(); }
    if (url === 'https://api.openai.com/v1/models') {
      calls.models++;
      assert.equal(options.headers.authorization, 'Bearer successor-test-access');
      if (models) return models();
      return Response.json({ models: [{ slug: 'test-model', display_name: 'Test Model', visibility: 'list' }] });
    }
    if (url === `${issuer}/revoke`) { calls.revoke++; return revoke(options); }
    assert.fail(`Unexpected network request: ${url}`);
  });
  return calls;
}

test('JWKS outages preserve an encrypted rotation and recover in a new process after ID-token expiry', async (t) => {
  const { client, filename, provider, store, directory, key } = await fixture(t);
  const idToken = await identity({ exp: Math.floor(Date.now() / 1000) + 60 });
  let failure = 'network';
  const calls = mockProvider(t, {
    token: () => Response.json(tokenResponse(idToken)),
    keys: async () => {
      // The checkpoint must already be durable before remote verification starts.
      const raw = await readFile(filename, 'utf8');
      const saved = JSON.parse(provider.decrypt(Buffer.from(JSON.parse(raw).ciphertext, 'base64')));
      assert.equal(saved.profiles[0].pendingRefresh.credentials.refreshToken, 'successor-test-refresh');
      assert.equal(saved.profiles[0].credentials.refreshToken, 'previous-test-refresh');
      assert.equal(Number.isSafeInteger(saved.profiles[0].pendingRefresh.receivedAt), true);
      assert.equal(raw.includes('successor-test-refresh'), false);
      if (failure === 'network') throw new TypeError('Synthetic JWKS network outage');
      if (failure === 'http') return new Response('Unavailable', { status: 503 });
      if (failure === 'timeout') throw new DOMException('Synthetic timeout', 'TimeoutError');
      if (failure === 'empty') return Response.json({ keys: [] });
      if (failure === 'missing-kid') return Response.json({ keys: [{ ...jwks.keys[0], kid: 'another-key' }] });
      if (failure === 'malformed-key') return Response.json({ keys: [{ kty: 'RSA', kid: 'refresh-test-key', alg: 'RS256' }] });
      return new Response('{bad jwks', { status: 200 });
    },
  });
  for (failure of ['network', 'http', 'timeout', 'malformed', 'empty', 'missing-kid', 'malformed-key']) {
    await assert.rejects(client.listModels(), (error) => error.code === 'identity_verification_unavailable' && error.retryable);
    const saved = await read(store);
    assert.equal(saved.profiles[0].status, 'connected');
    assert.equal(saved.profiles[0].pendingRefresh.credentials.refreshToken, 'successor-test-refresh');
    const session = await client.getSession();
    assert.equal(session.error.code, 'identity_verification_unavailable');
    assert.equal(JSON.stringify(session).includes('successor-test'), false);
    assert.equal(JSON.stringify(await client.listProfiles()).includes('successor-test'), false);
  }
  assert.deepEqual(calls, { token: 1, keys: 7, models: 0, revoke: 0 });

  // A fresh Node process has no in-memory state or cached JWKS from this process.
  const worker = `
    import assert from 'node:assert/strict';
    import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
    import { createChatGPT } from ${JSON.stringify(new URL('../dist/index.js', import.meta.url).href)};
    const encryption = ${encryption.toString()};
    const provider = encryption(Buffer.from(${JSON.stringify(key.toString('base64'))}, 'base64'));
    // Simulate restarting after the received ID token expired, while the
    // rotated access token still has time remaining. No wall-clock sleep.
    const actualDate = Date;
    const restartedAt = Date.now() + 120_000;
    globalThis.Date = class extends actualDate {
      constructor(...args) { super(...(args.length ? args : [restartedAt])); }
      static now() { return restartedAt; }
    };
    let apiCalls = 0;
    globalThis.fetch = async (url, options) => {
      if (url.endsWith('/.well-known/openid-configuration')) return Response.json(${JSON.stringify({ issuer, authorization_endpoint: `${issuer}/authorize`, token_endpoint: `${issuer}/oauth/token`, jwks_uri: `${issuer}/jwks`, revocation_endpoint: `${issuer}/revoke` })});
      if (url === ${JSON.stringify(`${issuer}/jwks`)}) return Response.json(${JSON.stringify(jwks)});
      if (url === 'https://api.openai.com/v1/models') {
        apiCalls++;
        assert.equal(options.headers.authorization, 'Bearer successor-test-access');
        return Response.json({ models: [] });
      }
      assert.fail('Recovery must not submit a second refresh grant: ' + url);
    };
    const client = createChatGPT({ appName: 'Refresh Test', appId: 'refresh-test', redirectPort: 0, storageDir: ${JSON.stringify(directory)}, credentialEncryption: provider });
    assert.equal((await client.getSession()).error.code, 'identity_verification_unavailable');
    await client.listModels();
    assert.equal(apiCalls, 1);
    assert.equal((await client.getSession()).error, undefined);
    process.stdout.write('recovered');
  `;
  const result = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', worker]);
  assert.equal(result.stdout, 'recovered');
  const recovered = (await read(store)).profiles[0];
  assert.equal(recovered.pendingRefresh, undefined);
  assert.equal(recovered.credentials.refreshToken, 'successor-test-refresh');
  assert.equal(recovered.profileIdToken, idToken);
});

for (const invalid of ['signature', 'issuer', 'audience', 'subject', 'expiry']) {
  test(`a refreshed ID token with invalid ${invalid} clears pending and previous credentials`, async (t) => {
    const { client, store } = await fixture(t);
    const overrides = invalid === 'issuer' ? { iss: 'https://invalid.example' } : invalid === 'audience' ? { aud: 'another-client' }
      : invalid === 'subject' ? { sub: 'another-account' } : invalid === 'expiry' ? { exp: Math.floor(Date.now() / 1000) - 60 } : {};
    const idToken = await identity(overrides, invalid === 'signature' ? attacker.privateKey : privateKey);
    const calls = mockProvider(t, { token: () => Response.json(tokenResponse(idToken)) });
    await assert.rejects(client.listModels(), errorCode(invalid === 'subject' ? 'account_mismatch' : 'invalid_id_token'));
    const profile = (await read(store)).profiles[0];
    assert.equal(profile.status, 'reauth_required');
    assert.equal(profile.credentials, undefined);
    assert.equal(profile.pendingRefresh, undefined);
    assert.equal(profile.profileIdToken, undefined);
    assert.equal(calls.models, 0);
    assert.equal(calls.token, 1);
  });
}

test('refresh without a replacement ID token still persists and uses the rotated credentials', async (t) => {
  const { client, store } = await fixture(t);
  const calls = mockProvider(t, { token: () => Response.json(tokenResponse()) });
  assert.equal((await client.listModels())[0].slug, 'test-model');
  assert.equal((await read(store)).profiles[0].credentials.refreshToken, 'successor-test-refresh');
  assert.equal(calls.models, 1);
  assert.equal(calls.keys, 0);
});

test('disconnect revokes the pending successor and removes every local token', async (t) => {
  const { client, store, state } = await fixture(t);
  state.profiles[0].pendingRefresh = {
    credentials: { accessToken: 'successor-test-access', refreshToken: 'successor-test-refresh', expiresAt: Date.now() + 3600000 },
    scopes: state.profiles[0].scopes, idToken: await identity(), receivedAt: Date.now(),
  };
  await store.withLock(() => store.write(state));
  const calls = mockProvider(t, {
    token: () => assert.fail('Disconnect must not refresh'),
    revoke: (options) => {
      assert.equal(options.body.get('token'), 'successor-test-refresh');
      return new Response(null, { status: 200 });
    },
  });
  await client.disconnect();
  const profile = (await read(store)).profiles[0];
  assert.equal(profile.status, 'disconnected');
  assert.equal(profile.credentials, undefined);
  assert.equal(profile.pendingRefresh, undefined);
  assert.equal(calls.revoke, 1);
  assert.equal(calls.models, 0);
});

for (const name of ['AbortError', 'TimeoutError']) {
  test(`${name} reading the token body is cancellation and does not rewrite stored credentials`, async (t) => {
    const { client, store, filename } = await fixture(t);
    const before = await readFile(filename, 'utf8');
    const calls = mockProvider(t, {
      token: () => new Response(new ReadableStream({ start(controller) { controller.error(new DOMException('Synthetic body abort', name)); } }), { status: 200 }),
    });
    await assert.rejects(client.listModels(), errorCode('cancelled'));
    assert.equal(await readFile(filename, 'utf8'), before);
    assert.equal((await read(store)).profiles[0].credentials.refreshToken, 'previous-test-refresh');
    assert.equal(calls.models, 0);
    assert.equal(calls.keys, 0);
  });
}

test('recovery never sends an expired pending access token and renews using only the verified successor', async (t) => {
  const { client, store, state } = await fixture(t);
  const receivedAt = Date.now() - 120_000;
  state.profiles[0].pendingRefresh = {
    credentials: { accessToken: 'expired-pending-access', refreshToken: 'successor-test-refresh', expiresAt: Date.now() - 30_000 },
    scopes: state.profiles[0].scopes,
    idToken: await identity({ iat: Math.floor(receivedAt / 1000), exp: Math.floor(Date.now() / 1000) - 60 }),
    receivedAt,
  };
  await store.withLock(() => store.write(state));
  let tokenCalls = 0;
  let modelCalls = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === `${issuer}/.well-known/openid-configuration`) return discoveryResponse();
    if (url === `${issuer}/jwks`) return Response.json(jwks);
    if (url === `${issuer}/oauth/token`) {
      tokenCalls++;
      assert.equal(options.body.get('refresh_token'), 'successor-test-refresh');
      return Response.json({ ...tokenResponse(), access_token: 'renewed-test-access', refresh_token: 'renewed-test-refresh' });
    }
    if (url === 'https://api.openai.com/v1/models') {
      modelCalls++;
      assert.equal(options.headers.authorization, 'Bearer renewed-test-access');
      return Response.json({ models: [] });
    }
    assert.fail(`Unexpected network request: ${url}`);
  });
  await assert.rejects(client.listModels(), errorCode('refresh_not_ready'));
  assert.equal(tokenCalls, 0);
  assert.equal(modelCalls, 0);
  const recovered = (await read(store)).profiles[0];
  assert.equal(recovered.pendingRefresh, undefined);
  assert.equal(recovered.credentials.refreshToken, 'successor-test-refresh');
  await client.listModels();
  assert.equal(tokenCalls, 1);
  assert.equal(modelCalls, 1);
  assert.equal((await read(store)).profiles[0].credentials.refreshToken, 'renewed-test-refresh');
});

test('pending rotations reject invalid or future receipt timestamps before persistence', async (t) => {
  const { store, state, filename } = await fixture(t);
  const before = await readFile(filename, 'utf8');
  const pending = { credentials: { accessToken: 'pending-access', refreshToken: 'pending-refresh', expiresAt: Date.now() + 3600000 },
    scopes: state.profiles[0].scopes, idToken: await identity() };
  for (const receivedAt of [undefined, 'yesterday', NaN, -1, Date.now() + 3600000]) {
    state.profiles[0].pendingRefresh = { ...pending, receivedAt };
    await assert.rejects(store.withLock(() => store.write(state)), errorCode('storage_invalid'));
    assert.equal(await readFile(filename, 'utf8'), before);
  }
});
