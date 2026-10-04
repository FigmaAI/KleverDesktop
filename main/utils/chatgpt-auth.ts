/** MIT application adapter around the separately licensed official local Sign-in DevKit. */
import { app, safeStorage, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createChatGPT, ChatGPTError, ConnectionStore,
  type ChatGPTClient, type CredentialEncryption, type SessionState, type StoredState,
} from '@siwc/local';
import type { ChatGPTStatus, ScreenInferenceRequest, AndroidStepInferenceResult } from '../types/chatgpt';
import { ChatGPTRequestError, inferStructuredAndroidStep } from './chatgpt-inference';

let client: ChatGPTClient | undefined;
let initializing: Promise<ChatGPTClient> | undefined;
let pendingLogin: Promise<unknown> | undefined;
let closing = false;
let session: SessionState = { status: 'disconnected', sharing: false };
const subscribers = new Set<(status: ChatGPTStatus) => void>();
const activeRequests = new Set<AbortController>();
const activeOperations = new Set<Promise<unknown>>();

function encryptionAvailable(): boolean {
  return app.isReady() && safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || ['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'].includes(safeStorage.getSelectedStorageBackend()));
}

function credentialEncryption(): CredentialEncryption {
  return {
    id: 'electron-safe-storage-v1', isAvailable: encryptionAvailable,
    encrypt(value) {
      if (!encryptionAvailable()) throw new Error('Secure credential storage is unavailable.');
      return safeStorage.encryptString(value);
    },
    decrypt(value) {
      if (!encryptionAvailable()) throw new Error('Secure credential storage is unavailable.');
      return safeStorage.decryptString(Buffer.from(value));
    },
  };
}

function statusSnapshot(): ChatGPTStatus {
  return {
    authenticated: session.status === 'connected' && session.sharing,
    email: session.identity?.email, loginPending: session.status === 'connecting',
    ...(session.error ? { error: session.error.message } : {}),
    sdkSession: structuredClone(session),
  };
}

function publish(value: SessionState): void {
  session = value;
  const status = statusSnapshot();
  for (const listener of subscribers) {
    try { listener(status); } catch { /* A closed UI cannot interrupt SDK credential persistence. */ }
  }
}

/** Convert the previous app-specific encrypted record once, under the SDK's own lock. */
async function migrateLegacyAccount(directory: string, encryption: CredentialEncryption): Promise<void> {
  const legacyFile = path.join(directory, 'account.json');
  if (!fs.existsSync(legacyFile)) return;
  const store = new ConnectionStore(directory, encryption);
  await store.withLock(async () => {
    const existing = await store.read();
    if (existing) return; // Never replace a newer SDK profile or revive a disconnected account.
    const info = fs.lstatSync(legacyFile);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) {
      throw new ChatGPTError('storage_unsafe', 'The previous ChatGPT account file is unsafe. Saved credentials have been preserved.');
    }
    const saved = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
    const uuid = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    if (saved.version !== 1 || typeof saved.hostId !== 'string' || !uuid.test(saved.hostId)) {
      throw new ChatGPTError('storage_invalid', 'The previous ChatGPT host identity is invalid. Saved credentials have been preserved.');
    }
    const state: StoredState = { version: 2, profiles: [], pendingRegistrations: [] };
    const account = saved.account;
    const validId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value) && value !== 'dynamic_agent_client';
    if (account) {
      if (!validId(account.clientId) || account.issuer !== 'https://auth.openai.com' ||
          typeof account.subject !== 'string' || !account.subject || !Array.isArray(account.scopes) ||
          !account.scopes.every((scope: unknown) => typeof scope === 'string')) {
        throw new ChatGPTError('storage_invalid', 'The previous ChatGPT registration is invalid. Saved credentials have been preserved.');
      }
      const id = randomUUID();
      let tokens: { accessToken: string; refreshToken?: string; idToken: string; expiresAt: number } | undefined;
      if (account.encryptedTokens) {
        const value = JSON.parse(await encryption.decrypt(Buffer.from(account.encryptedTokens, 'base64')));
        if (typeof value.accessToken !== 'string' || !value.accessToken || typeof value.idToken !== 'string' || !value.idToken ||
            typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt) ||
            (value.refreshToken !== undefined && typeof value.refreshToken !== 'string')) {
          throw new ChatGPTError('storage_invalid', 'The previous ChatGPT credentials are invalid. Saved credentials have been preserved.');
        }
        tokens = value;
      }
      state.activeProfileId = id;
      state.profiles.push({ version: 1, id, label: 'Connection 1', clientId: account.clientId,
        subject: account.subject, identity: typeof account.email === 'string' ? { email: account.email } : {},
        status: tokens ? 'connected' : 'disconnected', scopes: tokens ? account.scopes : [], savedAt: new Date().toISOString(),
        ...(tokens ? { profileIdToken: tokens.idToken, credentials: {
          accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt,
        } } : {}),
      });
    } else if (validId(saved.pendingClientId)) {
      state.pendingRegistrations.push({ id: randomUUID(), label: 'Connection 1', clientId: saved.pendingClientId, savedAt: new Date().toISOString() });
    }
    // Preserve the same installation identifier and registered 127.0.0.1 callback.
    const hostFile = path.join(directory, 'chatgpt-host.json');
    if (fs.existsSync(hostFile)) {
      if (await store.getHostId() !== saved.hostId) throw new ChatGPTError('host_identity_invalid', 'The saved ChatGPT host identities disagree. Both files have been preserved.');
    } else {
      const temporary = path.join(directory, `.legacy-host-${randomUUID()}.tmp`);
      try {
        fs.writeFileSync(temporary, JSON.stringify({ version: 1, id: saved.hostId }), { mode: 0o600, flag: 'wx' });
        fs.renameSync(temporary, hostFile);
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    await store.write(state); // The SDK encrypts the entire canonical profile record.
    fs.renameSync(legacyFile, `${legacyFile}.migrated`); // Encrypted recovery copy; never automatically re-imported.
  });
}

/** Explicit logout also sanitizes the encrypted pre-SDK recovery copy. */
function clearLegacyCredentials(directory: string): void {
  for (const name of ['account.json', 'account.json.migrated']) {
    const filename = path.join(directory, name);
    if (!fs.existsSync(filename)) continue;
    const info = fs.lstatSync(filename);
    if (info.isSymbolicLink()) { fs.unlinkSync(filename); continue; }
    if (!info.isFile()) throw new ChatGPTError('storage_unsafe', 'The previous ChatGPT recovery file could not be cleared securely.');
    let record: unknown;
    try { record = info.size <= 2 * 1024 * 1024 ? JSON.parse(fs.readFileSync(filename, 'utf8')) : undefined; }
    catch { /* A damaged credential recovery file has no reusable metadata. */ }
    if (!record || typeof record !== 'object' || Array.isArray(record)) { fs.unlinkSync(filename); continue; }
    const saved = record as Record<string, unknown>;
    const account = saved.account;
    if (account && typeof account === 'object' && !Array.isArray(account)) {
      for (const key of ['encryptedTokens', 'accessToken', 'refreshToken', 'idToken', 'profileIdToken', 'credentials', 'pendingRefresh']) {
        delete (account as Record<string, unknown>)[key];
      }
    }
    const temporary = path.join(directory, `.logout-recovery-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temporary, JSON.stringify(saved), { mode: 0o600, flag: 'wx' });
      fs.renameSync(temporary, filename);
    } finally { fs.rmSync(temporary, { force: true }); }
  }
}

async function sdk(): Promise<ChatGPTClient> {
  await app.whenReady();
  if (client) return client;
  if (initializing) return initializing;
  initializing = (async () => {
    const directory = path.join(app.getPath('userData'), 'chatgpt');
    const encryption = credentialEncryption();
    await migrateLegacyAccount(directory, encryption);
    const instance = createChatGPT({ appName: 'KleverDesktop', appId: 'klever-desktop', redirectPort: 0,
      storageDir: directory, sendHostId: true, credentialEncryption: encryption,
      openBrowser: async url => {
        const target = new URL(url);
        if (target.origin !== 'https://auth.openai.com' || target.pathname !== '/api/accounts/authorize') {
          throw new ChatGPTError('invalid_config', 'Unexpected ChatGPT sign-in destination.');
        }
        await shell.openExternal(target.href);
      },
    });
    instance.subscribe(publish);
    client = instance;
    return instance;
  })();
  try { return await initializing; }
  finally { initializing = undefined; }
}

export function onChatGPTStatusChanged(listener: (status: ChatGPTStatus) => void): () => void {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export async function getChatGPTStatus(): Promise<ChatGPTStatus> {
  try { publish(await (await sdk()).getSession()); }
  catch (error) {
    const typed = error instanceof ChatGPTError ? error : new ChatGPTError('storage_invalid', 'Saved ChatGPT credentials could not be read. They have been preserved.');
    publish({ status: 'reauth_required', sharing: false, error: typed.toJSON() });
  }
  return statusSnapshot();
}

export async function startChatGPTLogin(options: { reconsent?: boolean } = {}): Promise<ChatGPTStatus> {
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  const instance = await sdk();
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  if (pendingLogin) return statusSnapshot();
  const profiles = await instance.listProfiles();
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  if (pendingLogin) return statusSnapshot();
  const pending = profiles.find(profile => profile.pending);
  const operation = instance.signIn({ reconsent: options.reconsent === true, ...(pending ? { profileId: pending.id } : {}) });
  pendingLogin = operation;
  void operation.catch(() => { /* The SDK publishes its safe error/session state. */ }).finally(() => {
    if (pendingLogin === operation) pendingLogin = undefined;
  });
  return statusSnapshot();
}

export async function cancelChatGPTLogin(): Promise<ChatGPTStatus> {
  const instance = await sdk();
  instance.cancelSignIn();
  await pendingLogin?.catch(() => undefined);
  return getChatGPTStatus();
}

export async function logoutChatGPT(): Promise<ChatGPTStatus> {
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  const instance = await sdk();
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  clearLegacyCredentials(path.join(app.getPath('userData'), 'chatgpt'));
  const operation = instance.disconnect();
  activeOperations.add(operation);
  try { await operation; }
  finally { activeOperations.delete(operation); }
  return getChatGPTStatus();
}

export function isChatGPTCredentialRotationActive(): boolean {
  return client?.isCredentialRotationPending() ?? false;
}

export async function cleanupChatGPTAuth(): Promise<void> {
  closing = true;
  client?.cancelSignIn();
  for (const controller of activeRequests) controller.abort();
  await client?.waitForCredentialTransactions();
  await Promise.allSettled([...activeOperations, ...(pendingLogin ? [pendingLogin] : []), ...(initializing ? [initializing] : [])]);
}

export async function inferAndroidStep(request: ScreenInferenceRequest): Promise<AndroidStepInferenceResult> {
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  const instance = await sdk();
  if (closing) throw new ChatGPTError('cancelled', 'The application is shutting down.');
  const controller = new AbortController();
  activeRequests.add(controller);
  const signal = request.signal ? AbortSignal.any([request.signal, controller.signal]) : controller.signal;
  let inferenceError: unknown;
  let operation: Promise<AndroidStepInferenceResult> | undefined;
  try {
    operation = instance.withAccessToken(async (token, sdkSignal) => {
      try { return await inferStructuredAndroidStep({ ...request, signal: sdkSignal }, token); }
      catch (error) {
        inferenceError = error;
        if (sdkSignal.aborted) throw new ChatGPTError('cancelled', 'The request was cancelled.');
        if (error instanceof ChatGPTRequestError) throw new ChatGPTError(error.code || 'inference_error', error.message, false, error.status,
          { requestId: error.requestId, param: error.param });
        throw error;
      }
    }, { signal });
    activeOperations.add(operation);
    return await operation;
  } catch (error) {
    if (inferenceError) throw inferenceError; // Preserve bounded app validation/diagnostic metadata.
    throw error;
  } finally {
    activeRequests.delete(controller);
    if (operation) activeOperations.delete(operation);
  }
}
