# Credential storage and application boundaries

## Saved connections

The local SDK requires an application-supplied credential encryption provider. There is no plaintext fallback. Paste Perfect supplies Electron's main-process `safeStorage` implementation after Electron is ready. On macOS, `safeStorage` protects its encryption key with Keychain; the encrypted connection state remains in the app's local data directory.

Pass `credentialEncryption` to `createChatGPT`. The provider implements the exported `CredentialEncryption` interface: a stable provider ID, an availability check, and encryption/decryption operations. See the [Electron adapter](../examples/paste-perfect/electron/credential-encryption.ts) for an example. Other local runtimes must provide their own OS-backed implementation.

The encrypted payload includes access and refresh tokens, the saved ID token, registration data, and account labels. The store uses an interprocess lock, atomic file replacement, and owner-only file and directory permissions on Unix. A separate `chatgpt-host.json` file contains the runtime's non-secret identifier and is not encrypted.

When a refresh returns a new ID token, the SDK saves the rotated credentials in an encrypted pending state before verifying that identity. If the signing-key service is temporarily unavailable, authenticated requests stop and return a retryable error. A later request resumes verification from the saved state, including after an app restart, without reusing the consumed refresh token. Pending credentials become usable only after verification succeeds.

Existing valid plaintext connection files migrate in place on their first read. Migration writes the encrypted replacement atomically and does not create a plaintext backup. If encryption is unavailable, the provider does not match, or the saved state cannot be decrypted or validated, the SDK preserves the original file and returns an error. Starting sign-in does not automatically discard that file. Restore access to the original OS encryption provider or restore a known-good backup before retrying.

Migration does not erase pre-existing backups, filesystem snapshots, or files quarantined by earlier versions. OS encryption protects saved data at rest; it does not protect against code already running inside the trusted application process. Integrators must keep the provider and decrypted credentials out of renderer processes, logs, and telemetry.

Disconnect removes the selected profile's tokens and ID token from the encrypted state while retaining its registration and account label. The SDK attempts remote revocation separately and reports when it cannot confirm revocation.

## Application boundaries

- OAuth runs in the local Node process and opens the system browser. The loopback callback binds to `127.0.0.1`, checks the callback host and path, and validates state. Authorization uses PKCE and an OIDC nonce; returned identity tokens are verified before their associated credentials can be used.
- The Electron renderer has context isolation and sandboxing enabled, with Node integration disabled. Main-process IPC handlers validate the sender, main frame, and application URL. The renderer receives account state and safe operations through the preload bridge, not OAuth credentials.
- The native macOS app launches its bundled Electron dashboard and creates the private subprocess pipes itself. It never reads commands from its own stdin or forwards launcher arguments. Before accepting commands, it verifies its complete signed bundle and binds both the running native process and its child to the validated code hashes. The dashboard and its dependencies live in an integrity-checked ASAR archive; Electron fuses disable alternative app loading, Node environment options, and inspector entry points. The child receives an explicit environment allowlist. A random per-launch command authenticator is delivered only to the validated main process through its stdin; inherited helper stdout alone cannot authorize commands. The authenticator exists only in memory and the private pipe, never in repository files, logs, renderer state, environment variables, arguments, or URLs. macOS 14 or later enforces an exact library code-hash allowlist for the ad-hoc Electron runtime; the native executable keeps full default library validation. Native IPC carries recipe names, transformation results, and the per-launch transport authenticator, but no account credentials. The fixed readiness diagnostic contains no user data or authenticator. Local builds use ad-hoc signatures tied to the exact bundle, so a rebuild can require renewed Accessibility consent. Distribution still requires a separately reviewed signing and notarization configuration. See [native packaging](../examples/paste-perfect/native/README.md).
- Clipboard capture follows the explicit shortcut and paste-menu interaction. The helper checks the destination and clipboard state before pasting and rejects secure text fields. Accessibility permission enables this interaction; the application does not request it automatically during tests.
- A selected transformation sends the copied text and recipe instructions to the Responses API with `store: false`. The response must complete before native paste. Clipboard contents and transformed text do not enter the Electron dashboard's activity list. Saved custom recipes and app preferences remain local JSON and are not covered by credential encryption.

## Verification

The storage regression tests use synthetic credentials and an in-memory test encryption key. They exercise encryption, legacy migration, failure handling, and local credential removal without signing in to an account. Tests and builds do not establish that a particular account is entitled to a model or that native paste works in every destination app.

The refresh tests use synthetic signed tokens and mocked network responses to check recovery from signing-key outages. On macOS, the native regression tests compile and exercise the helper's recipe filtering and cancellation logic without starting its app loop or performing clipboard actions.

An opt-in Electron smoke test exercises the actual OS encryption provider with synthetic credentials in a temporary data directory:

```sh
npm run build -w @siwc/local
node examples/paste-perfect/test/credential-storage-runtime.mjs
```

The runner uses the installed Electron executable, or accepts `--electron /path/to/Electron`. It tests fresh encrypted storage, v1/v2 plaintext migration, decryption across separate Electron processes, rejection of damaged ciphertext, and token removal across a restart. It also injects provider unavailability, decryption errors and provider mismatch to check that failures preserve the original file; those injected checks do not simulate an actual locked or denied Keychain. No OAuth requests, browser windows, clipboard operations or Accessibility permissions are used.

Temporary files are removed on exit. The test uses a unique application name and may leave its test encryption key in the OS credential store; it does not delete or lock Keychain entries. Each Electron process has a 15-second timeout, and the test does not answer OS permission prompts.

A successful run applies to the tested Electron executable and OS credential store. Release validation must separately cover the packaged application's signing identity, Keychain access after upgrades, locked or denied Keychain access, and the OAuth and native clipboard flows.

Review macOS behaviour, OAuth, Electron IPC, and Accessibility/clipboard handling when changing these boundaries. For Electron's platform-specific guarantees and limitations, see the [safeStorage documentation](https://www.electronjs.org/docs/latest/api/safe-storage).
