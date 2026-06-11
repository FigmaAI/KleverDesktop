# Klever Desktop macOS Native Rebuild Plan

작성일: 2026-06-12
상태: 조사 및 의사결정 문서
기준 문서: `WINDOWS_NATIVE_REBUILD_PLAN.md`
목표: macOS 네이티브 리빌드 착수 전, Electron/Python/AppAgent/LiteLLM 기반 구조를 어떻게 제거하고 App Store sandbox를 고려한 macOS 네이티브 자동화 앱으로 재설계할지 정리한다.

## 1. 요약

Klever Desktop의 macOS 리빌드는 Electron UI를 SwiftUI로 단순 이식하는 작업이 아니다. 현재 앱의 무게와 반응성 문제는 UI 프레임워크 하나에서만 생긴 것이 아니라, Electron 앱셸, Node IPC bridge, Python runtime, virtualenv, AppAgent 스크립트, LiteLLM provider abstraction, Playwright browser 설치, stdout 기반 progress streaming이 한 제품 안에 함께 묶인 데서 온다.

새 방향은 다음과 같다.

- Electron, React, shadcn/ui, Tailwind, Node main/preload IPC를 제거한다.
- Python runtime downloader, virtualenv manager, `engines/appagent`, `engines/browser_use`, LiteLLM을 제거한다.
- macOS 앱셸은 SwiftUI + AppKit + Swift Concurrency 기반으로 재작성한다.
- AppAgent의 순차 자동화 루프는 Swift service layer로 내재화한다.
- Web 자동화는 Safari WebDriver, Chrome DevTools Protocol, macOS Accessibility API 조합으로 재설계한다.
- Android 자동화는 Swift `Process` 기반 ADB wrapper로 대체한다.
- Cloud LLM provider/API key 중심 UX는 제거하고, Hugging Face 로컬 모델 중심 UX로 단순화한다.
- 로컬 모델 런타임은 MLX/MLX Swift를 1차 네이티브 경로로 두고, vLLM/vLLM-Metal은 사용자가 별도로 실행하는 external local runtime으로 연동한다.
- Mac App Store sandbox를 우선 설계 기준으로 삼되, 외부 브라우저/ADB/로컬 런타임 제약이 App Review에서 막힐 경우 notarized direct distribution fallback을 유지한다.

이번 문서는 구현 코드가 아니라, macOS 네이티브 리빌드를 시작할 때 기준으로 삼을 조사/설계 문서다.

## 2. 현재 구조 분석

### 2.1 Electron/React 앱셸

현재 앱은 다음 층으로 나뉜다.

- Renderer: React + TypeScript + shadcn/ui + Tailwind 기반 UI
- Main/Preload: Electron IPC bridge, 파일/프로세스/설정/다이얼로그 처리
- Python backend: `core`, `engines/appagent`, `engines/browser_use` 실행

Renderer는 본질적으로 다음 역할을 한다.

- 프로젝트/작업 목록 표시
- 작업 생성/실행/중지/삭제 UX
- 설정 저장 UX
- setup wizard
- 로그 terminal drawer
- markdown report viewer
- model/provider 설정

Electron main/preload는 renderer와 OS/Python 사이의 bridge 역할을 한다.

- `config.json`, `projects.json` 저장 및 migration
- Python runtime 다운로드와 venv 생성
- Python subprocess spawn/kill
- stdout/stderr streaming
- ADB, Playwright, Ollama, Google login 관련 helper 호출
- 파일 읽기, 이미지 읽기, 폴더 열기, 외부 URL 열기
- schedule queue 관리

macOS 네이티브 리빌드에서는 이 bridge가 필요 없다. Swift 앱 내부에서 UI, storage, process, automation, scheduling을 같은 프로세스 또는 명확한 service layer로 관리할 수 있다.

### 2.2 Python/AppAgent의 실제 책임

`appagent`는 유지해야 할 독립 제품이라기보다 여러 책임이 섞인 순차 자동화 스크립트에 가깝다. 핵심 책임은 다음이다.

- 화면 캡처
- UI element 추출
- screenshot 라벨링과 grid overlay
- task goal과 screenshot을 VLM에 전달
- VLM 응답을 action으로 파싱
- Android/Web controller 실행
- before/after reflection
- screenshot, markdown report, metrics 저장

핵심 실행 루프는 다음처럼 정리할 수 있다.

```text
Observe -> Annotate -> Think -> Act -> Reflect -> Persist
```

이 루프 자체는 유지할 가치가 있다. 하지만 Python 구현, AppAgent 프로젝트 구조, LiteLLM wrapper를 유지할 필요는 없다.

### 2.3 현재 구조의 macOS 문제

현재 macOS 배포는 Electron Forge 기반 Developer ID notarization을 전제로 한다. `build/entitlements.mac.plist`에는 Electron/V8과 Python/native module을 위해 다음 권한이 열려 있다.

- `com.apple.security.cs.allow-jit`
- `com.apple.security.cs.allow-unsigned-executable-memory`
- `com.apple.security.cs.allow-dyld-environment-variables`
- `com.apple.security.cs.disable-library-validation`

동시에 sandbox entitlement는 꺼져 있다. 즉 현재 구조는 Mac App Store 제출을 전제로 하지 않는다.

Python을 포함한 현재 방식은 macOS에서 다음 비용을 만든다.

- Python runtime 다운로드 및 검증
- virtualenv 생성과 패키지 설치
- Playwright browser 설치
- Python path/import 문제
- subprocess stdout/stderr parsing
- YAML config와 Electron config 사이의 bridge
- LiteLLM 의존성 및 provider별 예외 처리
- OpenCV/Pillow/pyshine 등 이미지 처리 패키지 설치
- App Sandbox와 충돌하기 쉬운 외부 프로세스/파일 접근

Python을 제거하면 다음을 단순화할 수 있다.

- setup wizard가 "Python 설치" 중심에서 "로컬 모델/브라우저/Android SDK 상태" 중심으로 바뀐다.
- 작업 실행이 subprocess script execution이 아니라 Swift service 실행으로 바뀐다.
- progress event가 stdout parsing이 아니라 typed event stream으로 바뀐다.
- config schema가 env var mapping 없이 직접 사용된다.
- App Store sandbox entitlement 설계를 처음부터 반영할 수 있다.

## 3. macOS 네이티브 앱 방향

### 3.1 UI/app shell

권장 스택:

- SwiftUI
- AppKit bridge
- Swift Concurrency
- Observation 또는 MVVM
- Swift Package Manager
- OSLog
- SwiftData 또는 SQLite

주요 UI 방향:

- macOS 생산성 도구 스타일
- `NavigationSplitView` 기반 좌측 탐색
- `Toolbar` 기반 주요 action
- `Settings` scene 기반 설정
- 프로젝트/작업은 master-detail layout
- 로그는 dockable inspector 또는 bottom log pane
- local model library 전용 화면 추가
- screenshot/report viewer는 native scroll/zoom UX로 제공

초기 화면은 마케팅/랜딩이 아니라 실제 작업 대시보드여야 한다.

### 3.2 Web 자동화

사용자 의사결정상 Web v1은 embedded `WKWebView`가 아니라 외부 브라우저 제어를 유지한다. 대상은 Safari + Chrome이다.

권장 구현:

- Safari: `safaridriver`/WebDriver 기반 제어를 우선 검토한다.
- Chrome: Chrome DevTools Protocol 또는 ChromeDriver 기반 제어를 우선 검토한다.
- 공통 observation: screenshot, accessibility tree, DOM snapshot, active URL/title을 수집한다.
- 공통 action: click, type, scroll, navigate, back, wait, finish를 typed action으로 실행한다.
- 좌표 action은 VLM fallback으로 유지하되, 가능하면 DOM/accessibility locator를 우선한다.

주의점:

- Safari remote automation은 사용자가 명시적으로 허용해야 할 수 있다.
- Chrome automation은 사용자의 기존 profile을 건드리지 않는 별도 automation profile을 기본값으로 둔다.
- Mac App Store sandbox에서는 외부 브라우저 제어, Apple Events, Automation 권한 요청이 App Review 리스크가 될 수 있다.
- App Store v1에서 외부 브라우저 자동화가 막히면 notarized direct build에서 전체 기능을 제공하고, App Store build는 기능 축소를 검토한다.

### 3.3 Android 자동화

Android 자동화는 Python 의존이 아니라 ADB CLI 의존이다. 따라서 Swift `Process` wrapper로 대체 가능하다.

기존 기능:

- ADB path 탐색
- device list
- emulator list/start/stop
- boot wait
- screenshot capture/pull
- `uiautomator dump`
- XML parsing
- tap/text/swipe/long_press/back
- APK package name 추출
- APK install
- Play Store URL package id parsing
- Google account login helper

Swift 구현 방향:

- `AdbService`: command execution, timeout, stdout/stderr capture
- `AndroidDeviceService`: device/emulator discovery
- `AndroidScreenReader`: screenshot + UI XML dump
- `AndroidInputController`: tap/text/swipe/back
- `ApkService`: APK install, package detection, Play Store URL parsing

주의점:

- Android SDK/ADB는 앱 번들에 넣지 않고 사용자가 선택한 SDK 경로를 security-scoped bookmark로 저장한다.
- `adb shell input text`는 escaping 문제가 많으므로 별도 테스트 대상이다.
- `uiautomator dump` XML은 namespace/attribute 변동에 대비해 robust parser를 둔다.
- Emulator 실행과 외부 executable 호출은 App Store sandbox에서 리스크가 있으므로 direct distribution fallback을 유지한다.

### 3.4 이미지 라벨링, 그리드, 리포트

Python의 OpenCV/Pillow/pyshine 역할은 Swift 이미지 처리로 대체한다.

후보:

- CoreGraphics
- CoreImage
- Vision
- AppKit image drawing

권장:

- v1은 CoreGraphics/AppKit drawing으로 라벨, bbox, circle, arrow, grid overlay를 구현한다.
- Vision은 OCR 또는 element recognition 보조 기능으로만 검토한다.

기능:

- screenshot resize/quality optimization
- element bbox label drawing
- grid overlay drawing
- action marker drawing
- before/after image table markdown 생성
- step report markdown 생성

## 4. 로컬 모델 런타임 조사

### 4.1 요구사항 재정의

중요한 목표는 "API provider를 더 많이 붙이는 것"이 아니다. 실제 요구사항은 다음이다.

- Hugging Face에 올라온 로컬 모델을 사용자가 선택할 수 있어야 한다.
- Web/Android 화면 screenshot을 image input으로 넣을 수 있어야 한다.
- VLM이 action JSON을 반환할 수 있어야 한다.
- macOS 네이티브 앱과 App Store sandbox 환경에서 과도하게 충돌하지 않아야 한다.
- Cloud API key 없이 동작해야 한다.

따라서 런타임 평가는 provider 이름이 아니라 모델 포맷, Apple Silicon 실행 가능성, sandbox 적합성으로 나눈다.

### 4.2 MLX / MLX Swift

판단: v1의 1차 네이티브 런타임 후보.

장점:

- Apple Silicon unified memory와 잘 맞는다.
- Swift 앱 안에 inference layer를 넣는 방향과 가장 자연스럽다.
- Hugging Face의 MLX community 모델 생태계와 연결된다.
- Python server를 앱에 포함하지 않아도 된다.
- App Store sandbox 설계와 가장 잘 맞는다.

제약:

- 모든 Hugging Face 모델을 그대로 실행하는 것이 아니다. MLX 변환 또는 MLX 지원 모델이어야 한다.
- VLM 지원은 모델별로 검증해야 한다.
- 대형 모델은 메모리 요구가 크므로 Apple Silicon minimum spec을 정해야 한다.
- 모델별 prompt template, tokenizer, processor handling이 필요하다.

권장 역할:

- v1 기본 내장 local inference path.
- 앱은 verified MLX VLM list를 제공한다.
- 사용자는 Hugging Face repo를 검색하되, 실행 가능 여부를 compatibility badge로 확인한다.

### 4.3 vLLM / vLLM-Metal

판단: 기본 내장 런타임이 아니라 external local runtime option.

이유:

- vLLM-Metal은 Apple Silicon 지원 방향이 생겼지만, 앱 내부에 Python/vLLM 환경을 묶으면 "Python 제거" 목표와 충돌한다.
- Mac App Store 앱이 venv, native extension, server process, 대형 model cache를 직접 관리하는 것은 review와 UX 리스크가 크다.
- vLLM은 고성능 serving runtime으로 강하지만, consumer macOS 앱의 기본 내장 엔진으로는 설치/권한/패키징 부담이 크다.

vLLM은 다음 경우에 지원한다.

- 사용자가 이미 로컬에서 vLLM/vLLM-Metal server를 실행하고 있다.
- 앱은 localhost OpenAI-compatible endpoint로만 연결한다.
- 이 연결은 cloud provider가 아니라 local runtime으로 분류한다.
- v1에서는 advanced 설정으로 노출하고, 기본 onboarding에는 넣지 않는다.

### 4.4 llama.cpp / GGUF

판단: MLX와 병행 검토할 현실적인 local model 경로.

장점:

- GGUF 모델 생태계가 Hugging Face에 많다.
- `llama-server`는 OpenAI-compatible API를 제공한다.
- multimodal image input 지원이 있다.
- Python/venv 없이 실행 가능하다.
- Apple Silicon Metal acceleration 경로가 있다.

제약:

- Hugging Face 원본 `safetensors`를 그대로 실행하는 것이 아니다. GGUF 변환 모델 또는 llama.cpp 지원 모델이어야 한다.
- VLM 모델마다 mmproj 등 추가 artifact가 필요할 수 있다.
- OpenAI-compatible API의 structured output/tool calling 호환성은 모델과 서버 버전에 따라 달라질 수 있다.

권장 역할:

- MLX 지원이 부족한 모델을 위한 secondary local runtime.
- App Store build에서는 bundled executable 포함 가능성과 sandbox 적합성을 별도 검증한다.
- direct distribution build에서는 companion process 방식도 허용한다.

### 4.5 외부 OpenAI-compatible local runtime

판단: cloud provider UX가 아니라 local runtime escape hatch.

지원 대상:

- 사용자가 직접 띄운 vLLM/vLLM-Metal server
- 사용자가 직접 띄운 llama.cpp server
- 사용자가 직접 띄운 Ollama 또는 LM Studio
- 기타 localhost OpenAI-compatible endpoint

설정 필드:

- endpoint URL
- model id
- vision support flag
- max context
- structured JSON support 여부

v1 기본 UX에서는 API key provider table을 제거한다. API key는 cloud provider 연결용으로 쓰지 않으며, 필요한 경우 local endpoint token 정도만 advanced option으로 둔다.

## 5. 리빌드 아키텍처

### 5.1 Package structure

권장 구성:

```text
KleverDesktop.xcodeproj
├── KleverDesktopApp
├── KleverCore
├── KleverAutomation
├── KleverLocalModels
├── KleverStorage
├── KleverPlatform
└── KleverTests
```

### 5.2 Module responsibilities

`KleverDesktopApp`

- SwiftUI app entry
- navigation
- views
- view models
- dialogs
- local model library UI
- task dashboard
- logs/report viewer

`KleverCore`

- domain models
- task state machine
- action schema
- model runtime abstraction
- shared result/error types

`KleverAutomation`

- `AgentRunner`
- `AutomationTarget`
- `ObservationService`
- `AnnotationService`
- `ActionExecutor`
- `ReflectionService`
- report generation
- progress event stream

`KleverLocalModels`

- `LocalModelRuntime`
- `MLXRuntime`
- `ExternalOpenAICompatibleRuntime`
- optional `LlamaCppRuntime`
- Hugging Face model search/cache metadata
- prompt formatting
- JSON response validation/retry

`KleverStorage`

- app config
- projects/tasks
- guided import from current `~/.klever-desktop`
- security-scoped bookmarks
- model cache metadata

`KleverPlatform`

- shell/open folder
- process runner
- file system helper
- Android SDK/ADB discovery
- Safari/Chrome automation adapters
- TCC permission checks

`KleverTests`

- unit tests
- integration tests
- local runtime smoke tests

### 5.3 Core interfaces

Automation target:

```swift
protocol AutomationTarget {
    func observe() async throws -> Observation
    func execute(_ action: AutomationAction) async throws -> ActionExecutionResult
    func close() async
}
```

Local model runtime:

```swift
protocol LocalModelRuntime {
    func status() async -> ModelRuntimeStatus
    func generate(_ request: ModelRequest) async throws -> ModelResponse
}
```

Agent runner:

```swift
protocol AgentRunner {
    func run(_ request: TaskRunRequest) -> AsyncThrowingStream<AgentEvent, Error>
}
```

Action schema:

```text
FINISH
tap(element)
text(text)
long_press(element)
swipe(element, direction, distance)
grid()
tap_grid(area, subarea)
long_press_grid(area, subarea)
swipe_grid(start_area, start_subarea, end_area, end_subarea)
back()
```

v1에서는 기존 AppAgent 호환 action set을 유지한다. 이후 web target에서는 locator 기반 action과 semantic UI action을 확장한다.

## 6. App Store sandbox 전략

### 6.1 기본 원칙

macOS 리빌드는 처음부터 sandbox를 켠 상태로 설계한다.

기본 방향:

- App Store build는 sandbox entitlement를 켠다.
- 필요한 file access는 user-selected directory + security-scoped bookmark로 처리한다.
- 모델 cache는 app container 내부를 기본값으로 둔다.
- Android SDK, project export folder 등 외부 경로는 사용자가 직접 선택하게 한다.
- 외부 브라우저/ADB/로컬 런타임 제어는 permission diagnostics 화면에서 명시한다.

### 6.2 필요한 권한과 리스크

예상 권한:

- App Sandbox
- Network client/server for localhost runtime
- User-selected file read/write
- Downloads 또는 app container model cache
- Accessibility permission for UI automation fallback
- Automation/Apple Events if Safari/Chrome control requires it

리스크:

- 외부 브라우저 자동화는 App Store Review에서 민감하게 볼 수 있다.
- ADB/emulator process 실행은 sandbox와 review 모두에서 리스크가 있다.
- vLLM/vLLM-Metal 같은 외부 server 연동은 localhost network permission과 사용자 설명이 필요하다.
- 대형 모델 다운로드와 실행은 App Store 앱의 용량/리소스 기대와 충돌할 수 있다.

대응:

- App Store build와 notarized direct build를 feature flag로 분리할 수 있게 설계한다.
- App Store build는 verified MLX local runtime과 user-selected files 중심으로 먼저 검증한다.
- 외부 자동화 기능이 review에서 막히면 direct build에서 full automation을 제공한다.

## 7. UX 방향

### 7.1 삭제할 UX

다음 UX는 Python/cloud API 중심 구조라 제거한다.

- Python runtime download card
- venv/package install logs
- LiteLLM provider list
- API key provider table
- cloud provider cost estimation 중심 UI
- config -> env var mapping 노출
- AppAgent sync/update UX
- Browser-use Python setup UX

### 7.2 새로 만들 UX

새 UX:

- Local Model Library
- Hugging Face model search
- Model compatibility checker
- MLX/GGUF/external runtime badge
- model download/cache manager
- hardware capability view: Apple Silicon, unified memory, available RAM, Neural Engine availability
- automation target setup: Safari, Chrome, Android SDK/ADB
- permission diagnostics: Accessibility, Automation, Files, Local Network
- task run trace viewer: Observe/Think/Act/Reflect timeline

### 7.3 주요 화면

Projects

- project list
- platform badge: Web/Android
- task status summary
- last run

Task List

- status
- progress rounds
- local model runtime
- target URL/APK
- run duration

Task Detail

- timeline
- screenshots
- action reasoning
- report markdown
- logs
- rerun/stop/schedule

Local Models

- installed models
- compatible Hugging Face models
- MLX/GGUF/external runtime filter
- storage usage
- benchmark/status

Settings

- Local Models
- Automation Targets
- Permissions
- Execution
- Storage
- Diagnostics

## 8. 단계별 로드맵

### Phase 0: 조사와 PoC 확정

목표:

- MLX/MLX Swift가 실제 VLM screenshot action loop에 충분한지 검증한다.
- vLLM/vLLM-Metal을 external local endpoint로 안정적으로 연결할 수 있는지 검증한다.
- App Store sandbox에서 model cache, security-scoped bookmark, localhost server, external browser control, ADB process 실행 제약을 확인한다.

산출물:

- runtime comparison matrix
- verified local VLM list
- minimum hardware recommendation
- App Store sandbox feasibility note
- Web/Android automation API design draft

검증할 모델 예시:

- MLX VLM: MLX community 또는 Apple 예제에서 지원되는 vision model
- External vLLM/vLLM-Metal: localhost OpenAI-compatible vision-capable model
- GGUF multimodal: llama.cpp가 지원하는 vision model

### Phase 1: Local model runner PoC

목표:

- `LocalModelRuntime` 구현체 2개를 만든다.
- `MLXRuntime`으로 image + prompt -> action JSON을 받는다.
- `ExternalOpenAICompatibleRuntime`으로 localhost vLLM/vLLM-Metal endpoint를 검증한다.

작업:

- model cache directory 정의
- HF repo download/search strategy 정의
- MLX model folder validation
- external endpoint validation
- JSON schema prompt/retry 구현
- streaming token/progress event 구현

성공 기준:

- screenshot 한 장과 task goal을 넣어 `tap`, `text`, `FINISH` 중 하나를 typed action으로 parse한다.
- Python/AppAgent/LiteLLM 없이 동작한다.

### Phase 2: Web automation native loop

목표:

- Safari + Chrome 외부 브라우저 자동화 루프를 구현한다.
- 기존 Google smoke scenario 수준의 Web task를 Python 없이 실행한다.

작업:

- Safari automation availability check
- Chrome automation profile/session
- screenshot capture
- DOM/accessibility element extraction
- label overlay
- action execution
- markdown report generation

성공 기준:

- Web task가 `Observe -> Annotate -> Think -> Act -> Reflect -> Persist`를 최소 2 round 이상 실행한다.
- task result folder가 기존과 유사한 artifact를 생성한다.

### Phase 3: Android automation native loop

목표:

- Swift ADB wrapper로 Android 자동화 루프를 구현한다.

작업:

- Android SDK/ADB detection
- security-scoped SDK path bookmark
- device/emulator list
- screenshot pull
- UI XML dump
- interactive element extraction
- input action execution
- APK install/prelaunch

성공 기준:

- emulator 또는 physical device에서 screenshot/XML을 읽고 labeled image를 생성한다.
- tap/text/swipe action을 실행한다.
- Python 없이 Android task smoke run이 가능하다.

### Phase 4: macOS product shell

목표:

- 실제 macOS 네이티브 앱 UI를 구현한다.

작업:

- navigation shell
- projects/tasks storage
- create project/task dialogs
- local model library
- task run viewer
- settings
- log panel
- report viewer

성공 기준:

- 사용자 플로우: 모델 준비 -> 프로젝트 생성 -> 작업 생성 -> 실행 -> report 확인.

### Phase 5: Packaging/App Store 검증

목표:

- 배포 형태를 확정한다.

검토 항목:

- App Store sandbox entitlement
- notarized direct distribution fallback
- model cache 위치
- external browser automation permission
- ADB/external executable 실행 가능성
- local runtime localhost network 권한
- Apple Silicon-only v1 여부

성공 기준:

- clean macOS machine에서 설치/실행 가능.
- App Store build에서 허용 가능한 기능 범위와 direct build의 full automation 범위를 명확히 분리한다.

## 9. 데이터 이전 전략

### 9.1 기본 방침

기존 `~/.klever-desktop` 데이터는 자동 마이그레이션하지 않고 가이드 방식으로 이전한다.

대상:

- `projects.json`
- `config.json`
- 기존 task result folder
- screenshot/report artifact

이전하지 않는 항목:

- Python runtime
- `python-env`
- LiteLLM provider/API key 설정
- AppAgent/browser-use engine cache
- Playwright browser cache

### 9.2 UX

첫 실행 또는 Settings에서 "Import from existing Klever Desktop"을 제공한다.

동작:

- 사용자가 기존 `~/.klever-desktop` 위치를 직접 선택한다.
- 앱은 readable project/task metadata만 preview한다.
- 가져올 project를 사용자가 선택한다.
- 기존 report/screenshot은 read-only reference로 연결하거나 새 storage로 복사한다.
- cloud provider/API key 설정은 가져오지 않는다.

성공 기준:

- 기존 task history를 참고할 수 있다.
- 새 task 실행은 반드시 native local model/runtime 설정을 사용한다.

## 10. 위험과 대응

### 10.1 Hugging Face 모델 포맷 다양성

위험:

- Hugging Face에는 safetensors, MLX, GGUF, ONNX, AWQ, GPTQ 등 포맷이 섞여 있다.
- 모든 모델을 직접 실행할 수 없다.

대응:

- v1은 compatible model만 지원한다.
- Model Library에서 format/compatibility를 명확히 표시한다.
- "HF repo를 넣으면 항상 실행된다"는 UX를 피한다.

### 10.2 VLM multimodal 지원 편차

위험:

- 같은 LLM이라도 vision variant, projector, processor config가 다르다.
- action JSON 안정성이 모델마다 다르다.

대응:

- verified model list를 제공한다.
- prompt template을 runtime/model별로 분리한다.
- JSON validation + retry + fallback parser를 둔다.

### 10.3 App Store sandbox 제약

위험:

- external browser control, ADB, local server, external process 실행이 App Review에서 막힐 수 있다.

대응:

- App Store build와 direct distribution build를 분리 가능한 구조로 만든다.
- Phase 0에서 sandbox PoC를 먼저 수행한다.
- App Store build의 기능 축소 가능성을 문서화한다.

### 10.4 로컬 모델 성능과 하드웨어 요구

위험:

- VLM은 메모리와 GPU 요구가 높다.
- CPU-only 또는 Intel Mac 환경에서는 UX가 느릴 수 있다.

대응:

- v1은 Apple Silicon-only를 기본 가정으로 둔다.
- 작은 verified model부터 지원한다.
- model card에 예상 메모리와 성능 등급을 표시한다.
- action loop timeout과 cancellation을 명확히 제공한다.
- local runtime benchmark를 setup flow에 포함한다.

### 10.5 vLLM을 둘러싼 기대치

위험:

- 사용자가 "vLLM 지원"을 앱이 vLLM 환경을 자동 설치하고 관리한다는 뜻으로 이해할 수 있다.
- vLLM-Metal은 Python/runtime setup 부담이 있어 "완전 네이티브 앱" 목표와 충돌할 수 있다.

대응:

- v1에서 vLLM/vLLM-Metal은 external local endpoint로만 명확히 표기한다.
- 기본 내장 runtime은 MLX/MLX Swift로 둔다.
- 앱 내부 Python/venv 관리는 다시 도입하지 않는다.

## 11. 제거 대상 목록

리빌드에서 제거할 항목:

- Electron
- React renderer
- shadcn/ui
- Tailwind
- Electron preload IPC API
- Node main handlers
- Python runtime downloader
- virtualenv manager
- `appagent/scripts` runtime execution
- `browser_use` Python runtime execution
- LiteLLM dependency
- YAML config bridge
- Python Playwright
- OpenCV/Pillow/pyshine Python image stack
- cloud provider/API key 중심 model settings

단, 다음 지식은 유지한다.

- AppAgent의 순차 action/reflection loop
- labeled screenshot prompt 방식
- grid fallback 방식
- before/after report 방식
- task/project storage 개념
- Web/Android automation target 개념

## 12. 초기 의사결정

확정:

- macOS 네이티브 리빌드는 SwiftUI + AppKit + Swift Concurrency를 기본으로 한다.
- Python/AppAgent는 유지하지 않고 기능을 내재화한다.
- LiteLLM과 cloud provider/API key UX는 제거한다.
- v1 자동화 대상은 Web + Android로 유지한다.
- Web v1은 Safari + Chrome 외부 브라우저 제어를 유지한다.
- Android v1은 physical device + emulator를 동일하게 지원한다.
- Hugging Face 로컬 모델 중심으로 간다.
- MLX/MLX Swift를 기본 local runtime 후보로 둔다.
- vLLM/vLLM-Metal은 기본 내장 런타임이 아니라 external local runtime option으로 둔다.
- App Store sandbox를 우선 목표로 하되, notarized direct distribution fallback을 유지한다.
- 기존 데이터는 guided migration으로 이전한다.

미확정:

- App Store build에서 외부 브라우저 자동화를 어느 범위까지 허용할 수 있는지
- ADB/emulator 실행이 App Store build에서 허용 가능한지
- MLX VLM을 v1 기본 runtime으로 둘 수 있을 만큼 모델 지원이 충분한지
- llama.cpp를 App Store build에 포함할지 direct build에서만 제공할지
- verified model list의 초기 모델

## 13. 참고 자료

- macOS App Sandbox: https://developer.apple.com/documentation/security/app-sandbox
- Configuring the macOS App Sandbox: https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox
- Accessing files from the macOS App Sandbox: https://developer.apple.com/documentation/security/accessing-files-from-the-macos-app-sandbox
- Accessibility API: https://developer.apple.com/documentation/accessibility/accessibility-api
- Accessibility Programming Guide for OS X: https://developer.apple.com/library/archive/documentation/Accessibility/Conceptual/AccessibilityMacOSX/
- Foundation Process: https://developer.apple.com/documentation/foundation/process
- MLX on Apple silicon: https://opensource.apple.com/projects/mlx/
- WWDC25 MLX LM: https://developer.apple.com/videos/play/wwdc2025/298/
- MLX Swift: https://github.com/ml-explore/mlx-swift
- Hugging Face MLX: https://huggingface.co/docs/hub/en/mlx
- vLLM install: https://docs.vllm.ai/en/latest/getting_started/installation/
- vLLM Metal: https://github.com/vllm-project/vllm-metal
- llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- llama.cpp multimodal: https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md
- Hugging Face GGUF usage: https://huggingface.co/docs/hub/en/gguf-llamacpp
- Android Debug Bridge: https://developer.android.com/tools/adb
