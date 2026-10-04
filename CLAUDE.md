# Klever Desktop development

Klever records and repeats native Android tests using ChatGPT screen understanding. The application runtime is Electron/Node/TypeScript and ADB.

## Commands

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build:local
npm run test:desktop
npm run electron
npm run start
npm run package
```

## Architecture

React -> preload IPC -> Electron main -> Android SDK tools and ChatGPT Responses through the official OpenAI Node SDK.

The main process owns account credentials, one native test job at a time, scheduling, and durable storage. A short goal and current screenshot produce one strict namespaced function call. The SDK owns HTTP/SSE; the app validates finalized arguments and screen bounds. The driver accepts a bounded action set and fixed executable/argv pairs. Never execute model text as code or repair malformed action text.

Course definitions and revisions live in project metadata. Every run has a fixed case snapshot, its own result directory and recording.json, and an independent canonical manifest under ~/.klever-desktop/runs. Collect and seal terminal evidence only after the owned job stops. New runs can reuse verified semantic intentions; previous screen coordinates are never replayed blindly.

IPC handlers return {success, data?, error?} or the named project/course/run result. Declare renderer methods in src/types/electron.d.ts and expose them in main/preload.ts. Event listeners return unsubscribe functions. Manual and scheduled tests use the same task runner.

ChatGPT tokens stay in the main process and its encrypted safeStorage file. Never send them to the renderer, SDK subprocesses, logs, or project configuration. The SDK folder is the only Android setup field. Do not add Python runtime setup, provider lists, browser configuration, long prompt templates, or external agent frameworks.

Run offline regression, type, lint, renderer/main/preload builds, and isolated desktop IPC checks. Actual inference requires an explicitly available test device and authenticated ChatGPT account. Keep live test evidence separate from mock results and distinguish visual failure from unverified infrastructure errors.

See docs/NATIVE_QA_HARNESS.md and docs/SIMPLIFICATION_PLAN.md.
