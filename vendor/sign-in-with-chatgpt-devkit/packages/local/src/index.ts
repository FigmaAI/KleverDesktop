/*
 * MODIFIED BY KLEVERDESKTOP, 2026-10-04.
 * Added the trusted-local-process withAccessToken extension, delegating to the
 * upstream authenticated request lifecycle, and storage exports for legacy
 * credential migration in the trusted local process. Sign-in now rolls back a
 * cancelled final credential write and completes publication while still locked.
 * Added protected credential-transaction draining and local-first disconnect;
 * refresh grants and rotation checkpoints remain protected from caller aborts.
 * This modification is licensed under
 * SIGN-IN WITH CHATGPT DEVKIT NONCOMMERCIAL LICENSE Version 1.0; see ../../../LICENSE.
 */
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { asError, ChatGPTError, requiresReauthentication } from "./errors.js";
import { listModels } from "./models.js";
import { authorize, identityVerificationUnavailable, refreshConnection, revokeConnection } from "./oauth.js";
import { streamResponse } from "./responses.js";
import { ConnectionStore } from "./storage.js";
import type { ChatGPTClient, ChatGPTConfig, LoginProfile, PendingRegistration, SessionState, StoredConnection, StoredProfile, StoredState } from "./types.js";

export { ChatGPTError } from "./errors.js";
export type { ChatGPTClient, ChatGPTConfig, ChatGPTModel, CredentialEncryption, LoginProfile, ResponseInputMessage, SessionError, SessionIdentity, SessionState, SignInOptions, StreamResponseOptions } from "./types.js";
/** KleverDesktop migration extension: trusted local process only; never expose this store through IPC. */
export { ConnectionStore } from "./storage.js";
/** Credential-bearing migration types are for trusted local-process storage only, never renderer IPC or logs. */
export type { StoredConnection, StoredProfile, StoredState } from "./types.js";
export const CHATGPT_USAGE_URL = "https://chatgpt.com/settings/usage";

const SHARING_SCOPE = "chatgpt.tokens.use.direct";
const emptyState = (): StoredState => ({ version: 2, profiles: [], pendingRegistrations: [] });
const selectedProfile = (saved: StoredState) => saved.profiles.find((profile) => profile.id === saved.activeProfileId);

function safeSession(saved: StoredState): SessionState {
  const profile = selectedProfile(saved);
  if (!profile) return { status: "disconnected", sharing: false };
  return {
    status: profile.status,
    sharing: profile.status === "connected" && Boolean(profile.credentials) && profile.scopes.includes(SHARING_SCOPE),
    profileId: profile.id,
    profileLabel: profile.label,
    ...(profile.identity ? { identity: { ...profile.identity } } : {}),
    ...(profile.pendingRefresh ? { error: identityVerificationUnavailable().toJSON() } : {}),
  };
}

function safeProfiles(saved: StoredState): LoginProfile[] {
  return [
    ...saved.profiles.map((profile) => ({
      id: profile.id, label: profile.label, status: profile.status,
      sharing: profile.status === "connected" && Boolean(profile.credentials) && profile.scopes.includes(SHARING_SCOPE),
      ...(profile.identity ? { identity: { ...profile.identity } } : {}),
      ...(profile.requiresNewRegistration ? { requiresNewRegistration: true } : {}),
    })),
    ...saved.pendingRegistrations.map((entry) => ({ id: entry.id, label: entry.label, status: "disconnected" as const, sharing: false, pending: true })),
  ];
}

function withoutCredentials(profile: StoredProfile, status: "disconnected" | "reauth_required"): StoredProfile {
  // Keep the verified subject and registration through logout; email is only a label.
  const { credentials: _credentials, profileIdToken: _idToken, pendingRefresh: _pendingRefresh, ...metadata } = profile;
  return { ...metadata, status, scopes: [], savedAt: new Date().toISOString() };
}

function pendingConnection(pending: PendingRegistration): StoredConnection {
  return { version: 1, clientId: pending.clientId, status: "disconnected", scopes: [], savedAt: pending.savedAt };
}

function connectionLabel(saved: StoredState, requested?: string): string {
  const used = new Set([...saved.profiles, ...saved.pendingRegistrations].map((entry) => entry.label));
  if (requested !== undefined) {
    const label = requested.trim();
    if (!label || label.length > 100 || /[\u0000-\u001f]/.test(label)) throw new ChatGPTError("invalid_config", "Use a connection label between 1 and 100 characters.");
    if (!used.has(label)) return label;
    for (let number = 2; ; number++) if (!used.has(`${label} (${number})`)) return `${label} (${number})`;
  }
  for (let number = 1; ; number++) if (!used.has(`Connection ${number}`)) return `Connection ${number}`;
}

/** Create one instance in your local runtime; expose only safe methods over your app's IPC. */
export function createChatGPT(config: ChatGPTConfig): ChatGPTClient {
  if (!config.appName.trim() || config.appName.length > 120 || /[\u0000-\u001f]/.test(config.appName)) throw new ChatGPTError("invalid_config", "Provide a short, human-readable app name.");
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(config.appId)) throw new ChatGPTError("invalid_config", "Use a stable app ID containing lowercase letters, digits, dots, underscores, or hyphens.");
  if (!Number.isInteger(config.redirectPort) || config.redirectPort < 0 || config.redirectPort > 65535) throw new ChatGPTError("invalid_config", "Provide a valid loopback redirect port, or 0 to select an available port.");
  if (config.storageDir && !isAbsolute(config.storageDir)) throw new ChatGPTError("invalid_config", "ChatGPT storageDir must be an absolute path.");
  if (config.sendHostId !== undefined && typeof config.sendHostId !== "boolean") throw new ChatGPTError("invalid_config", "sendHostId must be a boolean enabled only for a compatible authorization deployment.");
  const store = new ConnectionStore(config.storageDir ?? join(homedir(), ".config", config.appId), config.credentialEncryption);
  const subscribers = new Set<(state: SessionState) => void>();
  const requests = new Set<AbortController>();
  const credentialTransactions = new Set<Promise<void>>();
  let state: SessionState = { status: "disconnected", sharing: false };
  let pendingSignIn: AbortController | undefined;
  let changingProfile = false;
  let epoch = 0;
  const snapshot = () => structuredClone(state);
  const publish = (value: SessionState) => {
    state = value;
    for (const listener of subscribers) {
      try { listener(snapshot()); } catch { /* Subscribers cannot interrupt credential persistence. */ }
    }
    return snapshot();
  };
  const read = () => store.withLock(async () => (await store.read()) ?? emptyState());
  const cancelRequests = () => { epoch++; for (const request of requests) request.abort(); };
  const assertIdle = () => {
    if (pendingSignIn || changingProfile) throw new ChatGPTError("connection_busy", "Finish the connection change before continuing.");
  };

  async function protectedCredentialTransaction<T>(operation: () => Promise<T>): Promise<T> {
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    // Register before operation can start a grant or await a checkpoint write.
    credentialTransactions.add(pending);
    try { return await operation(); }
    finally {
      credentialTransactions.delete(pending);
      complete();
    }
  }

  async function waitForCredentialTransactions(): Promise<void> {
    // Include any protected transaction that starts while this drain is waiting.
    // Completion promises never reject; request callers retain the actual error.
    while (credentialTransactions.size) await Promise.all([...credentialTransactions]);
  }

  const credentialsForRequest = async (signal: AbortSignal) => store.withLock(async () => {
    const saved = (await store.read()) ?? emptyState();
    let profile = selectedProfile(saved);
    if (!profile || profile.status !== "connected") throw new ChatGPTError("sign_in_required", "Sign in with ChatGPT to continue.");
    if (!profile.scopes.includes(SHARING_SCOPE)) throw new ChatGPTError("sharing_not_enabled", "You are signed in, but token sharing is disabled. Enable token sharing in your account settings to continue.");
    if (!profile.credentials) throw new ChatGPTError("sign_in_required", "Your ChatGPT connection has no usable credentials. Sign in again.");
    if (profile.pendingRefresh || profile.credentials.expiresAt <= Date.now() + 60_000) {
      const earliest = profile.credentials.earliestRefreshAt;
      const earliestMs = typeof earliest === "number" ? earliest * 1000 : typeof earliest === "string" ? Date.parse(earliest) : 0;
      if (profile.pendingRefresh || earliestMs <= Date.now() || !Number.isFinite(earliestMs)) {
        signal.throwIfAborted();
        await protectedCredentialTransaction(async () => {
          try {
            // Finish and persist rotation even if the calling request is cancelled.
            // Otherwise cancellation could discard the sole valid replacement token.
            const refreshed = await refreshConnection(profile!, AbortSignal.timeout(60_000), async (rotation) => {
              profile = { ...profile!, pendingRefresh: rotation, savedAt: new Date().toISOString() };
              saved.profiles = saved.profiles.map((entry) => entry.id === profile!.id ? profile! : entry);
              await store.write(saved);
            });
            // Do not merge the pending checkpoint back into the verified result.
            profile = { ...refreshed, id: profile!.id, label: profile!.label, ...(profile!.requiresNewRegistration ? { requiresNewRegistration: true } : {}) };
            saved.profiles = saved.profiles.map((entry) => entry.id === profile!.id ? profile! : entry);
            await store.write(saved);
          } catch (error) {
            const typed = asError(error);
            if (requiresReauthentication(typed) || ["invalid_id_token", "invalid_token_response", "account_mismatch"].includes(typed.code)) {
              const invalid = withoutCredentials(profile!, "reauth_required");
              saved.profiles = saved.profiles.map((entry) => entry.id === invalid.id ? invalid : entry);
              await store.write(saved);
            }
            throw typed;
          }
        });
      } else if (profile.credentials.expiresAt <= Date.now()) {
        throw new ChatGPTError("refresh_not_ready", "Your ChatGPT connection cannot refresh yet. Try again shortly.", true);
      }
    }
    // Recovery can finish after the successor access token has expired. Persist
    // the verified rotation first; a later request can refresh its successor.
    if (profile.credentials && profile.credentials.expiresAt <= Date.now()) {
      throw new ChatGPTError("refresh_not_ready", "Your ChatGPT connection was recovered. Try the request again to renew it.", true);
    }
    if (!profile.scopes.includes(SHARING_SCOPE)) throw new ChatGPTError("sharing_not_enabled", "You are signed in, but token sharing is disabled. Enable token sharing in your account settings to continue.");
    if (!profile.credentials) throw new ChatGPTError("sign_in_required", "Your ChatGPT connection has no usable credentials. Sign in again.");
    return { accessToken: profile.credentials.accessToken, session: safeSession(saved) };
  }, signal);

  async function authenticated<T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>, callerSignal?: AbortSignal): Promise<T> {
    assertIdle();
    const controller = new AbortController();
    requests.add(controller);
    const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal;
    const currentEpoch = epoch;
    try {
      const connection = await credentialsForRequest(signal);
      signal.throwIfAborted();
      if (currentEpoch !== epoch) throw new ChatGPTError("cancelled", "The request was cancelled.");
      publish(connection.session);
      const result = await operation(connection.accessToken, signal);
      signal.throwIfAborted();
      return result;
    } catch (error) {
      const typed = asError(error);
      if (typed.code !== "cancelled" && currentEpoch === epoch) {
        // HTTP authorization failures alone do not establish that OAuth was revoked.
        const saved = await read().catch(() => undefined);
        publish({ ...(saved ? safeSession(saved) : state), error: typed.toJSON() });
      }
      throw typed;
    } finally {
      requests.delete(controller);
    }
  }

  return {
    async signIn(options = {}) {
      assertIdle();
      if (options.newProfile && options.profileId) throw new ChatGPTError("invalid_config", "Choose either a new profile or a saved profile.");
      const controller = new AbortController();
      pendingSignIn = controller;
      cancelRequests();
      const operation = epoch;
      const signals = [controller.signal, AbortSignal.timeout(10 * 60_000)];
      if (options.signal) signals.push(options.signal);
      const signal = AbortSignal.any(signals);
      const assertCurrent = () => {
        signal.throwIfAborted();
        if (operation !== epoch) throw new ChatGPTError("cancelled", "Sign-in was cancelled.");
      };
      publish({ ...state, status: "connecting", error: undefined });
      try {
        const prepared = await store.withLock(async () => {
          // An unreadable file may contain recoverable credentials. Never reset it
          // merely because a key is unavailable or decryption/parsing failed.
          const saved = (await store.read()) ?? emptyState();
          const id = (!options.newProfile ? options.profileId ?? saved.activeProfileId : undefined) ?? randomUUID();
          const profile = saved.profiles.find((entry) => entry.id === id);
          const pending = saved.pendingRegistrations.find((entry) => entry.id === id);
          if (options.profileId && !profile && !pending) throw new ChatGPTError("profile_not_found", "The saved ChatGPT profile could not be found.");
          if (profile?.requiresNewRegistration) throw new ChatGPTError("registration_upgrade_required", "This connection was registered with the older localhost callback. Add an account to register the new 127.0.0.1 callback. Your existing connection is preserved.");
          const label = profile?.label ?? pending?.label ?? connectionLabel(saved, options.label);
          // Persist the runtime identity before any browser authorization, including cancelled attempts.
          const hostId = await store.getHostId();
          return { id, label, profile, previous: profile ?? (pending ? pendingConnection(pending) : undefined), hostId, activeProfileId: saved.activeProfileId };
        }, signal);
        let previous = prepared.previous;
        let issuedClientId = previous?.clientId;
        let record: StoredConnection | undefined;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            record = await authorize(config, previous, prepared.hostId, signal, {
              reconsent: options.reconsent,
              onRegistration: async (clientId) => {
                issuedClientId = clientId;
                await store.withLock(async () => {
                  assertCurrent();
                  const saved = (await store.read()) ?? emptyState();
                  const existing = saved.profiles.find((entry) => entry.id === prepared.id);
                  if (existing) {
                    if (!prepared.profile || existing.clientId !== clientId || existing.savedAt !== prepared.profile.savedAt ||
                        existing.credentials?.accessToken !== prepared.profile.credentials?.accessToken) {
                      throw new ChatGPTError("connection_changed", "The selected ChatGPT connection changed during sign-in. Try again.");
                    }
                    return;
                  }
                  if (prepared.profile) throw new ChatGPTError("connection_changed", "The selected ChatGPT connection changed during sign-in. Try again.");
                  const pending = saved.pendingRegistrations.find((entry) => entry.id === prepared.id);
                  if (pending && pending.clientId !== clientId) throw new ChatGPTError("connection_changed", "The pending registration changed. Select the profile and try again.");
                  if (!pending) {
                    saved.pendingRegistrations.push({ id: prepared.id, label: connectionLabel(saved, prepared.label), clientId, savedAt: new Date().toISOString() });
                    await store.write(saved);
                  }
                }, signal);
              },
            });
            break;
          } catch (error) {
            const typed = asError(error);
            if (typed.code !== "invalid_grant" || attempt !== 0 || !issuedClientId) throw typed;
            // A used/expired code starts a fresh OAuth attempt, never a new registration.
            previous ??= pendingConnection({ id: prepared.id, label: prepared.label, clientId: issuedClientId, savedAt: new Date().toISOString() });
          }
        }
        if (!record) throw new ChatGPTError("sign_in_failed", "ChatGPT sign-in could not be completed.");
        const result = record;
        const session = await store.withLock(async () => {
          assertCurrent();
          const latest = (await store.read()) ?? emptyState();
          assertCurrent();
          const current = latest.profiles.find((entry) => entry.id === prepared.id);
          if (latest.activeProfileId !== prepared.activeProfileId ||
              (prepared.profile && (!current || current.savedAt !== prepared.profile.savedAt || current.credentials?.accessToken !== prepared.profile.credentials?.accessToken))) {
            throw new ChatGPTError("connection_changed", "The selected ChatGPT connection changed during sign-in. Try again.");
          }
          const pending = latest.pendingRegistrations.find((entry) => entry.id === prepared.id);
          if (pending && pending.clientId !== result.clientId) throw new ChatGPTError("connection_changed", "The pending ChatGPT registration changed. Try again.");
          const beforeCommit = structuredClone(latest);
          const profile: StoredProfile = { ...result, id: prepared.id, label: current?.label ?? pending?.label ?? prepared.label };
          latest.profiles = [...latest.profiles.filter((entry) => entry.id !== profile.id), profile];
          latest.pendingRegistrations = latest.pendingRegistrations.filter((entry) => entry.id !== profile.id);
          latest.activeProfileId = profile.id;
          try {
            await store.write(latest);
            assertCurrent();
          } catch (error) {
            if (signal.aborted || operation !== epoch) {
              // KleverDesktop: cancellation may arrive during async encryption
              // or file I/O. Restore the exact pre-commit state under this lock;
              // do not discard refresh rotations or another process's changes.
              await store.write(beforeCommit);
              throw new ChatGPTError("cancelled", "Sign-in was cancelled.");
            }
            throw error;
          }
          // KleverDesktop: completion is published before async lock release.
          // A later cancelSignIn is therefore a no-op for an already committed
          // sign-in, including cancellation from a session subscriber.
          if (pendingSignIn === controller) pendingSignIn = undefined;
          return publish(safeSession(latest));
        }, signal);
        return session;
      } catch (error) {
        const typed = asError(error);
        if (operation === epoch) {
          const saved = await read().catch(() => emptyState());
          publish({ ...safeSession(saved), ...(typed.code !== "cancelled" ? { error: typed.toJSON() } : {}) });
        }
        throw typed;
      } finally {
        if (pendingSignIn === controller) pendingSignIn = undefined;
      }
    },

    cancelSignIn() { pendingSignIn?.abort(); },

    async getSession() {
      if (pendingSignIn || changingProfile) return snapshot();
      try {
        const next = safeSession(await read());
        return publish({ ...next, ...(state.profileId === next.profileId && state.error ? { error: state.error } : {}) });
      } catch (error) {
        return publish({ status: "reauth_required", sharing: false, error: asError(error).toJSON() });
      }
    },

    async listProfiles() { return safeProfiles(await read()); },

    async selectProfile(id) {
      assertIdle();
      changingProfile = true;
      cancelRequests();
      try {
        const saved = await store.withLock(async () => {
          const latest = (await store.read()) ?? emptyState();
          if (!latest.profiles.some((entry) => entry.id === id)) throw new ChatGPTError("profile_not_found", "The saved ChatGPT profile could not be found.");
          latest.activeProfileId = id;
          await store.write(latest);
          return latest;
        });
        return publish(safeSession(saved));
      } finally { changingProfile = false; }
    },

    subscribe(listener) {
      subscribers.add(listener);
      listener(snapshot());
      return () => { subscribers.delete(listener); };
    },

    async disconnect() {
      if (changingProfile) throw new ChatGPTError("connection_busy", "A connection change is already in progress.");
      changingProfile = true;
      cancelRequests();
      pendingSignIn?.abort();
      let revocationFailed = false;
      try {
        // A grant may rotate after cancellation. Let its checkpoint and verified
        // persistence finish before competing for the same interprocess lock.
        await waitForCredentialTransactions();
        const connection = await store.withLock(async () => {
          const latest = (await store.read()) ?? emptyState();
          const profile = selectedProfile(latest);
          const connection = profile ? structuredClone(profile) : undefined;
          if (profile) {
            latest.profiles = latest.profiles.map((entry) => entry.id === profile.id ? withoutCredentials(profile, "disconnected") : entry);
            await store.write(latest);
          }
          // Local sign-out is durable and visible before remote network waits.
          publish(safeSession(latest));
          return connection;
        });
        if (connection?.credentials || connection?.pendingRefresh) {
          try { await revokeConnection(connection); }
          catch { revocationFailed = true; }
        }
        const error = revocationFailed ? new ChatGPTError("revocation_failed", "Local credentials were removed, but remote disconnection could not be confirmed. Disconnect the app in ChatGPT Settings.", true) : undefined;
        if (error) {
          publish({ ...state, error: error.toJSON() });
          throw error;
        }
      } finally { changingProfile = false; }
    },

    async listModels(options = {}) { return authenticated(listModels, options.signal); },

    /** KleverDesktop extension: trusted local process only; never expose through renderer IPC. */
    withAccessToken<T>(operation: (accessToken: string, signal: AbortSignal) => Promise<T>, options: { signal?: AbortSignal } = {}): Promise<T> {
      return authenticated(operation, options.signal);
    },

    /** KleverDesktop lifecycle extension: trusted local process only; contains no credentials. */
    isCredentialRotationPending() { return credentialTransactions.size > 0; },

    /** Wait for protected refresh/checkpoint persistence without aborting a rotating grant. */
    waitForCredentialTransactions,

    async streamResponse(options) {
      if (!options.model.trim()) throw new ChatGPTError("invalid_request", "Choose a model before starting a request.");
      return authenticated((accessToken, signal) => streamResponse(accessToken, options, signal), options.signal);
    },
  };
}
