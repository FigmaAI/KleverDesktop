# Klever Desktop

Native Android QA with ChatGPT: save a test course, run it against app builds, and keep the evidence.

## Use the app

1. Open Settings and sign in with ChatGPT.
2. Connect an Android device or start an existing emulator from Settings. The Android SDK is detected automatically; its folder can be supplied when needed.
3. Save a short test goal and choose an installed app, APK, or Play Store package.
4. Run or schedule the test. Open its result to read the familiar round-by-round Markdown report, or select Terminal for its progress and saved output.
5. Repeat a test against a new build. Earlier verified intentions guide the next run, while every action is chosen from the current screen.

AI access uses [Sign in with ChatGPT for local open-source apps](https://developers.openai.com/siwc/token-sharing-open-source), through OpenAI's official local DevKit. Its React components supply the sign-in, account connection and usage interface. Screenshots and the goal go directly to OpenAI using the account's available models and limits. No Platform API key is required.

The app executes ADB and the emulator directly from Electron. The official OpenAI Node SDK sends screenshots and requests one strict function call with JSON Schema parameters. The app validates the decision before issuing a native command. Python, AppAgent, local models, third-party model providers, and browser automation are not part of the runtime.

## Records and schedules

Saved definitions and run snapshots are separate internally. Each run retains the actual installed app version, device metadata, structured actions, screenshots, final visual assessment, and a readable Markdown report. The interface keeps the task list and Markdown result experience. Report and Terminal are two tabs on the result page. App failures and unverified execution errors are recorded separately.

Completed snapshots stay unchanged. Explicitly deleting a test removes its result files, run manifest and list entry while preserving other tests' shared data.

Projects and canonical run manifests are stored under `~/.klever-desktop/`. Evidence is kept in the project workspace. Existing Android results remain available, and legacy browser records are retained as inactive data.

The app must remain running for schedules to execute. OS wake/launch, iOS adapters, and a desktop MCP transport are separate follow-ups to the shared course/run API.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build:local
npm run test:desktop
npm run electron
```

Use `npm run start` for development with hot reload, or `npm run package` / `npm run make` for distribution builds. Node.js 22.12 or later is required to build the app; the app uses current Electron and React 19. Native execution requires Android SDK tools and an eligible ChatGPT account.

The current Electron build requires macOS 13 or later. Windows distribution targets 64-bit systems.

On macOS, development launch and isolated desktop tests automatically use a cached, locally sealed copy of the official Electron runtime on the internal temporary volume. The helper verifies the release archive checksum and preserves the runtime's identifiers, entitlements and security settings. It does not use personal signing certificates or change Keychain/TCC. The original download stays untouched; production packaging continues to use the existing Forge signing/notarization configuration. `npm run prepare:electron-runtime` prepares or verifies this development copy without opening the app. An explicitly supplied `ELECTRON_OVERRIDE_DIST_PATH` is verified and reused.

```text
src/        Projects, courses, run history, schedules, account/Android setup
main/       ChatGPT OAuth, strict JSON inference, direct ADB driver, run storage
scripts/    Build, isolated Electron regression, bundle verification, distribution
tests/      Offline transport, agent, storage, scheduling, and authentication tests
```

See [the harness design](docs/NATIVE_QA_HARNESS.md), [next stages](docs/SIMPLIFICATION_PLAN.md), and [privacy policy](PRIVACY.md).

## License and official DevKit

Klever's independently authored code retains its [MIT license](LICENSE). The bundled [OpenAI Sign in with ChatGPT DevKit](https://github.com/openai/sign-in-with-chatgpt-devkit) has a separate [Noncommercial License](vendor/sign-in-with-chatgpt-devkit/LICENSE). This build is for personal noncommercial experimentation. The DevKit license excludes development, testing or operation for a business, employer or client, even when no fee is charged. Upstream attribution, third-party notices and local modification records are retained in the vendor directory.

The [official component gallery](https://github.com/openai/sign-in-with-chatgpt-devkit/blob/main/examples/component-gallery/src/Gallery.tsx) demonstrates sign-in buttons, account connection cards, composer usage indicators and usage management. It does not contain a general chat transcript interface; Klever keeps the saved test goal and run history as its work interface.
