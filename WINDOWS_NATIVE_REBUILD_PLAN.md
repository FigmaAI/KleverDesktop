# Klever Desktop Windows Native Rebuild Plan

작성일: 2026-06-11  
상태: 조사 및 의사결정 문서  
목표: Windows 네이티브 리빌드 착수 전, Electron/Python/AppAgent 기반 구조를 어떻게 제거하고 Windows 네이티브 자동화 앱으로 재설계할지 정리한다.

## 1. 요약

Klever Desktop의 다음 리빌드는 단순히 Electron UI를 WinUI로 옮기는 작업이 아니다. 현재 앱의 핵심 레거시는 Python 기반 `appagent` 실행 환경과 그 주변의 설치, 설정, 프로세스 관리, LiteLLM provider abstraction이다. 기존에는 AppAgent 프로젝트를 유지하면서 UI만 감싸는 구조였지만, AppAgent 자체가 더 이상 적극적으로 발전하지 않는 전제에서는 Python 엔진을 계속 끌고 갈 이유가 약하다.

새 방향은 다음과 같다.

- Electron, React, shadcn/ui, Node IPC, Python runtime, venv, `appagent`를 제거한다.
- Windows 앱셸은 WinUI 3 + Windows App SDK + C#/.NET 기반으로 재작성한다.
- AppAgent의 순차 자동화 루프는 C# 서비스로 내재화한다.
- Web 자동화는 Playwright .NET으로 대체한다.
- Android 자동화는 C# ADB wrapper로 대체한다.
- Cloud LLM provider/API key 중심 UX는 제거하고, Hugging Face 로컬 모델 중심 UX로 단순화한다.
- 로컬 모델 런타임은 "vLLM 하나"가 아니라, 실제 Windows 네이티브 배포 가능성과 Hugging Face 모델 포맷 호환성을 기준으로 GGUF/llama.cpp, ONNX/Windows ML, 외부 OpenAI-compatible runtime을 구분한다.

이번 문서는 구현 코드가 아니라, 나중에 Windows 네이티브 리빌드를 시작할 때 기준으로 삼을 조사/설계 문서다.

## 2. 현재 구조 분석

### 2.1 Electron/React 앱셸

현재 앱은 세 층으로 나뉜다.

- Renderer: React + TypeScript + shadcn/ui + Tailwind 기반 UI
- Main/Preload: Electron IPC bridge, 파일/프로세스/설정/다이얼로그 처리
- Python backend: `appagent/scripts` 자동화 실행

React renderer는 본질적으로 다음 역할을 한다.

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

Windows 네이티브 리빌드에서는 이 bridge가 필요 없다. C# 앱 내부에서 UI, storage, process, automation, scheduling을 같은 프로세스 또는 명확한 service layer로 관리할 수 있다.

### 2.2 Python `appagent`의 실제 책임

`appagent`는 거대한 독립 제품이라기보다, 여러 책임이 섞인 순차 자동화 스크립트에 가깝다. 핵심 파일은 다음이다.

- `self_explorer.py`: main automation loop
- `web_controller.py`: Playwright Python 기반 web 제어
- `and_controller.py`: ADB 기반 Android 제어
- `model.py`: LiteLLM/OpenAI-compatible 호출 및 응답 파싱
- `utils.py`: screenshot 라벨링, grid drawing, image optimization, markdown log helper
- `prompts.py`: action/reflection prompt template
- `config.py`: YAML + env override

핵심 실행 루프는 다음처럼 정리할 수 있다.

```text
Observe -> Annotate -> Think -> Act -> Reflect -> Persist
```

각 단계의 의미는 다음과 같다.

- Observe: 현재 화면을 캡처하고, 상호작용 가능한 요소 목록을 추출한다.
- Annotate: screenshot 위에 숫자 라벨 또는 grid overlay를 그린다.
- Think: labeled screenshot과 task goal을 VLM에 보내 다음 action을 JSON 또는 text function-call 형태로 받는다.
- Act: action을 platform별 controller로 실행한다. 예: tap, text, long_press, swipe, back.
- Reflect: before/after screenshot을 비교하도록 VLM에 요청해 action이 유효했는지 판단한다.
- Persist: step log, screenshot, labeled image, markdown report, metrics를 저장한다.

이 루프 자체는 유지할 가치가 있다. 하지만 Python 구현과 AppAgent 프로젝트 구조를 유지할 필요는 없다.

### 2.3 Python 의존성 제거 시 사라지는 비용

현재 Python 의존성은 다음 비용을 만든다.

- Python runtime 다운로드 및 검증
- virtualenv 생성
- `requirements.txt` 설치
- Playwright browser 설치
- Python path/import 문제
- Windows encoding 문제
- subprocess stdout/stderr parsing
- YAML config와 Electron config 사이의 bridge
- LiteLLM 의존성 및 provider별 예외 처리
- OpenCV/Pillow/pyshine 등 이미지 처리 패키지 설치
- appagent script path dev/prod 분기

Python을 제거하면 다음을 단순화할 수 있다.

- setup wizard가 "Python 설치" 중심에서 "로컬 모델/브라우저/Android SDK 상태" 중심으로 바뀐다.
- 작업 실행이 subprocess 기반 script execution이 아니라 C# service 실행으로 바뀐다.
- progress event가 stdout parsing이 아니라 typed event stream으로 바뀐다.
- config schema가 env var mapping 없이 직접 사용된다.
- 실패 지점이 줄어든다.

## 3. Windows 네이티브 앱 방향

### 3.1 UI/app shell

권장 스택:

- WinUI 3
- Windows App SDK
- C#/.NET
- MVVM 패턴
- CommunityToolkit.Mvvm
- Microsoft.Extensions.DependencyInjection
- Microsoft.Extensions.Logging

주요 UI 방향:

- Windows 11 생산성 도구 스타일
- `NavigationView` 기반 좌측 탐색
- `CommandBar` 기반 주요 action
- `InfoBar`, `TeachingTip`, `ContentDialog` 기반 feedback
- 프로젝트/작업은 master-detail layout
- 로그는 dockable terminal/log pane
- 설정은 category navigation + form section 구조
- local model library 전용 화면 추가

초기 화면은 마케팅/랜딩이 아니라 실제 작업 대시보드여야 한다.

### 3.2 Web 자동화

Python Playwright는 Playwright .NET으로 대체한다.

Playwright .NET은 browser launch, page navigation, screenshot, locator, mouse/keyboard input, browser context, storage state를 지원한다. 기존 `web_controller.py`의 기능은 대부분 직접 대응된다.

대체 매핑:

| 기존 Python 기능 | C# 대체 |
| --- | --- |
| `sync_playwright().start()` | `Playwright.CreateAsync()` |
| browser launch | `Chromium.LaunchAsync`, `Firefox.LaunchAsync`, `Webkit.LaunchAsync` |
| persistent context | `LaunchPersistentContextAsync` |
| screenshot | `Page.ScreenshotAsync` |
| HTML 저장 | `Page.ContentAsync` |
| interactive element 추출 | locator + DOM evaluation + accessibility snapshot |
| click/tap | `Page.Mouse.ClickAsync` 또는 locator click |
| text input | `Keyboard.TypeAsync`, locator fill |
| scroll/swipe | mouse wheel 또는 JS scroll |

Web v1은 Playwright .NET을 기본으로 한다. 장기적으로는 좌표 기반 action보다 locator/actionability를 우선 사용하고, VLM이 좌표 또는 element id를 반환할 수 있게 schema를 확장한다.

참고:

- Playwright .NET: https://playwright.dev/dotnet/
- Playwright .NET screenshots: https://playwright.dev/dotnet/docs/screenshots
- Playwright .NET input: https://playwright.dev/dotnet/docs/input
- Playwright .NET locators: https://playwright.dev/dotnet/docs/locators

### 3.3 Android 자동화

Android 자동화는 Python 의존이 아니라 ADB CLI 의존이다. 따라서 C# `Process` wrapper로 충분히 대체 가능하다.

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

C# 구현 방향:

- `IAdbService`: command execution, timeout, stdout/stderr capture
- `IAndroidDeviceService`: device/emulator discovery
- `IAndroidScreenReader`: screenshot + UI XML dump
- `IAndroidInputController`: tap/text/swipe/back
- `IApkService`: APK install, package detection, Play Store URL parsing

주의점:

- `adb shell input text`는 escaping 문제가 많다. v1에서는 기존 동작을 재현하되, text escaping utility를 별도로 테스트한다.
- `uiautomator dump` XML은 namespace/attribute 변동에 대비해 robust parser를 둔다.
- Android SDK 경로는 Store 패키지 안에 넣기보다 사용자 환경의 Android Studio/SDK를 감지하는 쪽이 현실적이다.

참고:

- Android Debug Bridge: https://developer.android.com/tools/adb

### 3.4 이미지 라벨링, 그리드, 리포트

Python의 OpenCV/Pyshine 역할은 C# 이미지 처리 라이브러리로 대체한다.

후보:

- SkiaSharp
- Windows.Graphics.Imaging
- ImageSharp

권장:

- v1은 SkiaSharp로 라벨, bbox, circle, arrow, grid overlay를 구현한다.
- Windows package와 licensing, native dependency 크기를 PoC에서 검증한다.

기능:

- screenshot resize/quality optimization
- element bbox label drawing
- grid overlay drawing
- action marker drawing
- before/after image table markdown 생성
- step report markdown 생성

## 4. 로컬 모델 런타임 조사

### 4.1 요구사항 재정의

중요한 목표는 "Ollama냐 vLLM이냐"가 아니다. 실제 요구사항은 다음이다.

- Hugging Face에 올라온 로컬 모델을 사용자가 선택할 수 있어야 한다.
- Web/Android 화면 screenshot을 image input으로 넣을 수 있어야 한다.
- VLM이 action JSON을 반환할 수 있어야 한다.
- Windows 네이티브 앱과 배포/스토어 환경에서 과도하게 충돌하지 않아야 한다.
- 가능하면 cloud API key 없이 동작해야 한다.

따라서 런타임 평가는 "이름"이 아니라 모델 포맷과 Windows 실행 가능성으로 나눈다.

### 4.2 vLLM

판단: v1 기본 내장 런타임으로 부적합.

이유:

- 공식 문서상 vLLM은 Windows를 native로 지원하지 않는다.
- Windows에서는 WSL 또는 community fork를 권장한다.
- Microsoft Store/MSIX 앱의 기본 사용자 경험으로 WSL/Docker/Python/CUDA 서버 설치를 요구하기 어렵다.
- vLLM은 server runtime으로는 강력하지만, Windows 네이티브 consumer app에 내장하기에는 설치/권한/드라이버/패키징 부담이 크다.

vLLM은 다음 경우에만 후순위 옵션으로 둔다.

- 사용자가 이미 WSL/Docker/별도 머신에서 vLLM server를 돌리고 있다.
- 앱은 OpenAI-compatible endpoint만 연결한다.
- advanced/external runtime 설정으로 노출한다.

참고:

- vLLM install: https://docs.vllm.ai/en/stable/getting_started/installation/gpu/
- vLLM OpenAI-compatible server: https://docs.vllm.ai/en/stable/serving/online_serving/

### 4.3 llama.cpp / GGUF

판단: v1에서 가장 현실적인 Hugging Face local model 경로.

장점:

- Windows에서 native executable/library로 배포하기 쉽다.
- GGUF 모델 생태계가 Hugging Face에 매우 많다.
- llama.cpp server는 OpenAI-compatible API를 제공한다.
- `--hf-repo` 형태로 Hugging Face repo를 직접 지정하는 사용 흐름을 지원한다.
- multimodal image input 지원이 있다.
- CPU/GPU offload 옵션을 조정할 수 있다.
- 외부 Python/venv가 필요 없다.

제약:

- Hugging Face 원본 `safetensors`를 그대로 실행하는 것이 아니다. GGUF 변환 모델 또는 llama.cpp가 지원하는 모델이어야 한다.
- VLM 모델마다 mmproj 등 추가 artifact가 필요할 수 있다.
- OpenAI-compatible API의 최신 Responses API, structured output, tool calling 호환성은 완벽하지 않을 수 있다.
- 모델별 prompt template/chat template 처리가 중요하다.

권장 역할:

- v1 기본 로컬 VLM runtime.
- 앱은 llama.cpp server를 companion process로 실행하거나 native library integration을 검토한다.
- 초기에는 server process 방식이 디버깅과 분리가 쉬워 유리하다.
- Store/MSIX 제약 확인 후 native library 방식으로 전환 가능성을 검토한다.

참고:

- llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- llama.cpp multimodal: https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md
- Hugging Face GGUF usage: https://huggingface.co/docs/hub/en/gguf-llamacpp

### 4.4 Windows ML / ONNX Runtime GenAI

판단: 장기적으로 가장 Windows 네이티브/Store 친화적인 방향이지만, v1에서는 모델 포맷 지원 범위가 핵심 리스크다.

장점:

- Windows ML은 Windows-supported ONNX Runtime 기반 local inference stack이다.
- ONNX Runtime GenAI는 LLM/VLM generation loop, tokenization, KV cache, streaming 등을 제공한다.
- DirectML, Windows ML, NPU/GPU/CPU acceleration 방향과 잘 맞는다.
- Microsoft Store/WinUI/Windows App SDK 앱과 철학적으로 가장 잘 맞는다.
- ONNX 모델은 패키징/검증/보안 관점에서 Python runtime보다 관리하기 쉽다.

제약:

- Hugging Face 원본 모델을 무제한 직접 실행하는 방식이 아니다.
- 모델은 ONNX export가 되어 있어야 하거나, 지원되는 architecture 변환이 가능해야 한다.
- VLM 지원은 모델별 편차가 크다.
- ONNX Runtime GenAI API와 Windows ML GenAI 관련 API는 preview 성격이 있어 변경 가능성이 있다.
- Qwen 계열 최신 VLM 등은 지원 상태를 모델별로 확인해야 한다.

권장 역할:

- Phase 0/1에서 ONNX VLM PoC를 반드시 수행한다.
- 앱의 model library는 "Windows ML optimized" 모델과 "GGUF" 모델을 구분해서 보여준다.
- 장기적으로는 Windows ML/ONNX를 first-class runtime으로 키운다.
- 단, v1 제품의 성공은 llama.cpp/GGUF 경로로 확보하고, ONNX는 verified model list부터 시작한다.

참고:

- Windows ML overview: https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/overview
- ONNX Runtime GenAI: https://onnxruntime.ai/docs/genai/
- Hugging Face + ONNX Runtime: https://onnxruntime.ai/huggingface
- ONNX Runtime Phi vision tutorial: https://onnxruntime.ai/docs/genai/tutorials/phi3-v.html

### 4.5 External OpenAI-compatible runtime

판단: 내부 기본값이 아니라 escape hatch.

지원 대상:

- 사용자가 직접 띄운 llama.cpp server
- LM Studio
- Ollama
- vLLM
- 기타 OpenAI-compatible local endpoint

이 옵션은 cloud provider/API key UX와 다르다. 목적은 "외부 local runtime 연결"이다.

설정 필드:

- endpoint URL
- optional API key/token
- model id
- vision support flag
- max context
- structured JSON support 여부

## 5. 리빌드 아키텍처

### 5.1 Solution structure

권장 solution 구성:

```text
KleverDesktop.Native.sln
├── KleverDesktop.WinUI
├── KleverDesktop.Core
├── KleverDesktop.Automation
├── KleverDesktop.LocalModels
├── KleverDesktop.Storage
├── KleverDesktop.Platform
└── KleverDesktop.Tests
```

### 5.2 Project responsibilities

`KleverDesktop.WinUI`

- WinUI 3 app entry
- navigation
- views
- view models
- dialogs
- local model library UI
- task dashboard
- logs/report viewer

`KleverDesktop.Core`

- domain models
- task state machine
- action schema
- model runtime abstraction
- shared result/error types

`KleverDesktop.Automation`

- `AgentRunner`
- `IAutomationTarget`
- `IObservationService`
- `IAnnotationService`
- `IActionExecutor`
- `IReflectionService`
- report generation
- progress event stream

`KleverDesktop.LocalModels`

- `ILocalModelRuntime`
- `LlamaCppRuntime`
- `OnnxGenAIRuntime`
- `ExternalOpenAiCompatibleRuntime`
- model download/cache metadata
- prompt formatting
- JSON response validation/retry

`KleverDesktop.Storage`

- app config
- projects/tasks
- migration/import from current `~/.klever-desktop`
- model cache metadata

`KleverDesktop.Platform`

- shell/open folder
- process runner
- file system helper
- Android SDK/ADB discovery
- Playwright browser setup

`KleverDesktop.Tests`

- unit tests
- integration tests
- local runtime smoke tests

### 5.3 Core interfaces

Automation target:

```csharp
public interface IAutomationTarget
{
    Task<Observation> ObserveAsync(CancellationToken cancellationToken);
    Task<ActionResult> ExecuteAsync(AutomationAction action, CancellationToken cancellationToken);
    Task CloseAsync();
}
```

Local model runtime:

```csharp
public interface ILocalModelRuntime
{
    Task<ModelRuntimeStatus> GetStatusAsync(CancellationToken cancellationToken);
    Task<ModelResponse> GenerateAsync(ModelRequest request, CancellationToken cancellationToken);
}
```

Agent runner:

```csharp
public interface IAgentRunner
{
    IAsyncEnumerable<AgentEvent> RunAsync(TaskRunRequest request, CancellationToken cancellationToken);
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

v1에서는 기존 AppAgent 호환 action set을 유지한다. 이후 locator 기반 web action과 semantic UI action을 확장한다.

## 6. UX 방향

### 6.1 삭제할 UX

다음 UX는 Python/cloud API 중심 구조라 제거한다.

- Python runtime download card
- venv/package install logs
- LiteLLM provider list
- API key provider table
- cloud provider cost estimation 중심 UI
- config -> env var mapping 노출

### 6.2 새로 만들 UX

새 UX:

- Local Model Library
- Model compatibility checker
- GGUF/ONNX format badge
- runtime selection: llama.cpp, Windows ML/ONNX, external local endpoint
- model download/cache manager
- hardware capability view: CPU, RAM, GPU, DirectML, NPU availability
- automation target setup: Web browser, Android SDK/ADB
- task run trace viewer: Observe/Think/Act/Reflect timeline

### 6.3 주요 화면

Projects

- project list
- platform badge: Web/Android
- task status summary
- last run

Task List

- status
- progress rounds
- model runtime
- target URL/APK
- run duration

Task Detail

- timeline
- screenshots
- action reasoning
- report markdown
- logs
- rerun/stop/schedule

Settings

- Local Models
- Automation Targets
- Execution
- Storage
- Diagnostics

## 7. 단계별 로드맵

### Phase 0: 조사와 PoC 확정

목표:

- Windows ML/ONNX Runtime GenAI가 실제 VLM screenshot action loop에 충분한지 검증한다.
- llama.cpp GGUF multimodal model이 action JSON을 안정적으로 반환하는지 검증한다.
- MSIX/Store 환경에서 companion executable, model cache, Playwright browser install 제약을 확인한다.

산출물:

- runtime comparison matrix
- verified local VLM list
- minimum hardware recommendation
- MSIX packaging feasibility note
- Web/Android automation API design draft

검증할 모델 예시:

- GGUF multimodal: llama.cpp가 지원하는 vision model
- ONNX VLM: ONNX Runtime GenAI supported vision model
- 작은 모델과 중간 모델 각각 1개 이상

### Phase 1: Local model runner PoC

목표:

- `ILocalModelRuntime` 구현체 2개를 만든다.
- `LlamaCppRuntime`으로 image + prompt -> action JSON을 받는다.
- `OnnxGenAIRuntime`으로 supported ONNX model inference를 검증한다.

작업:

- model cache directory 정의
- HF repo download strategy 정의
- GGUF model file selection UX prototype
- ONNX model folder validation
- JSON schema prompt/retry 구현
- streaming token/progress event 구현

성공 기준:

- screenshot 한 장과 task goal을 넣어 `tap`, `text`, `FINISH` 중 하나를 typed action으로 parse한다.
- Python 없이 동작한다.

### Phase 2: Web automation native loop

목표:

- Playwright .NET으로 Web 자동화 루프를 구현한다.
- 기존 integration test인 Google "I'm Feeling Lucky" 수준의 smoke scenario를 Python 없이 실행한다.

작업:

- browser install/check
- browser context/profile
- screenshot capture
- interactive element extraction
- label overlay
- action execution
- markdown report generation

성공 기준:

- Web task가 `Observe -> Annotate -> Think -> Act -> Reflect -> Persist`를 최소 2 round 이상 실행한다.
- task result folder가 기존과 유사한 artifact를 생성한다.

### Phase 3: Android automation native loop

목표:

- C# ADB wrapper로 Android 자동화 루프를 구현한다.

작업:

- Android SDK/ADB detection
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

### Phase 4: WinUI product shell

목표:

- 실제 Windows 네이티브 앱 UI를 구현한다.

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

### Phase 5: Packaging/MSIX/Store 검증

목표:

- 배포 형태를 확정한다.

검토 항목:

- single-project MSIX 가능 여부
- companion executable 포함 필요 여부
- Windows Application Packaging Project 필요 여부
- Microsoft Store full trust capability 영향
- model cache 위치
- Playwright browser install/cache 위치
- Android SDK 외부 의존성 안내

성공 기준:

- clean Windows machine에서 설치/실행 가능.
- Store 제출 또는 GitHub Releases 배포 경로 중 하나를 명확히 선택한다.

## 8. 위험과 대응

### 8.1 Hugging Face 모델 포맷 다양성

위험:

- Hugging Face에는 safetensors, GGUF, ONNX, AWQ, GPTQ 등 포맷이 섞여 있다.
- 모든 모델을 직접 실행할 수 없다.

대응:

- v1은 compatible model만 지원한다.
- Model Library에서 format/compatibility를 명확히 표시한다.
- "HF repo를 넣으면 항상 실행된다"는 UX를 피한다.

### 8.2 VLM multimodal 지원 편차

위험:

- 같은 LLM이라도 vision variant, projector, processor config가 다르다.
- action JSON 안정성이 모델마다 다르다.

대응:

- verified model list를 제공한다.
- prompt template을 runtime/model별로 분리한다.
- JSON validation + retry + fallback parser를 둔다.

### 8.3 Microsoft Store/MSIX 제약

위험:

- companion executable 포함, full trust capability, model cache, external process 실행이 Store 제출에 영향을 줄 수 있다.
- single-project MSIX는 단일 executable 제한이 있다.

대응:

- Phase 0에서 packaging PoC를 먼저 수행한다.
- 필요하면 Windows Application Packaging Project로 전환한다.
- Store 배포와 GitHub Releases 배포를 분리 검토한다.

참고:

- Windows app distribution: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path
- Single-project MSIX: https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/single-project-msix

### 8.4 Android SDK/ADB 외부 의존성

위험:

- Android SDK는 앱에 포함하기 크고 관리가 어렵다.
- 사용자의 Android Studio/SDK 설치 상태가 다양하다.

대응:

- SDK path detector를 견고하게 만든다.
- Settings에서 path override를 제공한다.
- 진단 화면에서 adb/emulator/aapt 상태를 보여준다.

### 8.5 로컬 모델 성능과 하드웨어 요구

위험:

- VLM은 메모리와 GPU 요구가 높다.
- CPU-only 환경에서는 UX가 느릴 수 있다.

대응:

- 작은 verified model부터 지원한다.
- model card에 예상 RAM/VRAM 표시.
- action loop timeout과 cancellation을 명확히 제공한다.
- local runtime benchmark를 setup flow에 포함한다.

## 9. 제거 대상 목록

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

## 10. 초기 의사결정

확정:

- Windows 네이티브 리빌드는 WinUI 3 + Windows App SDK + C#/.NET을 기본으로 한다.
- Python/AppAgent는 유지하지 않고 기능을 내재화한다.
- v1 자동화 대상은 Web + Android로 유지한다.
- cloud LLM provider UX는 제거한다.
- Hugging Face 로컬 모델 중심으로 간다.
- vLLM은 기본 내장 런타임이 아니라 external runtime option으로만 둔다.
- GGUF/llama.cpp와 ONNX/Windows ML을 병행 조사한다.

미확정:

- llama.cpp를 companion executable로 둘지 native library로 통합할지
- Windows ML/ONNX를 v1 기본 runtime으로 둘 수 있을 만큼 VLM 모델 지원이 충분한지
- Microsoft Store 배포를 v1 목표로 할지, GitHub Releases를 먼저 유지할지
- verified model list의 초기 모델

## 11. 참고 자료

- WinUI/Windows App SDK: https://learn.microsoft.com/en-us/windows/apps/
- Windows App SDK downloads: https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/downloads
- Playwright .NET: https://playwright.dev/dotnet/
- Playwright .NET screenshots: https://playwright.dev/dotnet/docs/screenshots
- Playwright .NET input: https://playwright.dev/dotnet/docs/input
- Android Debug Bridge: https://developer.android.com/tools/adb
- vLLM install: https://docs.vllm.ai/en/stable/getting_started/installation/gpu/
- vLLM OpenAI-compatible serving: https://docs.vllm.ai/en/stable/serving/online_serving/
- ONNX Runtime GenAI: https://onnxruntime.ai/docs/genai/
- Windows ML overview: https://learn.microsoft.com/en-us/windows/ai/new-windows-ml/overview
- Hugging Face + ONNX Runtime: https://onnxruntime.ai/huggingface
- llama.cpp server: https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md
- llama.cpp multimodal: https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md
- Hugging Face GGUF usage: https://huggingface.co/docs/hub/en/gguf-llamacpp
- Single-project MSIX: https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/single-project-msix
- Windows app distribution paths: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path

