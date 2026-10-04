# Privacy policy for Klever Desktop

Last updated: October 4, 2026

Klever Desktop stores project definitions, test courses, schedules, run snapshots, screenshots, and reports locally. It does not operate its own hosted test-data service.

## ChatGPT and screen analysis

Sign in with ChatGPT opens the system browser with OpenAI. Session credentials are stored separately from project configuration, encrypted using Electron safeStorage and the operating system credential facilities. Login reports a limitation when secure persistence is unavailable. Tokens are never sent to the renderer or Android SDK processes.

OpenAI's official local DevKit manages account profiles. Existing Klever credentials are migrated locally into its encrypted profile store, retaining their registration and installation identifier. The earlier account file with encrypted credentials is kept as a recovery copy and is not automatically re-imported. Official React account components receive safe connection state through IPC.

Running an AI test sends the short test goal, current Android screenshot, and bounded relevant previous observations directly to OpenAI. Screenshots can contain information visible in the application under test. Responses requests use store:false; the account's applicable OpenAI data-handling policies, model access and usage limits still govern processing.

Logout removes the app's local credentials and attempts remote token revocation. It does not remove test history or end a normal browser session.

## Native device access

Electron launches installed Android SDK tools directly to capture screens and operate the selected Android app. SDK/emulator setup links open official Android documentation. There is no application-managed secondary interpreter, local model service, or browser automation runtime.

Screenshots and structured actions remain in each project workspace. Canonical manifests and course metadata live under ~/.klever-desktop. Legacy test records are retained during migration. Removing the application does not necessarily delete these folders; users control their stored results separately.

## Network and diagnostics

The app contacts OpenAI for authentication/inference and the release service for packaged-app update checks. User-selected documentation links open in the system browser. Usage telemetry has been removed. Electron crash reports remain local and are not uploaded by the app.

Review the source or raise questions in [the project repository](https://github.com/FigmaAI/KleverDesktop).
