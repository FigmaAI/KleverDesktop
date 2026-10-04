# Vendored Sign in with ChatGPT DevKit

**Modified by KleverDesktop on 2026-10-04 under the bundled Noncommercial
License Version 1.0:** this README documents the local vendor integration; the
unchanged original is preserved in `UPSTREAM_README.md`.

This directory contains OpenAI's official local-runtime and React packages from
[openai/sign-in-with-chatgpt-devkit](https://github.com/openai/sign-in-with-chatgpt-devkit),
pinned to commit **f723814abdccec135b519c451fb6e1992ee5e933**. The source was copied
from the clean upstream checkout at that commit on 2026-10-04. `UPSTREAM_README.md`
preserves the upstream README. Upstream examples and their application code are
excluded; the local package's upstream regression tests are retained.

## License and distribution

The bundled [LICENSE](./LICENSE) is the **SIGN-IN WITH CHATGPT DEVKIT
NONCOMMERCIAL LICENSE, Version 1.0**, copyright 2026 OpenAI. It applies to the
OpenAI-authored Work and these modifications. This vendored code is not licensed
under the surrounding application's MIT license.

The license permits use, reproduction, modification, display, performance, and
distribution solely for noncommercial purposes: personal learning,
experimentation, or development with no intended or reasonably anticipated
commercial application. Development, testing, distribution, or operation by or
for a business, employer, or client for its operations or commercial advantage is
excluded, even if no fee is charged. Nonprofit status alone does not qualify.
Commercial use of OpenAI's contribution requires a separate written agreement
with OpenAI.

Redistribution must include this license, prominent change notices, and applicable
copyright, patent, trademark, attribution, and third-party notices. Every
distributed modification owned or licensable by its distributor must use the
same license, including its copyright and patent grants, with no additional
restrictions. Recipients receive each contributor's rights directly; a
distributor cannot expand another contributor's grant.

Patent rights cover only licensable claims necessarily infringed by a
contribution itself or by its inclusion in the Work or Modified Work where first
distributed, and only for permitted noncommercial purposes. They do not cover
claims caused solely by later modifications or combinations. Filing a qualifying
patent claim terminates the license's patent grants; copyright grants do not
terminate solely for that reason.

The license does not grant rights to OpenAI names, marks, logos, or branded visual
assets beyond origin identification and required notices, and does not grant
access to ChatGPT or other OpenAI services. Separate terms govern those assets
and services. Separately licensed third-party materials retain their own terms;
see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md), the dependency inventory,
and font notices under `assets/fonts`. The Work is provided as-is without
warranties, with the liability limitations in the full license. This summary does
not replace the full license.

## KleverDesktop modifications

These modifications were made on 2026-10-04 and are offered under the bundled
Noncommercial License Version 1.0:

- `packages/local/src/index.ts`: adds `withAccessToken<T>(operation, options)` to
  the client returned by `createChatGPT`. It delegates to the existing private
  `authenticated` lifecycle, preserving selected-account refresh, credential
  checks, cancellation, and safe session publication. The main-only
  `isCredentialRotationPending()` and `waitForCredentialTransactions()` methods
  track and drain protected refresh, checkpoint, verified persistence, and failure
  cleanup without exposing tokens or aborting a rotating grant. Disconnect waits
  for that drain before acquiring the storage lock, commits and publishes local
  credential removal while locked, then attempts remote revocation outside the
  lock using the latest captured profile or pending successor token. It also exports the
  unchanged `ConnectionStore` and `StoredConnection`, `StoredProfile`, and
  `StoredState` types for trusted-process migration of existing credentials.
  Final sign-in persistence now restores the exact pre-commit state if cancelled
  during encryption or file I/O. Successful sign-in publication and clearing its
  pending operation happen under the same storage lock, before asynchronous lock
  release; cancellation after that completion cannot undo a completed sign-in.
  Refresh-token rotation and its persistence checkpoints are unchanged.
- `packages/local/src/types.ts`: declares and documents that trusted-process
  callback and credential-transaction lifecycle contracts. The access token is
  provided only to its main-process callback;
  applications must never expose the method, token, or credential-bearing callback
  results through renderer IPC, logs, or other untrusted interfaces.
- `packages/local/src/oauth.ts`: races browser-launch completion against
  cancellation and a validated loopback callback. A stalled browser opener cannot
  delay cancellation or the next OAuth step after a valid callback. Cancellation
  closes the callback listener without waiting for the opener; the browser is
  never killed. Code exchange and ID-token verification still follow the callback.
- `package.json`: keeps only the `@siwc/local` and `@siwc/react` workspaces and
  build/typecheck/test commands for those packages; removes example-app commands.
- This README records the source pin, redistribution terms, modifications, and
  integration instructions.

Changed upstream files contain prominent modification notices. Other copied
source, build configuration, assets, notices, and licenses are unchanged.

## Local integration

Use these repository-relative file dependencies:

```json
{
  "@siwc/local": "file:vendor/sign-in-with-chatgpt-devkit/packages/local",
  "@siwc/react": "file:vendor/sign-in-with-chatgpt-devkit/packages/react"
}
```

With Node.js 22.12 or later and the host project's dependencies installed, build
before bundling or packaging the application:

```sh
npm run build --prefix vendor/sign-in-with-chatgpt-devkit
```

The local package requires `jose`, `proper-lockfile`, and its build-time
`@types/proper-lockfile` declaration. The React package requires React 19 and its
matching types. The build produces both packages' `dist` entry points and copies
licenses, third-party notices, and required CSS/assets. Keep those notices with
any redistributed compiled package. No example application, alternate
credential-encryption helper, or browser token bridge is included.
