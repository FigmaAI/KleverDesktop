# Utility scripts

- build-local.cjs builds the renderer, Electron main process, and preload without packaging or signing.
- electron-runtime.cjs verifies the official Electron archive and prepares a cached, ad-hoc sealed macOS development copy on the internal temporary volume. Existing security metadata is retained; no private certificates or account settings are accessed.
- electron-launch.cjs uses that development runtime for npm start and npm run electron. Windows/Linux retain the standard Electron executable.
- test-account-ui.cjs verifies official ChatGPT component callbacks against mock IPC in a disposable renderer.
- test-desktop.cjs runs actual preload/renderer IPC against isolated disposable data, with network and native execution blocked.
- verify-bundle.js checks generated application files before packaging.
- Icon, cask, and release scripts support distribution.

Run npm run build:local, npm run test:desktop, npm run test:account-ui, and npm run verify:bundle. Electron is downloaded and verified automatically when the development cache is first prepared; no additional interpreter setup is required.

On macOS, npm start, npm run electron and both desktop regressions share the verified development runtime. npm run prepare:electron-runtime performs only archive/signature preparation and verification, without launching a GUI. Set ELECTRON_OVERRIDE_DIST_PATH to reuse a previously prepared copy; its version and complete bundle signature must validate. Packaging/make/publish keep Forge's existing production signing flow.
