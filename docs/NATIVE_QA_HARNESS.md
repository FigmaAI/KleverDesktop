# A small native QA harness

## What changed

The earlier runtime combined provider transport, prompt interpretation, Android tools, screenshots, and report generation inside a second language environment. That added installation and process lifecycle work to every desktop user, even though the app now has one AI account path and one native target platform.

The old agent output was natural-language action text. Its parser and formatting retries were another runtime contract the model had to satisfy, alongside a large prompt. Element grids and old coordinate-based documentation also mixed screen understanding with persistence.

The replacement keeps those responsibilities narrow: Electron owns the job and records; Android SDK tools own device operations; ChatGPT returns a schema-constrained decision. No agent framework or secondary runtime is necessary.

OpenAI's local Sign in with ChatGPT DevKit owns OAuth and profile storage. Its React components own account/usage UI. The official `openai` Node SDK owns inference transport. The runtime baseline is Node 22.12+, current Electron and React 19 rather than retaining the earlier application's Node/React constraints. The vendored DevKit has its separate noncommercial license and pinned upstream provenance.

## Decision loop

1. Prepare the selected app and detect its actual installed version/device.
2. Capture the full-resolution screen using ADB, directly into the run directory.
3. Send the goal, current screenshot, and bounded recent observations through the official OpenAI Node SDK, requesting one strict namespaced function call.
4. Validate the complete JSON decision, including its action/assessment relationship and current screen bounds.
5. Execute one supported native action, checkpoint it, and capture the resulting screen.
6. Assess the screen after the final permitted action, then finish only with an explicit visual assessment, or retain an unverified error/cancellation.

The prompt is four sentences in main/utils/android-agent.ts. The function's JSON schema carries output requirements; it does not require a long prose action tutorial. Navigation uses visible controls and scrolling; text input is reserved for goals that explicitly require entering text. Refusals, truncated responses, invalid arguments and impossible coordinates never become commands.

The recorded annotation is data: action coordinates and original screen size. Electron's native bitmap API saves a separate PNG with the tap marker or swipe arrow; original screenshots stay unchanged and no image-processing runtime is added. The user sees the original continuous Markdown report, with Task Description, Round, Observation, Thought, Action, Summary and Reflection sections. JSON is internal evidence, not a replacement report interface. Public action intent supplies the familiar Thought label.

The result page has two top tabs: Report and Terminal. Report renders Markdown and same-directory PNGs; Terminal shows only that run's live or saved output. The old floating bottom terminal has been removed.

## Repeating a course

A new run freezes the current course revision. Earlier successful action intentions and observed effects are optional guidance. Old pixel coordinates are excluded, and the current goal and screen stay authoritative. A supplied APK is installed even when the package is already present, while app data is retained. Version/build evidence describes the app actually tested.

Execution status and assessment differ: a model-confirmed app failure is failed; inability to verify because of an input/execution limit, transport, malformed output or cancellation stays unverified. A complete report is visual evidence rather than a claim of deterministic assertion replay.

## Official examples considered

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): strict function parameters, required properties, and refusal handling.
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling): schema-constrained commands for application tools.
- [GPT-6 Luna capabilities](https://developers.openai.com/api/docs/models/gpt-6-luna): image input and structured output support.
- [ChatGPT plan-usage restrictions](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations): the direct Responses contract and unavailable native computer-use tools; Android actions therefore remain local.
- [Android ADB documentation](https://developer.android.com/tools/adb): direct screenshot streams and targeted device operations.
- [OpenAI Android emulator QA example](https://github.com/openai/plugins/blob/main/plugins/test-android-apps/skills/android-emulator-qa/SKILL.md): observing the current emulator screen and issuing scoped ADB actions.

ChatGPT plan usage requires function tools to be namespaced. The SDK owns HTTP requests and SSE decoding; the app validates the single authorized function's finalized arguments and requires a completed response before executing them. Natural-language output never becomes a command. Live tests establish the actual account behavior.

## Current native boundary

Android SDK tools must already be available. Direct ADB text input accepts printable ASCII, but Android sends physical key events through the active input method: a Korean keyboard can transform even English input. Unsupported Unicode/control sequences fail clearly; successful command execution alone does not prove that the intended text appeared. The next screenshot supplies that evidence. SDK Build Tools are needed to detect a package from an APK unless its package name is supplied. Those are native SDK limits, without hidden helper APKs or another runtime.

## Verified integration

On 2026-10-04/05, the actual ChatGPT account and Android Settings on an Android 17 emulator completed the saved version-check scenario twice through the official SDKs. The manual run took 41.6 seconds and the scheduled run took 44.6 seconds, each with three native actions. The scheduler started the latter 3.3 seconds after its due time. It linked the prior successful recording, and all seven earlier artifacts, including its canonical manifest, stayed byte-identical. The account installation identifier and encrypted legacy recovery copy were preserved during SDK migration.

The new report rendered its traditional round sections and persisted action PNGs in the original Markdown reader. Its page-local Terminal displayed only the selected run's output. A disconnected-device scheduled attempt was separately retained as unverified, without claiming an app failure. Offline application tests (156), upstream DevKit tests (46), isolated Electron IPC checks (7), and account UI checks (5) passed, along with type, lint, build and bundle validation.
