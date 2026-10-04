# Source provenance and modification notice

Upstream: https://github.com/openai/sign-in-with-chatgpt-devkit

Pinned source commit: **f723814abdccec135b519c451fb6e1992ee5e933**

Copied on 2026-10-04 from a clean checkout of that commit. Included: the official
`packages/local` and `packages/react`, assets, build configuration and required
scripts, source licenses, third-party notices, dependency inventory, security
documentation, and the original README. Example applications are excluded.

**Modified by KleverDesktop on 2026-10-04, under the SIGN-IN WITH CHATGPT DEVKIT
NONCOMMERCIAL LICENSE Version 1.0:** `packages/local/src/index.ts` adds a trusted
local-process `withAccessToken` callback, protected credential-transaction
status/drain methods, and storage exports. It closes the cancelled sign-in
commit/publication race and commits local sign-out before remote revocation;
`packages/local/src/types.ts` declares these main-only contracts;
`packages/local/src/oauth.ts` makes stalled browser-launch waits
cancellable and allows a validated loopback callback to advance OAuth without
waiting for browser launch completion or killing the browser; root `package.json`
builds only the two included packages. These and the replacement `README.md` are
the **five modified upstream file paths**. See
`README.md`, the replacement vendor integration documentation, for the complete
modification list, integration contract, and license
summary. Modified upstream source files carry prominent change notices.

The full `LICENSE` and applicable `THIRD_PARTY_NOTICES.md` accompany this source
and must accompany its compiled redistribution. This vendored code has no
commercial-use grant and is not covered by KleverDesktop's MIT license.
