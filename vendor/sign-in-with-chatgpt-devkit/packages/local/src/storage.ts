import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import lockfile from "proper-lockfile";
import { AsyncLocalStorage } from "node:async_hooks";
import { ChatGPTError, isObject } from "./errors.js";
import type { CredentialEncryption, StoredConnection, StoredState } from "./types.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function validateRecord(value: unknown): StoredConnection {
  if (!isObject(value) || value.version !== 1 || typeof value.clientId !== "string" || !value.clientId ||
      value.clientId === "dynamic_agent_client" || !["connected", "disconnected", "reauth_required"].includes(String(value.status)) ||
      !Array.isArray(value.scopes) || !value.scopes.every((scope) => typeof scope === "string") || typeof value.savedAt !== "string") {
    throw new ChatGPTError("storage_invalid", "Saved ChatGPT credentials could not be read. Restore the credential file before signing in.");
  }
  if (value.subject !== undefined && typeof value.subject !== "string") throw new ChatGPTError("storage_invalid", "Saved ChatGPT identity is invalid. Restore the credential file before signing in.");
  if (value.identity !== undefined && (!isObject(value.identity) ||
      (value.identity.name !== undefined && typeof value.identity.name !== "string") ||
      (value.identity.email !== undefined && typeof value.identity.email !== "string"))) {
    throw new ChatGPTError("storage_invalid", "Saved ChatGPT identity is invalid. Restore the credential file before signing in.");
  }
  if (value.credentials !== undefined && (!isObject(value.credentials) ||
      typeof value.credentials.accessToken !== "string" || !value.credentials.accessToken ||
      typeof value.credentials.expiresAt !== "number" || !Number.isFinite(value.credentials.expiresAt) ||
      (value.credentials.refreshToken !== undefined && typeof value.credentials.refreshToken !== "string"))) {
    throw new ChatGPTError("storage_invalid", "Saved ChatGPT credentials are invalid. Restore the credential file before signing in.");
  }
  if (value.profileIdToken !== undefined && (typeof value.profileIdToken !== "string" || !value.profileIdToken)) {
    throw new ChatGPTError("storage_invalid", "Saved ChatGPT identity is invalid. Restore the credential file before signing in.");
  }
  if (value.pendingRefresh !== undefined) {
    const pending = value.pendingRefresh;
    if (!isObject(pending) || value.status !== "connected" || !value.credentials ||
        typeof pending.idToken !== "string" || !pending.idToken ||
        typeof pending.receivedAt !== "number" || !Number.isSafeInteger(pending.receivedAt) || pending.receivedAt <= 0 || pending.receivedAt > Date.now() + 5_000 ||
        !Array.isArray(pending.scopes) || !pending.scopes.every((scope) => typeof scope === "string") ||
        !isObject(pending.credentials) || typeof pending.credentials.accessToken !== "string" || !pending.credentials.accessToken ||
        typeof pending.credentials.refreshToken !== "string" || !pending.credentials.refreshToken ||
        typeof pending.credentials.expiresAt !== "number" || !Number.isFinite(pending.credentials.expiresAt) ||
        (pending.credentials.earliestRefreshAt !== undefined && typeof pending.credentials.earliestRefreshAt !== "string" && typeof pending.credentials.earliestRefreshAt !== "number")) {
      throw new ChatGPTError("storage_invalid", "The pending ChatGPT connection is invalid. Restore the credential file before signing in.");
    }
  }
  return value as unknown as StoredConnection;
}

function validateState(value: unknown): StoredState {
  const invalid = () => new ChatGPTError("storage_invalid", "Saved ChatGPT profiles could not be read. Restore the credential file before signing in.");
  if (!isObject(value) || value.version !== 2 || !Array.isArray(value.profiles) || !Array.isArray(value.pendingRegistrations)) throw invalid();
  const entries = [...value.profiles, ...value.pendingRegistrations];
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const entry of entries) {
    if (!isObject(entry) || typeof entry.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(entry.id) ||
        typeof entry.label !== "string" || !entry.label.trim() || entry.label.length > 120 || /[\u0000-\u001f]/.test(entry.label) ||
        typeof entry.clientId !== "string" || !/^[a-zA-Z0-9_-]{1,200}$/.test(entry.clientId) || entry.clientId === "dynamic_agent_client" ||
        typeof entry.savedAt !== "string" || ids.has(entry.id) || labels.has(entry.label)) throw invalid();
    ids.add(entry.id);
    labels.add(entry.label);
  }
  for (const profile of value.profiles) {
    validateRecord(profile);
    if (profile.requiresNewRegistration !== undefined && typeof profile.requiresNewRegistration !== "boolean") throw invalid();
  }
  if (value.activeProfileId !== undefined && (typeof value.activeProfileId !== "string" || !value.profiles.some((profile) => profile.id === value.activeProfileId))) throw invalid();
  return value as unknown as StoredState;
}

/** All reads and mutations run under one interprocess lock. Never expose this store to a renderer. */
export class ConnectionStore {
  readonly directory: string;
  readonly #filename: string;
  readonly #lock: string;
  readonly #hostFilename: string;
  readonly #encryption: CredentialEncryption;
  readonly #context = new AsyncLocalStorage<{ compromised: boolean }>();

  constructor(directory: string, encryption: CredentialEncryption) {
    if (!encryption || typeof encryption.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(encryption.id) ||
        typeof encryption.isAvailable !== "function" || typeof encryption.encrypt !== "function" || typeof encryption.decrypt !== "function") {
      throw new ChatGPTError("invalid_config", "Provide an OS-backed credential encryption provider in the local process.");
    }
    this.directory = directory;
    this.#encryption = encryption;
    this.#filename = join(directory, "chatgpt-auth.json");
    this.#lock = join(directory, ".chatgpt-auth.lock");
    this.#hostFilename = join(directory, "chatgpt-host.json");
  }

  async #prepare(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const info = await lstat(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new ChatGPTError("storage_unsafe", "ChatGPT storage must be a private directory, not a symbolic link.");
    }
    if (process.platform !== "win32") {
      if (process.getuid && info.uid !== process.getuid()) throw new ChatGPTError("storage_unsafe", "ChatGPT storage must belong to the current user.");
      await chmod(this.directory, 0o700);
    }
  }

  async withLock<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const context = { compromised: false };
    let release: (() => Promise<void>) | undefined;
    try {
      await this.#prepare();
      const started = Date.now();
      for (;;) {
        signal?.throwIfAborted();
        try {
          release = await lockfile.lock(this.directory, {
            lockfilePath: this.#lock,
            stale: 120_000,
            update: 20_000,
            retries: 0,
            onCompromised: () => { context.compromised = true; },
          });
          break;
        } catch (error) {
          if (!hasCode(error, "ELOCKED")) throw error;
          if (Date.now() - started > 45_000) {
            throw new ChatGPTError("storage_busy", "Another app process is updating this ChatGPT connection. Try again shortly.", true);
          }
          await delay(100, undefined, signal ? { signal } : {});
        }
      }
      signal?.throwIfAborted();
      const value = await this.#context.run(context, operation);
      if (context.compromised) throw new ChatGPTError("storage_lock_lost", "The credential storage lock was interrupted. Close other copies of the app and reconnect.");
      return value;
    } catch (error) {
      if (error instanceof ChatGPTError) throw error;
      if (signal?.aborted) throw new ChatGPTError("cancelled", "The request was cancelled.");
      throw new ChatGPTError("storage_error", "ChatGPT credentials could not be saved securely. Check the app's storage permissions.");
    } finally {
      if (release && !context.compromised) {
        try { await release(); }
        catch { throw new ChatGPTError("storage_lock_lost", "The credential storage lock was interrupted. Close other copies of the app and reconnect."); }
      }
    }
  }

  #assertLocked(): void {
    const context = this.#context.getStore();
    if (!context || context.compromised) throw new ChatGPTError("storage_lock_lost", "The credential storage lock was interrupted. Close other copies of the app and reconnect.");
  }

  async #requireEncryption(): Promise<void> {
    let available = false;
    try { available = await this.#encryption.isAvailable() === true; } catch { /* Do not expose provider error details. */ }
    if (!available) throw new ChatGPTError("storage_encryption_unavailable", "Secure credential storage is unavailable. Unlock your OS credential store and try again. Saved credentials have been preserved.", true);
  }

  async #readFile(filename: string): Promise<unknown> {
    this.#assertLocked();
    try {
      const noFollow = process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
      const file = await open(filename, constants.O_RDONLY | noFollow);
      try {
        const info = await file.stat();
        if (!info.isFile() || info.size > MAX_FILE_BYTES ||
            (process.platform !== "win32" && ((info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())))) {
          throw new ChatGPTError("storage_unsafe", "Saved ChatGPT credentials must be a private, owner-only file.");
        }
        return JSON.parse(await file.readFile("utf8")) as unknown;
      } finally {
        await file.close();
      }
    } catch (error) {
      if (hasCode(error, "ENOENT")) return undefined;
      if (error instanceof ChatGPTError) throw error;
      throw new ChatGPTError("storage_invalid", "Saved ChatGPT credentials could not be read. Check the app's storage permissions.");
    }
  }

  async read(): Promise<StoredState | undefined> {
    this.#assertLocked();
    await this.#requireEncryption();
    const value = await this.#readFile(this.#filename);
    if (value === undefined) return undefined;
    if (isObject(value) && value.version === 3) {
      if (typeof value.provider !== "string" || typeof value.ciphertext !== "string" || !value.ciphertext ||
          Buffer.from(value.ciphertext, "base64").toString("base64") !== value.ciphertext) {
        throw new ChatGPTError("storage_encrypted_invalid", "The encrypted credential file is damaged. Restore the file before signing in. Saved credentials have been preserved.");
      }
      if (value.provider !== this.#encryption.id) {
        throw new ChatGPTError("storage_provider_mismatch", "Use the credential encryption provider that created this file. Saved credentials have been preserved.");
      }
      try {
        const plaintext = await this.#encryption.decrypt(Buffer.from(value.ciphertext, "base64"));
        if (typeof plaintext !== "string") throw new Error("Invalid decryption result");
        return validateState(JSON.parse(plaintext) as unknown);
      } catch {
        throw new ChatGPTError("storage_decryption_failed", "Saved credentials could not be decrypted. Restore access to your OS credential store or restore the credential file. Saved credentials have been preserved.");
      }
    }
    if (isObject(value) && value.version === 1) {
      // Old registrations used localhost. Preserve usable credentials, but never
      // reauthorize the issued client using a different registered callback host.
      const connection = validateRecord(value);
      const id = randomUUID();
      const migrated: StoredState = {
        version: 2,
        activeProfileId: id,
        profiles: [{ ...connection, id, label: "Connection 1", requiresNewRegistration: true }],
        pendingRegistrations: [],
      };
      await this.write(migrated);
      return migrated;
    }
    if (!isObject(value) || value.version !== 2) {
      throw new ChatGPTError("storage_encrypted_invalid", "The saved credential format is not supported. Restore the file or use the app version that created it. Saved credentials have been preserved.");
    }
    const migrated = validateState(value);
    await this.write(migrated);
    return migrated;
  }

  /** This file belongs to the runtime, independently of login/profile files. */
  async getHostId(): Promise<string> {
    this.#assertLocked();
    await this.#requireEncryption();
    let value: unknown;
    try { value = await this.#readFile(this.#hostFilename); }
    catch (error) {
      if (error instanceof ChatGPTError && error.code === "storage_invalid") {
        throw new ChatGPTError("host_identity_invalid", "The saved runtime identity could not be read. Restore chatgpt-host.json before signing in.");
      }
      throw error;
    }
    if (value === undefined) {
      const id = `urn:uuid:${randomUUID()}`;
      await this.#writeFile(this.#hostFilename, { version: 1, id });
      return id;
    }
    if (!isObject(value) || value.version !== 1 || typeof value.id !== "string" ||
        !/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value.id)) {
      throw new ChatGPTError("host_identity_invalid", "The saved runtime identity is invalid. Restore chatgpt-host.json before signing in.");
    }
    return value.id;
  }

  async write(record: StoredState): Promise<void> {
    this.#assertLocked();
    await this.#requireEncryption();
    validateState(record);
    let ciphertext: Uint8Array;
    try {
      ciphertext = await this.#encryption.encrypt(JSON.stringify(record));
      if (!(ciphertext instanceof Uint8Array) || ciphertext.byteLength === 0) throw new Error("Invalid encryption result");
    } catch {
      throw new ChatGPTError("storage_encryption_failed", "ChatGPT credentials could not be encrypted. Check your OS credential store and try again. Saved credentials have been preserved.", true);
    }
    await this.#writeFile(this.#filename, { version: 3, provider: this.#encryption.id, ciphertext: Buffer.from(ciphertext).toString("base64") });
  }

  async #writeFile(filename: string, value: unknown): Promise<void> {
    this.#assertLocked();
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized, "utf8") > MAX_FILE_BYTES) {
      throw new ChatGPTError("storage_too_large", "The encrypted credential file exceeds the supported size. Saved credentials have been preserved.");
    }
    const temporary = join(this.directory, `.chatgpt-auth.${randomUUID()}.tmp`);
    try {
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(serialized);
        await file.sync();
      } finally {
        await file.close();
      }
      this.#assertLocked();
      await rename(temporary, filename);
      if (process.platform !== "win32") {
        const directory = await open(this.directory, "r");
        try {
          await directory.sync();
        } finally {
          await directory.close();
        }
      }
    } finally {
      await rm(temporary, { force: true });
    }
  }
}
