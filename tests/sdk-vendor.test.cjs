const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const sdkModule = import(pathToFileURL(path.resolve(__dirname,
  '../vendor/sign-in-with-chatgpt-devkit/packages/local/dist/index.js')).href);
const originalFetch = globalThis.fetch;
let remoteRequests = 0;
test.before(() => {
  globalThis.fetch = async () => {
    remoteRequests += 1;
    throw new Error('Network is disabled for the vendor extension regression.');
  };
});
test.after(() => {
  globalThis.fetch = originalFetch;
  assert.equal(remoteRequests, 0, 'The regression must remain entirely offline.');
});

async function fixture(t, options = {}) {
  const sdk = await sdkModule;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'klever-sdk-vendor-'));
  const key = crypto.randomBytes(32);
  const encryption = {
    id: 'regression-ephemeral-aes',
    isAvailable: () => true,
    encrypt(plaintext) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
    },
    decrypt(ciphertext) {
      const data = Buffer.from(ciphertext);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
      decipher.setAuthTag(data.subarray(12, 28));
      return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
  const store = new sdk.ConnectionStore(directory, encryption);
  const profile = id => ({
    version: 1,
    id,
    label: id,
    clientId: `oaiapp_${id}`,
    status: 'connected',
    scopes: options.noSharing ? ['openid'] : ['openid', 'chatgpt.tokens.use.direct'],
    subject: `subject-${id}`,
    identity: { email: `${id}@example.test` },
    savedAt: new Date().toISOString(),
    credentials: { accessToken: `synthetic-access-${id}`, expiresAt: Date.now() + 3_600_000 },
  });
  await store.withLock(() => store.write({
    version: 2,
    activeProfileId: 'first',
    profiles: [profile('first'), profile('second')],
    pendingRegistrations: [],
  }));
  const client = sdk.createChatGPT({
    appName: 'KleverDesktop offline regression',
    appId: 'klever-sdk-vendor-test',
    redirectPort: 0,
    storageDir: directory,
    credentialEncryption: encryption,
    openBrowser: () => { throw new Error('Browser access is disabled in this regression.'); },
  });
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return { sdk, client, directory };
}

test('trusted callback uses the selected account and publishes only safe session data', async t => {
  const { client, directory } = await fixture(t);
  const sessions = [];
  const unsubscribe = client.subscribe(session => sessions.push(session));
  t.after(unsubscribe);
  const result = await client.withAccessToken(async (token, signal) => {
    assert.equal(token, 'synthetic-access-first');
    assert.equal(signal.aborted, false);
    return { value: 'completed' };
  });
  assert.deepEqual(result, { value: 'completed' });
  assert.equal((await client.getSession()).identity.email, 'first@example.test');
  assert.equal(JSON.stringify(sessions).includes('synthetic-access'), false);
  assert.equal(JSON.stringify(await client.listProfiles()).includes('synthetic-access'), false);
  assert.equal((await fs.readFile(path.join(directory, 'chatgpt-auth.json'), 'utf8'))
    .includes('synthetic-access'), false);
});

test('an already cancelled caller cannot enter the credential callback', async t => {
  const { client } = await fixture(t);
  const controller = new AbortController();
  controller.abort();
  let invoked = false;
  await assert.rejects(client.withAccessToken(async () => {
    invoked = true;
  }, { signal: controller.signal }), error => error.code === 'cancelled');
  assert.equal(invoked, false);
});

test('caller cancellation reaches the callback and rejects a late successful result', async t => {
  const { client } = await fixture(t);
  const controller = new AbortController();
  let release;
  const released = new Promise(resolve => { release = resolve; });
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const request = client.withAccessToken(async (_token, signal) => {
    entered(signal);
    await released;
    return 'late result';
  }, { signal: controller.signal });
  const signal = await ready;
  controller.abort();
  assert.equal(signal.aborted, true);
  release();
  await assert.rejects(request, error => error.code === 'cancelled');
});

test('changing the selected account aborts old work and the next callback uses the new token', async t => {
  const { client } = await fixture(t);
  let release;
  const released = new Promise(resolve => { release = resolve; });
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  const request = client.withAccessToken(async (token, signal) => {
    assert.equal(token, 'synthetic-access-first');
    entered(signal);
    await released;
    return 'old account result';
  });
  const signal = await ready;
  await client.selectProfile('second');
  assert.equal(signal.aborted, true);
  release();
  await assert.rejects(request, error => error.code === 'cancelled');
  assert.equal(await client.withAccessToken(async token => {
    assert.equal(token, 'synthetic-access-second');
    return 'new account result';
  }), 'new account result');
});

test('token sharing permission is required before invoking the extension', async t => {
  const { client } = await fixture(t, { noSharing: true });
  let invoked = false;
  await assert.rejects(client.withAccessToken(async () => {
    invoked = true;
  }), error => error.code === 'sharing_not_enabled');
  assert.equal(invoked, false);
});

test('official callback errors retain recovery metadata without revoking the account', async t => {
  const { sdk, client } = await fixture(t);
  const expected = new sdk.ChatGPTError('subscription_sharing_usage_limit_exceeded',
    'The sharing limit has been reached.', false, 429);
  await assert.rejects(client.withAccessToken(async () => { throw expected; }),
    error => error === expected);
  const session = await client.getSession();
  assert.equal(session.status, 'connected');
  assert.equal(session.error.code, expected.code);
  assert.equal(session.error.status, 429);
});
