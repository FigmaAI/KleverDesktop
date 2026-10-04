import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createChatGPT } from '../dist/index.js';
import { ConnectionStore } from '../dist/storage.js';

// Ephemeral, authenticated test encryption. This is not an application provider.
function encryption(overrides = {}) {
  const key = randomBytes(32);
  return {
    id: 'test-aes-gcm',
    isAvailable: () => true,
    encrypt(plaintext) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]);
    },
    decrypt(ciphertext) {
      const bytes = Buffer.from(ciphertext);
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    },
    ...overrides,
  };
}

function savedState() {
  return {
    version: 2,
    activeProfileId: 'profile-1',
    profiles: [{
      version: 1, id: 'profile-1', label: 'Private profile label', clientId: 'registered_test_client',
      status: 'connected', scopes: ['openid', 'chatgpt.tokens.use.direct'], savedAt: '2026-09-28T00:00:00.000Z',
      subject: 'private-subject', identity: { name: 'Test Person', email: 'private@example.invalid' },
      profileIdToken: 'private-id-token',
      credentials: { accessToken: 'private-access-token', refreshToken: 'private-refresh-token', expiresAt: Date.now() + 3600000 },
    }],
    pendingRegistrations: [],
  };
}

async function fixture(t, provider = encryption()) {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Network disabled for credential storage tests'); });
  const directory = await mkdtemp(join(tmpdir(), 'siwc-storage-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'chatgpt-auth.json');
  const store = new ConnectionStore(directory, provider);
  const client = createChatGPT({
    appName: 'Storage Test', appId: 'storage-test', redirectPort: 0,
    storageDir: directory, credentialEncryption: provider,
    openBrowser: () => { assert.fail('Storage failure must not open the browser'); },
  });
  return { directory, filename, store, client, provider };
}

const errorCode = (code) => (error) => error?.code === code;
const read = (store) => store.withLock(() => store.read());
const write = (store, value) => store.withLock(() => store.write(value));

test('credentials and identity are encrypted; permissions and host identity remain correct', async (t) => {
  const { directory, filename, store } = await fixture(t);
  const expected = savedState();
  await write(store, expected);
  const raw = await readFile(filename, 'utf8');
  for (const secret of ['private-access-token', 'private-refresh-token', 'private-id-token', 'private@example.invalid', 'private-subject', 'registered_test_client']) {
    assert.equal(raw.includes(secret), false);
  }
  const envelope = JSON.parse(raw);
  assert.deepEqual(Object.keys(envelope).sort(), ['ciphertext', 'provider', 'version']);
  assert.equal(envelope.version, 3);
  assert.equal(envelope.provider, 'test-aes-gcm');
  assert.deepEqual(await read(store), expected);
  const hostId = await store.withLock(() => store.getHostId());
  assert.equal(await store.withLock(() => store.getHostId()), hostId);
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'chatgpt-host.json'), 'utf8')), { version: 1, id: hostId });
  if (process.platform !== 'win32') {
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
  }
});

for (const version of [1, 2]) {
  test(`plaintext v${version} migrates in place without plaintext backup or temporary files`, async (t) => {
    const { directory, filename, store } = await fixture(t);
    const state = savedState();
    const legacy = version === 2 ? state : (({ id, label, ...record }) => record)(state.profiles[0]);
    await writeFile(filename, JSON.stringify(legacy), { mode: 0o600 });
    const migrated = await read(store);
    assert.equal(JSON.parse(await readFile(filename, 'utf8')).version, 3);
    assert.equal(migrated.profiles[0].credentials.refreshToken, 'private-refresh-token');
    if (version === 1) assert.equal(migrated.profiles[0].requiresNewRegistration, true);
    else assert.deepEqual(migrated, state);
    assert.deepEqual(await read(store), migrated);
    assert.deepEqual(await readdir(directory), ['chatgpt-auth.json']);
  });
}

test('SDK requires a valid encryption provider at construction', () => {
  const config = { appName: 'Storage Test', appId: 'storage-test', redirectPort: 0 };
  for (const provider of [undefined, {}, { ...encryption(), id: '../bad' }, { ...encryption(), encrypt: undefined }]) {
    assert.throws(() => createChatGPT({ ...config, credentialEncryption: provider }), errorCode('invalid_config'));
  }
});

test('unavailable encryption stops fresh sign-in before OAuth or files are written', async (t) => {
  const { directory, store, client } = await fixture(t, encryption({ isAvailable: () => false }));
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { assert.fail('No OAuth request is allowed'); });
  await assert.rejects(client.signIn(), errorCode('storage_encryption_unavailable'));
  await assert.rejects(store.withLock(() => store.getHostId()), errorCode('storage_encryption_unavailable'));
  await assert.rejects(write(store, savedState()), errorCode('storage_encryption_unavailable'));
  assert.equal(fetchMock.mock.callCount(), 0);
  assert.deepEqual(await readdir(directory), []);
});

test('failed legacy migration preserves original bytes and cannot reset sign-in', async (t) => {
  const { directory, filename, client } = await fixture(t, encryption({ encrypt: () => { throw new Error('private-provider-error'); } }));
  const raw = JSON.stringify(savedState());
  await writeFile(filename, raw, { mode: 0o600 });
  await assert.rejects(client.signIn({ newProfile: true }), errorCode('storage_encryption_failed'));
  assert.equal(await readFile(filename, 'utf8'), raw);
  assert.deepEqual(await readdir(directory), ['chatgpt-auth.json']);
});

test('failed writes preserve ciphertext and remove temporary files', async (t) => {
  const { directory, filename, store, provider } = await fixture(t);
  await write(store, savedState());
  const before = await readFile(filename, 'utf8');
  provider.encrypt = () => { throw new Error('private-provider-error'); };
  await assert.rejects(write(store, savedState()), errorCode('storage_encryption_failed'));
  assert.equal(await readFile(filename, 'utf8'), before);
  assert.deepEqual(await readdir(directory), ['chatgpt-auth.json']);
});

test('asynchronous providers preserve the same encrypted persistence contract', async (t) => {
  const sync = encryption();
  const { store } = await fixture(t, {
    id: sync.id,
    isAvailable: async () => true,
    encrypt: async (value) => sync.encrypt(value),
    decrypt: async (value) => sync.decrypt(value),
  });
  const state = savedState();
  await write(store, state);
  assert.deepEqual(await read(store), state);
});

test('migration refuses an oversized encrypted result without replacing legacy bytes', async (t) => {
  const { directory, filename, store } = await fixture(t);
  const state = savedState();
  state.profiles[0].credentials.accessToken = 'x'.repeat(1_600_000);
  const original = JSON.stringify(state);
  await writeFile(filename, original, { mode: 0o600 });
  await assert.rejects(read(store), errorCode('storage_too_large'));
  assert.equal(await readFile(filename, 'utf8'), original);
  assert.deepEqual(await readdir(directory), ['chatgpt-auth.json']);
});

for (const failure of ['unavailable', 'decrypt', 'provider', 'envelope', 'base64', 'json', 'decrypted-state']) {
  test(`${failure} failure preserves bytes across sign-in, selection and sign-out`, async (t) => {
    const { directory, filename, store, client, provider } = await fixture(t);
    await write(store, savedState());
    let envelope = JSON.parse(await readFile(filename, 'utf8'));
    let expected;
    if (failure === 'unavailable') {
      provider.isAvailable = () => { throw new Error('private-provider-error'); };
      expected = 'storage_encryption_unavailable';
    } else if (failure === 'decrypt') {
      provider.decrypt = () => { throw new Error('private-provider-error'); };
      expected = 'storage_decryption_failed';
    } else if (failure === 'provider') {
      envelope.provider = 'other-provider';
      expected = 'storage_provider_mismatch';
    } else if (failure === 'envelope') {
      envelope.version = 99;
      expected = 'storage_encrypted_invalid';
    } else if (failure === 'base64') {
      envelope.ciphertext = 'not base64!';
      expected = 'storage_encrypted_invalid';
    } else if (failure === 'decrypted-state') {
      envelope.ciphertext = Buffer.from(provider.encrypt('{"version":2,"profiles":"invalid"}')).toString('base64');
      expected = 'storage_decryption_failed';
    } else {
      expected = 'storage_invalid';
    }
    const raw = failure === 'json' ? '{"version":3,"ciphertext":' : JSON.stringify(envelope);
    await writeFile(filename, raw);
    t.mock.method(globalThis, 'fetch', () => { assert.fail('Unreadable credentials must not reach OAuth'); });
    for (const action of [() => client.signIn({ newProfile: true }), () => client.selectProfile('profile-1'), () => client.disconnect()]) {
      await assert.rejects(action(), (error) => error.code === expected && !error.message.includes('private-provider-error'));
      assert.equal(await readFile(filename, 'utf8'), raw);
    }
    const session = await client.getSession();
    assert.equal(session.error.code, expected);
    assert.equal(JSON.stringify(session).includes('private-access-token'), false);
    assert.deepEqual(await readdir(directory), ['chatgpt-auth.json']);
  });
}

test('ciphertext tampering fails without returning credentials', async (t) => {
  const { filename, store } = await fixture(t);
  await write(store, savedState());
  const envelope = JSON.parse(await readFile(filename, 'utf8'));
  const bytes = Buffer.from(envelope.ciphertext, 'base64');
  bytes[bytes.length - 1] ^= 1;
  envelope.ciphertext = bytes.toString('base64');
  await writeFile(filename, JSON.stringify(envelope));
  await assert.rejects(read(store), errorCode('storage_decryption_failed'));
});

test('sign-out removes local tokens even when remote revocation fails, retaining encrypted registration', async (t) => {
  const { filename, store, client } = await fixture(t);
  await write(store, savedState());
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Offline test'); });
  await assert.rejects(client.disconnect(), errorCode('revocation_failed'));
  const saved = await read(store);
  assert.equal(saved.profiles[0].credentials, undefined);
  assert.equal(saved.profiles[0].profileIdToken, undefined);
  assert.equal(saved.profiles[0].status, 'disconnected');
  assert.equal(saved.profiles[0].clientId, 'registered_test_client');
  assert.equal(JSON.parse(await readFile(filename, 'utf8')).version, 3);
});

test('owner-only file enforcement and symlink rejection survive encryption changes', { skip: process.platform === 'win32' }, async (t) => {
  const { directory, filename, store } = await fixture(t);
  await write(store, savedState());
  await chmod(filename, 0o644);
  await assert.rejects(read(store), errorCode('storage_unsafe'));
  await rm(filename);
  const target = join(directory, 'target.json');
  await writeFile(target, JSON.stringify(savedState()), { mode: 0o600 });
  await symlink(target, filename);
  await assert.rejects(read(store), errorCode('storage_invalid'));
  assert.equal(JSON.parse(await readFile(target, 'utf8')).version, 2);
});

test('store requires its lock for reads and writes', async (t) => {
  const { store } = await fixture(t);
  await assert.rejects(store.read(), errorCode('storage_lock_lost'));
  await assert.rejects(store.write(savedState()), errorCode('storage_lock_lost'));
});
