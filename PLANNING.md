# KleverDesktop - Electron 앱 기획서

## 📦 AppAgent 서브모듈 분석 요약

### ✅ 이미 구현된 기능들 (claude 브랜치)

**1. Ollama 통합 완료**
- `model.py`에 `OllamaModel` 클래스 이미 구현됨
- Ollama SDK 사용 (base64 인코딩 없이 파일 경로로 직접 전달)
- 이미지 자동 최적화 (512x512, JPEG 압축)
- `qwen3-vl:4b` 모델이 기본값 (16GB RAM 최적화)

**2. 멀티플랫폼 지원**
- Android: `and_controller.py` (ADB 기반)
- Web: `web_controller.py` (Playwright 기반)
- `self_explorer.py`에서 `--platform` 인자로 선택 가능

**3. 핵심 자동화 로직**
- `self_explorer.py`: 메인 탐색 로직 (26KB)
- Grid 기반 상호작용 시스템 (정확한 UI 요소 타겟팅)
- 자동 에뮬레이터 시작 (Android)
- 마크다운 리포트 자동 생성 (이미지 테이블 포함)

**4. 설정 구조**
- `config.yaml`: 모든 설정이 YAML 파일로 관리됨
- API/Local 모델 전환 가능
- 웹/Android 각각 독립 설정

**5. 의존성 (requirements.txt)**
```
argparse, beautifulsoup4, colorama, ollama,
opencv-python, playwright, pyshine, pyyaml, requests
```

### ❌ 제거할 부분

- Figma 관련 코드: ✅ 없음 (이미 제거됨)
- 복잡한 WebSocket: ✅ 없음
- GPT-4V+SoM: ✅ 이미 Ollama로 대체됨

**결론: claude 브랜치는 이미 우리가 원하는 상태입니다!** 🎉

---

## 🎯 Electron 앱 구조 기획

당신이 제안한 4가지 주요 기능을 상세히 설계하겠습니다.

### 1) 환경설정 마법사

**목적:** 첫 실행 시 필수 의존성 체크 및 원클릭 설치

#### UI 흐름:
```
시작 화면
   ↓
[Step 1] Python 체크
   ✓ Python 3.11+ 설치 여부
   ✗ 없으면 → 다운로드 링크 제공 또는 자동 설치
   ↓
[Step 2] Python 패키지 체크
   ✓ requirements.txt 의존성 체크
   ✗ 없으면 → "Install Dependencies" 버튼 (pip install)
   ↓
[Step 3] Ollama 체크
   ✓ Ollama 실행 여부 (http://localhost:11434 체크)
   ✗ 없으면 → 다운로드 안내 (ollama.com/download)
   ↓
[Step 4] 플랫폼별 도구 체크
   - Android: ADB 설치 여부 + 디바이스 연결 확인
   - Web: Playwright 브라우저 설치 (playwright install)
   ↓
완료: "Start Using KleverDesktop" 버튼
```

#### 구현 방법:
- **Python 체크:** `child_process.exec('python --version')`
- **패키지 체크:** `pip list` 결과 파싱
- **Ollama 체크:** `fetch('http://localhost:11434/api/tags')` 요청
- **ADB 체크:** `adb devices` 실행
- **Playwright 체크:** `playwright install --dry-run`

#### UI 컴포넌트:
```
┌────────────────────────────────────┐
│  Setup Wizard - Step 2/4          │
│                                    │
│  ✓ Python 3.11.6 found            │
│  ◌ Installing Python packages...  │
│     [████████░░░░░░░] 60%         │
│                                    │
│  [Skip]            [Next]         │
└────────────────────────────────────┘
```

---

### 2) 설정 패널 (config.yaml → UI)

**목적:** config.yaml을 GUI로 편집 가능하게 만들기

#### 설정 항목:

**모델 설정 탭**
```
[ Model Provider ]
○ OpenAI / OpenRouter API
● Ollama (Local)

[ Ollama Settings ]
Model:           [qwen3-vl:4b ▼]  ← Ollama 모델 리스트 자동 로드
Base URL:        http://localhost:11434/v1/chat/completions
Max Tokens:      [4096      ]
Temperature:     [0.0       ] (0.0 - 2.0)
```

**Android 설정 탭**
```
[ Device ]
Connected Device: [192.168.1.5:5555 ▼]  ← adb devices 자동 로드

[ Directories ]
Screenshot Dir:   [/sdcard        ]
XML Dir:          [/sdcard        ]
```

**Web 설정 탭**
```
[ Browser ]
Browser Type:     [Chromium ▼]  (Chromium, Firefox, Webkit)
Headless:         [☐]
Viewport:         [1280] x [720]
```

**이미지 최적화 탭**
```
[ Optimization ]
Enable:           [☑]
Max Width:        [512]
Max Height:       [512]
JPEG Quality:     [85] (1-100)
```

**기타 설정 탭**
```
Max Rounds:       [20]
Dark Mode:        [☐]
Min Distance:     [30]
Request Interval: [10] seconds
```

#### 구현:
- **백엔드:** Python 프로세스에서 `config.yaml` 읽기/쓰기
- **프론트엔드:** Electron IPC로 설정 불러오기/저장하기
- **Ollama 모델 리스트:** `ollama list` 실행 결과 파싱

---

### 3) 프로젝트 관리 UI (run.py 대체)

**목적:** 여러 프로젝트를 GUI로 관리 및 생성

#### 메인 화면 (프로젝트 리스트):
```
┌─────────────────────────────────────────────────┐
│  Projects                        [+ New Project] │
├─────────────────────────────────────────────────┤
│  📱 Instagram (Android)                          │
│     Task: Follow @example                        │
│     Last run: 2025-11-09 14:32                   │
│     Status: ✓ Completed                          │
│                                                   │
│  🌐 Google (Web)                                 │
│     Task: Search for "OpenAI"                    │
│     Last run: 2025-11-08 10:15                   │
│     Status: ⏸ Paused at Step 5                  │
│                                                   │
│  📱 Twitter (Android)                            │
│     Task: Post tweet                             │
│     Last run: Never                              │
│     Status: ○ Not started                        │
└─────────────────────────────────────────────────┘
```

#### 프로젝트 생성 마법사:
```
[Step 1] Platform Selection
┌─────────────────────────────────┐
│  Select Platform:               │
│                                 │
│  ┌─────────┐   ┌─────────┐    │
│  │  📱      │   │  🌐      │    │
│  │ Android  │   │  Web     │    │
│  └─────────┘   └─────────┘    │
│                                 │
│           [Next]                │
└─────────────────────────────────┘

[Step 2] Android 전용 - Device Selection
(Web 선택 시 스킵)
┌─────────────────────────────────┐
│  Select Device:                 │
│  ○ Emulator (auto-start)        │
│  ● Physical Device              │
│     [192.168.1.5:5555 ▼]       │
│                                 │
│  [Back]            [Next]      │
└─────────────────────────────────┘

[Step 3] Project Details
┌─────────────────────────────────┐
│  Project Details:               │
│                                 │
│  App/Website Name:              │
│  [Instagram            ]        │
│                                 │
│  URL: (Web only)                │
│  [https://instagram.com]        │
│                                 │
│  Task Description:              │
│  ┌─────────────────────────┐   │
│  │ Follow user @example    │   │
│  │                         │   │
│  └─────────────────────────┘   │
│                                 │
│  [Back]       [Create Project] │
└─────────────────────────────────┘
```

#### 데이터 모델 (JSON):
```json
{
  "projects": [
    {
      "id": "proj_001",
      "name": "Instagram",
      "platform": "android",
      "device": "192.168.1.5:5555",
      "task": "Follow @example",
      "url": null,
      "created_at": "2025-11-09T14:00:00Z",
      "last_run": "2025-11-09T14:32:00Z",
      "status": "completed",
      "result_path": "./projects/proj_001/result.md"
    }
  ]
}
```

**저장 위치:** `~/.klever-desktop/projects.json`

---

### 4) 프로젝트 상세 페이지

**목적:** self_explorer 실행, 모니터링, 결과 보기

#### UI 레이아웃:
```
┌──────────────────────────────────────────────────────┐
│  ← Back to Projects                                   │
│                                                        │
│  📱 Instagram - Follow @example                       │
│  ────────────────────────────────────────────────    │
│                                                        │
│  [▶ Start]  [⏸ Pause]  [⏹ Stop]  [🔄 Restart]       │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ Status: Running (Step 12/20)                 │    │
│  │                                               │    │
│  │ Current Action:                               │    │
│  │ → Tapping on element #3 (Follow button)      │    │
│  │                                               │    │
│  │ ┌─────────────────────────────────────┐      │    │
│  │ │ [Screenshot preview]                 │      │    │
│  │ │                                      │      │    │
│  │ │        [Follow] ← Highlighted       │      │    │
│  │ │                                      │      │    │
│  │ └─────────────────────────────────────┘      │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │ System Monitor                                │    │
│  │                                               │    │
│  │ CPU:  ████████░░░░░ 45%                      │    │
│  │ RAM:  ████████████░ 6.2GB / 16GB             │    │
│  │ Model: qwen3-vl:4b (loaded)                  │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  [ View Logs ]     [ View Report (Markdown) ]        │
└──────────────────────────────────────────────────────┘
```

#### 기능 상세:

**1. 실행 제어**
- **Start:** `python self_explorer.py --platform android --task "Follow @example"`
- **Pause:** SIGSTOP 시그널 전송
- **Stop:** SIGTERM 시그널 전송
- **Restart:** Stop → Start

**2. 실시간 모니터링**
- **Screenshot preview:** `./projects/proj_001/screenshots/latest.png` 주기적으로 읽기
- **Current action:** Python stdout 파싱 (colorama 출력)
- **Progress:** `self_explorer.py`에서 round 카운트 추출

**3. 시스템 모니터**
- **CPU/RAM:** Node.js `os` 모듈 사용
- **Model status:** Ollama API `/api/ps` 호출하여 로드된 모델 확인

**4. 로그 뷰어**
```
┌────────────────────────────────────┐
│  Logs                         [×] │
├────────────────────────────────────┤
│ [14:32:01] ✓ Python server started│
│ [14:32:05] ✓ Ollama connected     │
│ [14:32:10] ✓ Device connected     │
│ [14:32:15] → Step 1: Navigating   │
│ [14:32:20] → Step 2: Tapping #3   │
│ [14:32:25] ✓ Action successful    │
│                                    │
│ [Auto-scroll ☑]   [Export Logs]  │
└────────────────────────────────────┘
```

**5. 마크다운 리포트 뷰어**
```
┌────────────────────────────────────┐
│  Report - Instagram Follow        │
├────────────────────────────────────┤
│ # Task: Follow @example            │
│                                    │
│ ## Steps Taken                     │
│                                    │
│ | Step | Action | Screenshot |     │
│ |------|--------|------------|     │
│ | 1    | Open   | ![](...)   |     │
│ | 2    | Tap    | ![](...)   |     │
│                                    │
│ ## Result: ✓ Success               │
│                                    │
│ [Export PDF]   [Copy Markdown]    │
└────────────────────────────────────┘
```

---

## 🏗️ 기술 스택 & 아키텍처

### 프론트엔드 (Electron)
```
Electron + React (또는 Vue/Svelte)
├── Main Process (Node.js)
│   ├── IPC Handler (설정, 프로젝트 CRUD)
│   ├── Python Process Manager (child_process)
│   ├── System Monitor (os, cpu-usage)
│   └── File Watcher (프로젝트 결과 감지)
│
└── Renderer Process (UI)
    ├── Setup Wizard
    ├── Settings Panel
    ├── Project List
    └── Project Detail
```

### 백엔드 (Python)
```
AppAgent (기존 코드 재사용)
├── self_explorer.py (메인 로직)
├── and_controller.py (Android)
├── web_controller.py (Web)
└── model.py (Ollama 통합)
```

### 통신 방식
```
Electron Main ←→ Python
     ↓              ↓
   stdout       subprocess
     ↓              ↓
   IPC     ←→   Renderer
```

**구체적인 흐름:**
1. Renderer에서 "Start" 버튼 클릭
2. IPC로 Main Process에 시작 요청
3. Main Process에서 Python subprocess 생성
   ```javascript
   const python = spawn('python', [
     'appagent/scripts/self_explorer.py',
     '--platform', 'android',
     '--task', 'Follow @example',
     '--app', 'Instagram'
   ]);
   ```
4. Python stdout/stderr을 IPC로 Renderer에 스트리밍
5. 스크린샷/결과 파일은 File Watcher로 감지하여 UI 업데이트

---

## 📂 프로젝트 구조

```
KleverDesktop/
├── electron/                    # Electron 앱 (새로 생성)
│   ├── main.js                 # Main process
│   ├── preload.js              # IPC bridge
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── SetupWizard.jsx
│       │   ├── SettingsPanel.jsx
│       │   ├── ProjectList.jsx
│       │   └── ProjectDetail.jsx
│       ├── services/
│       │   ├── pythonManager.js   # Python subprocess 관리
│       │   ├── systemMonitor.js   # CPU/RAM 모니터
│       │   └── projectStorage.js  # projects.json CRUD
│       └── App.jsx
│
├── appagent/                   # 서브모듈 (기존 유지)
│   ├── scripts/
│   │   ├── self_explorer.py   # 메인 로직
│   │   ├── and_controller.py
│   │   ├── web_controller.py
│   │   ├── model.py
│   │   └── ...
│   ├── config.yaml            # 기본 설정
│   └── requirements.txt
│
├── .envrc                      # 환경 변수 (나중에 부활)
├── scripts/                    # 빌드 스크립트 (나중에 부활)
│   ├── build-macos.sh
│   └── build-windows.ps1
│
└── README.md
```

---

## 🔄 IPC 통신 설계

### Electron → Python

**1. 프로젝트 시작**
```javascript
// Renderer
ipcRenderer.invoke('project:start', {
  projectId: 'proj_001',
  platform: 'android',
  device: '192.168.1.5:5555',
  task: 'Follow @example',
  app: 'Instagram'
});

// Main
ipcMain.handle('project:start', async (event, config) => {
  const python = spawn('python', [
    'appagent/scripts/self_explorer.py',
    '--platform', config.platform,
    '--device', config.device,
    '--task', config.task,
    '--app', config.app
  ]);

  // stdout 스트리밍
  python.stdout.on('data', (data) => {
    event.sender.send('project:output', data.toString());
  });

  return { success: true, pid: python.pid };
});
```

**2. 설정 저장**
```javascript
// Renderer
ipcRenderer.invoke('settings:save', {
  model: 'qwen3-vl:4b',
  maxTokens: 4096,
  temperature: 0.0
});

// Main
ipcMain.handle('settings:save', async (event, settings) => {
  // config.yaml 업데이트
  const yaml = require('js-yaml');
  const config = yaml.load(fs.readFileSync('appagent/config.yaml'));
  Object.assign(config, settings);
  fs.writeFileSync('appagent/config.yaml', yaml.dump(config));
  return { success: true };
});
```

**3. Ollama 모델 리스트 가져오기**
```javascript
// Renderer
const models = await ipcRenderer.invoke('ollama:list');

// Main
ipcMain.handle('ollama:list', async () => {
  const result = execSync('ollama list').toString();
  const lines = result.split('\n').slice(1); // 헤더 제거
  return lines.map(line => {
    const [name, ...rest] = line.split(/\s+/);
    return name;
  }).filter(Boolean);
});
```

---

## 🚀 개발 로드맵

### Phase 1: 기본 구조 (1주)
- [x] AppAgent 서브모듈 분석 완료
- [ ] Electron 프로젝트 초기화
- [ ] 기본 UI 구조 (React + Tailwind CSS)
- [ ] IPC 통신 설정
- [ ] Python subprocess 실행 테스트

### Phase 2: 환경설정 마법사 (1주)
- [ ] Python 체크 구현
- [ ] 패키지 체크 및 설치
- [ ] Ollama 체크
- [ ] ADB/Playwright 체크
- [ ] 진행 상황 UI

### Phase 3: 설정 패널 (1주)
- [ ] config.yaml ↔ UI 동기화
- [ ] Ollama 모델 리스트 로드
- [ ] ADB 디바이스 리스트 로드
- [ ] 설정 검증 및 에러 처리

### Phase 4: 프로젝트 관리 (1주)
- [ ] 프로젝트 리스트 UI
- [ ] 프로젝트 생성 마법사
- [ ] projects.json CRUD
- [ ] 프로젝트 삭제/편집

### Phase 5: 프로젝트 상세 페이지 (2주)
- [ ] self_explorer.py 실행/중지
- [ ] 실시간 로그 스트리밍
- [ ] 스크린샷 미리보기
- [ ] 시스템 모니터
- [ ] 마크다운 리포트 뷰어

### Phase 6: 패키징 & 배포 (1주)
- [ ] macOS: DMG 빌드 (./scripts/build-macos.sh 재활용)
- [ ] Windows: MSI/EXE 빌드 (./scripts/build-windows.ps1 재활용)
- [ ] 자동 업데이트 기능
- [ ] 테스트 및 버그 수정

**총 예상 개발 기간: 7주**

---

## 💡 주요 기술 결정사항

### 1. Electron vs Tauri
**선택: Electron**
- 이유: 빠른 개발, 풍부한 생태계, Node.js 통합 용이
- Trade-off: 번들 크기 ~200MB (Tauri는 ~10MB이지만 Rust 학습 곡선)

### 2. UI 프레임워크
**권장: React + Tailwind CSS**
- 이유: 빠른 프로토타이핑, 컴포넌트 재사용성
- 대안: Vue (더 가볍고 배우기 쉬움), Svelte (가장 빠름)

### 3. Python 통신 방식
**선택: subprocess + stdout/stderr 파싱**
- 이유: 간단하고 안정적, 기존 AppAgent 코드 수정 불필요
- 대안: Flask 서버 (오버엔지니어링, 불필요한 복잡도)

### 4. 데이터 저장
**선택: JSON 파일 (projects.json)**
- 이유: 간단하고 투명, 사용자가 직접 편집 가능
- 대안: SQLite (프로젝트가 1000개 이상일 때 고려)

---

## 🎬 다음 단계

어떻게 진행하시겠습니까?

**Option A: Electron 앱 프로토타입 시작**
- Phase 1부터 단계적으로 구현
- 기본 구조 먼저 만들고 기능 추가

**Option B: 특정 기능 POC**
- 환경설정 마법사만 먼저 구현
- 또는 프로젝트 관리 UI만 먼저 구현

**Option C: 더 논의**
- UI/UX 디자인 상세화
- 기술 스택 재검토
- 추가 기능 아이디어

어떤 방향으로 진행할까요?
