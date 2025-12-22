# Multi-Agent Architecture Refactoring Plan

## 목차
- [현재 상황 분석](#현재-상황-분석)
- [문제점](#문제점)
- [목표 아키텍처](#목표-아키텍처)
- [설계 원칙](#설계-원칙)
- [단계별 실행 계획](#단계별-실행-계획)
- [상세 설계](#상세-설계)
- [마이그레이션 체크리스트](#마이그레이션-체크리스트)

---

## 현재 상황 분석

### 폴더 구조
```
agents/
├── requirements.txt           # 통합된 의존성
├── appagent/                  # AppAgent 엔진 (Android + Web 전통 방식)
│   ├── config.yaml           # AppAgent 전용 설정
│   └── scripts/
│       ├── self_explorer.py
│       ├── and_controller.py
│       └── ...
├── browser-use/               # Browser-Use 엔진 (Web only, AI-driven)
│   ├── scripts/
│   │   ├── self_explorer.py  # Browser-Use 전용 entry point
│   │   ├── browser_use_wrapper.py  # LiteLLM integration
│   │   └── ...
│   └── requirements.txt      # Browser-Use 전용 의존성
└── gelab-zero/               # GELab-Zero 엔진 (Android only)
    ├── klever_wrapper/
    │   ├── self_explorer.py
    │   └── ...
    └── copilot_agent_client/
```

### Electron 앱의 현재 상태

#### 1. 하드코딩된 appagent 참조
다음 파일들이 `getAppagentPath()`만 사용하고 있습니다:

**주요 발견**:
- browser-use가 appagent 내부에 wrapper로 존재하지만, 독립 에이전트로 분리되어야 함
- ⚠️ **AppAgent는 원래 Android 전용**이었으나, 억지로 웹 지원이 추가됨
- 이번 리팩토링으로 AppAgent를 Android 전용으로 복귀시키고, 웹은 Browser-Use에 완전 이관

| 파일 | 하드코딩 위치 | 설명 |
|------|--------------|------|
| `main/utils/python-runtime.ts` | `getPythonEnv()` line 524 | PYTHONPATH를 appagent로만 설정 |
| `main/utils/python-runtime.ts` | `executePythonScript()` line 179 | appagent 디렉토리에서만 스크립트 실행 |
| `main/utils/python-runtime.ts` | `checkPythonRuntime()` line 571 | appagent 스크립트만 검증 |
| `main/utils/python-runtime.ts` | `spawnBundledPython()` line 545 | appagent를 PYTHONPATH로 설정 |
| `main/handlers/google-login.ts` | 전체 | appagent/scripts/google_login.py만 실행 |
| `main/handlers/integration.ts` | 전체 | appagent 스크립트로만 통합 테스트 |
| `main/handlers/task.ts` | `cleanupEmulatorIfIdle()` line 45 | appagent로만 에뮬레이터 정리 |
| `main/handlers/task.ts` | `cleanupTaskProcesses()` line 676 | appagent로만 에뮬레이터 정리 |

#### 2. 부분적으로 구현된 multi-agent 지원

`main/handlers/task.ts`의 `startTaskExecution()` 함수에서만 분기 처리:
```typescript
// Line 228-247
const agentEngine = appConfig.execution.agentEngine || 'appagent';

if (agentEngine === 'gelab' && project.platform === 'android') {
  workingDir = getGelabPath();
  scriptPath = path.join('klever_wrapper', 'self_explorer.py');
} else {
  workingDir = getAppagentPath();
  scriptPath = path.join('scripts', 'self_explorer.py');
}
```

**문제**: Task 실행만 지원하고, 다른 기능들(Google Login, 통합 테스트, 에뮬레이터 정리 등)은 여전히 appagent만 사용

---

## 문제점

### 1. 공통 기능의 중복/불일치
- `google_login.py`: Web/Android 모두에서 필요하지만 appagent에만 존재
- `config.yaml`: 각 에이전트마다 별도로 관리되어 일관성 없음
- 설정 관리: Electron의 `config.json`과 Python의 `config.yaml`이 별도로 존재

### 2. 인터페이스 부재
- 각 에이전트가 다른 스크립트 구조를 가짐
  - AppAgent: `scripts/self_explorer.py`
  - GELab-Zero: `klever_wrapper/self_explorer.py`
- 통일된 CLI 인터페이스 없음
- 에이전트 간 전환 시 다른 파라미터 필요

### 3. 에이전트별 기능 제한
- Google Login: appagent만 가능
- 통합 테스트: appagent만 가능
- 에뮬레이터 정리: appagent만 가능
- 각 핸들러가 특정 에이전트에 강하게 결합됨

### 4. 확장성 부족
- 새로운 에이전트 추가 시 모든 핸들러 수정 필요
- 설정 변경 시 여러 곳을 수정해야 함
- 테스트 어려움 (에이전트 교체 불가)

---

## 목표 아키텍처

### 계층 구조 (3-Agent Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                     │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         IPC Handlers (API Layer)                   │    │
│  │  - task.ts, google-login.ts, integration.ts ...   │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │      Agent Controller (Orchestration Layer)        │    │
│  │  - Agent selection logic                           │    │
│  │  - Platform + Engine combination validation        │    │
│  │  - Common interface enforcement                    │    │
│  │  - Shared functionality coordination               │    │
│  └────────────────┬───────────────────────────────────┘    │
│                   │                                          │
│  ┌────────────────▼───────────────────────────────────┐    │
│  │       Agent Adapters (Adapter Layer)               │    │
│  │  - AppAgentAdapter    (Android only) 🔄             │    │
│  │  - BrowserUseAdapter  (Web only)  🆕               │    │
│  │  - GelabAdapter       (Android only)               │    │
│  │  - Common interface implementation                 │    │
│  └────────────────┬───────────────────────────────────┘    │
└───────────────────┼──────────────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────────────┐
│                  Python Agents Layer                         │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Shared  │  │ AppAgent │  │ Browser  │  │  GELab   │   │
│  │ Scripts  │  │  Engine  │  │   Use    │  │  Engine  │   │
│  │          │  │          │  │  Engine  │  │          │   │
│  │• common/ │  │• scripts/│  │• scripts/│  │• klever_ │   │
│  │  -google_│  │  -and_   │  │  -self_  │  │  wrapper/│   │
│  │   login  │  │   control│  │   explor.│  │          │   │
│  │  -config_│  │          │  │  -browser│  │          │   │
│  │   loader │  │          │  │   _use_  │  │          │   │
│  │  -utils  │  │          │  │   wrapper│  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                   ↓              ↓              ↓           │
│             Android only 🔄   Web only     Android only     │
│                Traditional    AI-driven    Local model      │
└──────────────────────────────────────────────────────────────┘
```

### 주요 컴포넌트

#### 1. Agent Controller (NEW)
**위치**: `main/utils/agent-controller.ts`

**책임**:
- 설정에서 에이전트 선택 읽기
- 적절한 Adapter 인스턴스 반환
- 공통 기능 조율 (Google Login, 통합 테스트 등)
- 에이전트별 환경 변수 구성

#### 2. Agent Adapter Interface (NEW)
**위치**: `main/types/agent.ts`

**정의**:
```typescript
interface AgentAdapter {
  name: string;
  engineType: 'appagent' | 'browser-use' | 'gelab';

  // 경로
  getBasePath(): string;
  getScriptsPath(): string;

  // Task 실행
  getTaskScript(): string;
  buildTaskArgs(project: Project, task: Task): string[];
  getPythonPath(): { pythonPath: string; env: NodeJS.ProcessEnv };

  // 공통 기능 지원 여부
  supportsGoogleLogin(): boolean;
  supportsIntegrationTest(): boolean;

  // 플랫폼 지원
  supportsPlatform(platform: 'android' | 'web'): boolean;

  // 엔진 특성 🆕
  isAIDriven(): boolean;           // Browser-Use는 true
  requiresHeavyModel(): boolean;   // Browser-Use는 true (vision model)
  getRecommendedModel(): string | null;  // Browser-Use: "gpt-4o", "claude-3.5-sonnet"
}
```

#### 3. Shared Python Scripts (NEW)
**위치**: `agents/shared/`

**내용**:
```
agents/shared/
├── google_login.py         # Web/Android 공통 로그인
├── google_login_android.py # Android 전용 로그인
├── config_loader.py        # 통합 설정 로더
├── integration_test.py     # 통합 테스트 유틸
└── utils.py                # 공통 유틸리티
```

#### 4. 통합 설정 관리
**Electron → Python 흐름**:
```
config.json (Electron)
    ↓ buildEnvFromConfig()
Environment Variables (22개)
    ↓ Python subprocess
Python Runtime (os.environ)
    ↓ config_loader.py
Unified Config Object
```

---

## 설계 원칙

### 1. Open/Closed Principle
- 새로운 에이전트 추가 시 기존 코드 수정 최소화
- Adapter 패턴으로 확장 지원

### 2. Interface Segregation
- 각 핸들러는 필요한 기능만 의존
- Agent Controller가 복잡성 캡슐화

### 3. Dependency Inversion
- 핸들러는 구체적인 에이전트가 아닌 인터페이스에 의존
- 런타임에 설정으로 에이전트 선택

### 4. Don't Repeat Yourself
- 공통 기능은 `agents/shared/`로 추출
- 설정은 Electron의 `config.json`에서 단일 진실 원천(Single Source of Truth)

---

## 단계별 실행 계획

### Phase 1: 공통 레이어 구축 ⚠️ HIGH PRIORITY

#### 1.1 Shared Scripts 생성
```bash
mkdir -p agents/shared
```

**작업**:
- [ ] `agents/appagent/scripts/google_login.py` → `agents/shared/google_login.py` 이동
- [ ] `agents/appagent/scripts/google_login_android.py` → `agents/shared/google_login_android.py` 이동
- [ ] `agents/shared/config_loader.py` 생성 (환경 변수 → Python dict)
- [ ] `agents/shared/utils.py` 생성 (공통 유틸리티)
- [ ] `agents/shared/__init__.py` 생성

**검증**:
```bash
# 기존 스크립트들이 새 경로에서 import 가능한지 확인
python -c "import sys; sys.path.insert(0, 'agents/shared'); import google_login"
```

#### 1.2 설정 통합
**작업**:
- [ ] `agents/appagent/config.yaml` 제거 (Electron의 config.json 사용)
- [ ] `agents/shared/config_loader.py`에서 환경 변수 읽기
- [ ] Python 스크립트들이 환경 변수를 우선 사용하도록 수정

**변경 전** (Python):
```python
# config.yaml에서 읽기
with open('config.yaml') as f:
    config = yaml.safe_load(f)
```

**변경 후** (Python):
```python
# 환경 변수 우선, yaml은 fallback
from shared.config_loader import load_config
config = load_config()  # 자동으로 env vars → dict
```

---

### Phase 2: Agent Adapter 구현

#### 2.1 타입 정의
**파일**: `main/types/agent.ts`

```typescript
export interface AgentAdapter {
  name: string;
  engineType: 'appagent' | 'gelab';

  // Paths
  getBasePath(): string;
  getScriptsPath(): string;

  // Task execution
  getTaskScript(): string;
  buildTaskArgs(project: Project, task: Task, taskDir: string): string[];
  getPythonEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv;

  // Feature support
  supportsGoogleLogin(): boolean;
  supportsIntegrationTest(): boolean;
  supportsPlatform(platform: 'android' | 'web'): boolean;

  // Common operations
  getGoogleLoginScript(): string | null;
  getIntegrationTestScript(): string | null;
  getEmulatorCleanupCode(): string | null;
}

export interface AgentConfig {
  engineType: 'appagent' | 'gelab';
  platform?: 'android' | 'web';
}
```

#### 2.2 Adapter 구현
**파일**: `main/adapters/appagent-adapter.ts`

```typescript
import { AgentAdapter, Project, Task } from '../types';
import { getAppagentPath } from '../utils/python-runtime';
import * as path from 'path';

export class AppAgentAdapter implements AgentAdapter {
  name = 'AppAgent';
  engineType = 'appagent' as const;

  getBasePath(): string {
    return getAppagentPath();
  }

  getScriptsPath(): string {
    return path.join(this.getBasePath(), 'scripts');
  }

  getTaskScript(): string {
    return path.join('scripts', 'self_explorer.py');
  }

  buildTaskArgs(project: Project, task: Task, taskDir: string): string[] {
    // 🔄 AppAgent는 Android 전용으로 복귀
    if (project.platform !== 'android') {
      throw new Error('AppAgent only supports Android platform');
    }

    const args = [
      '-u',
      this.getTaskScript(),
      '--platform', 'android',
      '--app', sanitizeAppName(project.name),
      '--root_dir', project.workspaceDir,
      '--task_dir', taskDir,
    ];

    if (task.goal || task.description) {
      args.push('--task_desc', task.goal || task.description);
    }

    if (task.modelName) {
      args.push('--model_name', task.modelName);
    }

    return args;
  }

  getPythonEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const scriptsDir = this.getScriptsPath();
    const workingDir = this.getBasePath();
    const sharedDir = path.join(path.dirname(workingDir), 'shared');

    return {
      ...baseEnv,
      PYTHONPATH: `${scriptsDir}${path.delimiter}${workingDir}${path.delimiter}${sharedDir}`,
      PYTHONUNBUFFERED: '1',
    };
  }

  supportsGoogleLogin(): boolean {
    return true; // Android Google login
  }

  supportsIntegrationTest(): boolean {
    return true; // Android integration test
  }

  supportsPlatform(platform: 'android' | 'web'): boolean {
    return platform === 'android'; // 🔄 Android only (원래대로 복귀)
  }

  getGoogleLoginScript(): string {
    // Use shared script
    return path.join(path.dirname(this.getBasePath()), 'shared', 'google_login.py');
  }

  getIntegrationTestScript(): string {
    return path.join(this.getScriptsPath(), 'and_controller.py');
  }

  getEmulatorCleanupCode(): string {
    const basePath = this.getBasePath().replace(/\\/g, '/');
    return `
import sys
sys.path.insert(0, '${basePath}')
from scripts.and_controller import stop_emulator, cleanup_emulators
cleanup_emulators()
`;
  }
}
```

**파일**: `main/adapters/browser-use-adapter.ts` 🆕

```typescript
import { AgentAdapter, Project, Task } from '../types';
import { getBrowserUsePath } from '../utils/python-runtime';
import * as path from 'path';

export class BrowserUseAdapter implements AgentAdapter {
  name = 'Browser-Use';
  engineType = 'browser-use' as const;

  getBasePath(): string {
    return getBrowserUsePath();
  }

  getScriptsPath(): string {
    return path.join(this.getBasePath(), 'scripts');
  }

  getTaskScript(): string {
    return path.join('scripts', 'self_explorer.py');
  }

  buildTaskArgs(project: Project, task: Task, taskDir: string): string[] {
    if (project.platform !== 'web') {
      throw new Error('Browser-Use only supports web platform');
    }

    const args = [
      '-u',
      this.getTaskScript(),
      '--platform', 'web',
      '--app', sanitizeAppName(project.name),
      '--root_dir', project.workspaceDir,
      '--task_dir', taskDir,
    ];

    if (task.goal || task.description) {
      args.push('--task_desc', task.goal || task.description);
    }

    if (task.url) {
      args.push('--url', task.url);
    }

    if (task.modelName) {
      args.push('--model_name', task.modelName);
    }

    return args;
  }

  getPythonEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const scriptsDir = this.getScriptsPath();
    const workingDir = this.getBasePath();
    const sharedDir = path.join(path.dirname(workingDir), 'shared');

    return {
      ...baseEnv,
      PYTHONPATH: `${scriptsDir}${path.delimiter}${workingDir}${path.delimiter}${sharedDir}`,
      PYTHONUNBUFFERED: '1',
      // Browser-Use specific
      BROWSER_USE_HEADLESS: 'false',  // Always show browser for debugging
    };
  }

  supportsGoogleLogin(): boolean {
    return true; // Use shared google_login.py
  }

  supportsIntegrationTest(): boolean {
    return false; // No Android support
  }

  supportsPlatform(platform: 'android' | 'web'): boolean {
    return platform === 'web'; // Web only
  }

  // 🆕 Browser-Use specific methods
  isAIDriven(): boolean {
    return true; // Fully AI-driven automation
  }

  requiresHeavyModel(): boolean {
    return true; // Requires vision-capable model
  }

  getRecommendedModel(): string | null {
    return 'gpt-4o'; // Recommended for best results
  }

  getGoogleLoginScript(): string {
    // Use shared script
    return path.join(path.dirname(this.getBasePath()), 'shared', 'google_login.py');
  }

  getIntegrationTestScript(): string | null {
    return null; // Not supported
  }

  getEmulatorCleanupCode(): string | null {
    return null; // No Android support
  }
}
```



```typescript
import { AgentAdapter, Project, Task } from '../types';
import { getGelabPath } from '../utils/python-runtime';
import * as path from 'path';

export class GelabAdapter implements AgentAdapter {
  name = 'GELab-Zero';
  engineType = 'gelab' as const;

  getBasePath(): string {
    return getGelabPath();
  }

  getScriptsPath(): string {
    return path.join(this.getBasePath(), 'klever_wrapper');
  }

  getTaskScript(): string {
    return path.join('klever_wrapper', 'self_explorer.py');
  }

  buildTaskArgs(project: Project, task: Task, taskDir: string): string[] {
    // GELab-Zero specific args (may differ from AppAgent)
    const args = [
      '-u',
      this.getTaskScript(),
      '--platform', project.platform,
      '--app', sanitizeAppName(project.name),
      '--root_dir', project.workspaceDir,
      '--task_dir', taskDir,
    ];

    if (task.goal || task.description) {
      args.push('--task_desc', task.goal || task.description);
    }

    if (task.modelName) {
      args.push('--model_name', task.modelName);
    }

    return args;
  }

  getPythonEnv(baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const scriptsDir = this.getScriptsPath();
    const workingDir = this.getBasePath();
    const sharedDir = path.join(path.dirname(workingDir), 'shared');

    return {
      ...baseEnv,
      PYTHONPATH: `${scriptsDir}${path.delimiter}${workingDir}${path.delimiter}${sharedDir}`,
      PYTHONUNBUFFERED: '1',
    };
  }

  supportsGoogleLogin(): boolean {
    return true; // Use shared google_login.py
  }

  supportsIntegrationTest(): boolean {
    return false; // GELab doesn't have integration test yet
  }

  supportsPlatform(platform: 'android' | 'web'): boolean {
    return platform === 'android'; // GELab currently Android-only
  }

  getGoogleLoginScript(): string {
    // Use shared script
    return path.join(path.dirname(this.getBasePath()), 'shared', 'google_login.py');
  }

  getIntegrationTestScript(): string | null {
    return null; // Not supported
  }

  getEmulatorCleanupCode(): string | null {
    // GELab may use different cleanup logic
    return null;
  }
}
```

#### 2.3 Agent Controller (Updated for 3 agents)
**파일**: `main/utils/agent-controller.ts`

```typescript
import { AppConfig, Project, Task } from '../types';
import { AgentAdapter, AgentConfig } from '../types/agent';
import { AppAgentAdapter } from '../adapters/appagent-adapter';
import { BrowserUseAdapter } from '../adapters/browser-use-adapter'; // 🆕
import { GelabAdapter } from '../adapters/gelab-adapter';

class AgentController {
  private adapters: Map<string, AgentAdapter> = new Map();

  constructor() {
    // Register available adapters
    this.registerAdapter(new AppAgentAdapter());
    this.registerAdapter(new BrowserUseAdapter()); // 🆕
    this.registerAdapter(new GelabAdapter());
  }

  private registerAdapter(adapter: AgentAdapter): void {
    this.adapters.set(adapter.engineType, adapter);
  }

  /**
   * Get agent adapter based on config
   */
  getAdapter(config: AgentConfig): AgentAdapter {
    const adapter = this.adapters.get(config.engineType);

    if (!adapter) {
      throw new Error(`Agent adapter not found: ${config.engineType}`);
    }

    // Validate platform support
    if (config.platform && !adapter.supportsPlatform(config.platform)) {
      throw new Error(
        `Agent ${adapter.name} does not support platform: ${config.platform}`
      );
    }

    return adapter;
  }

  /**
   * Get adapter from app config
   */
  getAdapterFromAppConfig(appConfig: AppConfig, platform?: 'android' | 'web'): AgentAdapter {
    const engineType = appConfig.execution.agentEngine || 'appagent';
    return this.getAdapter({ engineType, platform });
  }

  /**
   * Get adapter for project
   */
  getAdapterForProject(project: Project, appConfig: AppConfig): AgentAdapter {
    return this.getAdapterFromAppConfig(appConfig, project.platform);
  }

  /**
   * 🆕 Get compatible adapters for platform
   * Returns all adapters that support the given platform
   */
  getCompatibleAdapters(platform: 'android' | 'web'): AgentAdapter[] {
    return Array.from(this.adapters.values()).filter((adapter) =>
      adapter.supportsPlatform(platform)
    );
  }

  /**
   * 🆕 Get recommended adapter for web tasks
   * Browser-Use for complex web tasks, AppAgent for simple ones
   */
  getRecommendedWebAdapter(taskComplexity: 'simple' | 'complex'): AgentAdapter {
    if (taskComplexity === 'complex') {
      return this.adapters.get('browser-use') || this.adapters.get('appagent')!;
    }
    return this.adapters.get('appagent')!;
  }

  /**
   * Check if Google Login is supported for current config
   */
  canUseGoogleLogin(appConfig: AppConfig, platform?: 'android' | 'web'): boolean {
    try {
      const adapter = this.getAdapterFromAppConfig(appConfig, platform);
      return adapter.supportsGoogleLogin();
    } catch {
      return false;
    }
  }

  /**
   * List all available adapters
   */
  listAdapters(): AgentAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * 🆕 Get adapter capabilities matrix
   */
  getCapabilitiesMatrix(): {
    engineType: string;
    name: string;
    android: boolean;
    web: boolean;
    aiDriven: boolean;
    heavyModel: boolean;
  }[] {
    return Array.from(this.adapters.values()).map((adapter) => ({
      engineType: adapter.engineType,
      name: adapter.name,
      android: adapter.supportsPlatform('android'),
      web: adapter.supportsPlatform('web'),
      aiDriven: adapter.isAIDriven(),
      heavyModel: adapter.requiresHeavyModel(),
    }));
  }
}

// Singleton instance
export const agentController = new AgentController();
```

---

### Phase 3: 핸들러 리팩토링

#### 3.1 task.ts 리팩토링
**변경 전**:
```typescript
// Line 228-247: 하드코딩된 분기
const agentEngine = appConfig.execution.agentEngine || 'appagent';

if (agentEngine === 'gelab' && project.platform === 'android') {
  workingDir = getGelabPath();
  scriptPath = path.join('klever_wrapper', 'self_explorer.py');
} else {
  workingDir = getAppagentPath();
  scriptPath = path.join('scripts', 'self_explorer.py');
}
```

**변경 후**:
```typescript
// Use agent controller
import { agentController } from '../utils/agent-controller';

const adapter = agentController.getAdapterForProject(project, appConfig);

// Get script path and args from adapter
const workingDir = adapter.getBasePath();
const args = ['-u', ...adapter.buildTaskArgs(project, task, taskDir)];

// Get Python environment from adapter
const pythonEnv = getPythonEnv(); // base env
const agentEnv = adapter.getPythonEnv(pythonEnv);

const taskProcess = spawnBundledPython(args, {
  cwd: workingDir,
  env: {
    ...agentEnv,
    ...configEnvVars,
    PATH: updatedPath,
  }
});
```

#### 3.2 google-login.ts 리팩토링
**변경 전**:
```typescript
// 하드코딩된 경로
const scriptPath = path.join(getAppagentPath(), 'scripts', 'google_login.py');
```

**변경 후**:
```typescript
import { agentController } from '../utils/agent-controller';

ipcMain.handle('google-login:start', async (_event, profileDir: string) => {
  const appConfig = loadAppConfig();
  const adapter = agentController.getAdapterFromAppConfig(appConfig, 'web');

  if (!adapter.supportsGoogleLogin()) {
    return {
      success: false,
      error: `Agent ${adapter.name} does not support Google Login`
    };
  }

  const scriptPath = adapter.getGoogleLoginScript();
  // ... rest of the code
});
```

#### 3.3 integration.ts 리팩토링
**변경 전**:
```typescript
const appagentDir = getAppagentPath();
const scriptPath = path.join(appagentDir, 'scripts', 'and_controller.py');
```

**변경 후**:
```typescript
import { agentController } from '../utils/agent-controller';

ipcMain.handle('integration:test', async (_event, deviceId: string) => {
  const appConfig = loadAppConfig();
  const adapter = agentController.getAdapterFromAppConfig(appConfig, 'android');

  if (!adapter.supportsIntegrationTest()) {
    return {
      success: false,
      error: `Agent ${adapter.name} does not support integration tests`
    };
  }

  const scriptPath = adapter.getIntegrationTestScript();
  // ... rest of the code
});
```

#### 3.4 에뮬레이터 정리 리팩토링
**변경 전**:
```typescript
// task.ts line 45-71
const appagentDir = getAppagentPath();
const cleanupCode = `
import sys
sys.path.insert(0, '${appagentDir.replace(/\\/g, '/')}')
from scripts.and_controller import stop_emulator
stop_emulator()
`;
```

**변경 후**:
```typescript
import { agentController } from '../utils/agent-controller';

async function cleanupEmulatorIfIdle(projectsData: ReturnType<typeof loadProjects>): Promise<void> {
  const appConfig = loadAppConfig();
  const adapter = agentController.getAdapterFromAppConfig(appConfig, 'android');

  const cleanupCode = adapter.getEmulatorCleanupCode();
  if (!cleanupCode) {
    console.log('[emulator-cleanup] Agent does not support emulator cleanup');
    return;
  }

  const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
    cwd: adapter.getBasePath(),
    env: adapter.getPythonEnv(getPythonEnv()),
  });
  // ... rest of the code
}
```

---

### Phase 4: Python 스크립트 업데이트

#### 4.1 Shared Config Loader 생성
**파일**: `agents/shared/config_loader.py`

```python
"""
Unified configuration loader for all agents.
Reads from environment variables (set by Electron) and provides fallback to config.yaml.
"""
import os
from typing import Dict, Any

def load_config() -> Dict[str, Any]:
    """
    Load configuration from environment variables.
    Environment variables are set by Electron's buildEnvFromConfig().

    Returns:
        dict: Configuration dictionary
    """
    config = {
        # Model configuration
        'MODEL_PROVIDER': os.getenv('MODEL_PROVIDER', 'ollama'),
        'MODEL_NAME': os.getenv('MODEL_NAME', 'ollama/llama3.2-vision'),
        'API_KEY': os.getenv('API_KEY', ''),
        'API_BASE_URL': os.getenv('API_BASE_URL', ''),

        # Execution settings
        'MAX_TOKENS': int(os.getenv('MAX_TOKENS', '4096')),
        'TEMPERATURE': float(os.getenv('TEMPERATURE', '0.0')),
        'REQUEST_INTERVAL': int(os.getenv('REQUEST_INTERVAL', '10')),
        'MAX_ROUNDS': int(os.getenv('MAX_ROUNDS', '20')),

        # Android settings
        'ANDROID_SCREENSHOT_DIR': os.getenv('ANDROID_SCREENSHOT_DIR', '/sdcard'),
        'ANDROID_XML_DIR': os.getenv('ANDROID_XML_DIR', '/sdcard'),

        # Web settings
        'WEB_BROWSER_TYPE': os.getenv('WEB_BROWSER_TYPE', 'chromium'),
        'WEB_VIEWPORT_WIDTH': int(os.getenv('WEB_VIEWPORT_WIDTH', '1280')),
        'WEB_VIEWPORT_HEIGHT': int(os.getenv('WEB_VIEWPORT_HEIGHT', '720')),

        # Image settings
        'IMAGE_MAX_WIDTH': int(os.getenv('IMAGE_MAX_WIDTH', '1280')),
        'IMAGE_MAX_HEIGHT': int(os.getenv('IMAGE_MAX_HEIGHT', '720')),
        'IMAGE_QUALITY': int(os.getenv('IMAGE_QUALITY', '95')),
        'IMAGE_COMPRESSION': os.getenv('IMAGE_COMPRESSION', 'true').lower() == 'true',

        # Preferences
        'OUTPUT_LANGUAGE': os.getenv('OUTPUT_LANGUAGE', 'en'),
        'ENABLE_REFLECTION': os.getenv('ENABLE_REFLECTION', 'true').lower() == 'true',
    }

    return config

def get_model_config() -> Dict[str, str]:
    """Get model-related configuration only"""
    return {
        'provider': os.getenv('MODEL_PROVIDER', 'ollama'),
        'model': os.getenv('MODEL_NAME', 'ollama/llama3.2-vision'),
        'api_key': os.getenv('API_KEY', ''),
        'base_url': os.getenv('API_BASE_URL', ''),
    }
```

#### 4.2 Python 스크립트 업데이트
각 에이전트의 Python 스크립트들을 `shared.config_loader` 사용하도록 수정:

**예시**: `agents/appagent/scripts/self_explorer.py`
```python
# 변경 전
import yaml
with open('config.yaml') as f:
    config = yaml.safe_load(f)

# 변경 후
from shared.config_loader import load_config
config = load_config()
```

---

### Phase 5: 설정 UI 업데이트

#### 5.1 Agent Selection UI
**파일**: `src/pages/Settings.tsx`

```typescript
// Add agent engine selection with platform-aware options
<div className="space-y-2">
  <Label htmlFor="agent-engine">Agent Engine</Label>
  <Select
    value={config.execution.agentEngine || 'appagent'}
    onValueChange={(value) => {
      updateConfig({
        ...config,
        execution: {
          ...config.execution,
          agentEngine: value as 'appagent' | 'browser-use' | 'gelab'
        }
      });
    }}
  >
    <SelectTrigger id="agent-engine">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="appagent">
        <div className="flex items-center gap-2">
          <span>AppAgent</span>
          <Badge variant="secondary">Android Only</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Traditional Android automation. Works with any model.
        </p>
      </SelectItem>

      <SelectItem value="browser-use">
        <div className="flex items-center gap-2">
          <span>Browser-Use</span>
          <Badge variant="secondary">Web Only</Badge>
          <Badge variant="default">AI-Driven</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Advanced web automation. Requires vision-capable model (GPT-4o, Claude 3.5+).
        </p>
      </SelectItem>

      <SelectItem value="gelab">
        <div className="flex items-center gap-2">
          <span>GELab-Zero</span>
          <Badge variant="secondary">Android Only</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Multi-device Android automation.
        </p>
      </SelectItem>
    </SelectContent>
  </Select>

  {/* 🆕 Show model recommendation for Browser-Use */}
  {config.execution.agentEngine === 'browser-use' && (
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Recommended Models</AlertTitle>
      <AlertDescription>
        For best results, use: GPT-4o, Claude 3.5 Sonnet, or Gemini 2.0 Flash
      </AlertDescription>
    </Alert>
  )}

  <p className="text-sm text-muted-foreground">
    Select the automation engine. Different engines support different platforms and features.
  </p>
</div>

{/* 🆕 Show capabilities matrix */}
<div className="mt-4">
  <Label>Engine Capabilities Comparison</Label>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Engine</TableHead>
        <TableHead>Android</TableHead>
        <TableHead>Web</TableHead>
        <TableHead>Type</TableHead>
        <TableHead>Model</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow>
        <TableCell>AppAgent</TableCell>
        <TableCell>✅</TableCell>
        <TableCell>✅</TableCell>
        <TableCell>Traditional</TableCell>
        <TableCell>Any</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>Browser-Use</TableCell>
        <TableCell>❌</TableCell>
        <TableCell>✅</TableCell>
        <TableCell>AI-Driven</TableCell>
        <TableCell>Vision</TableCell>
      </TableRow>
      <TableRow>
        <TableCell>GELab-Zero</TableCell>
        <TableCell>✅</TableCell>
        <TableCell>❌</TableCell>
        <TableCell>Traditional</TableCell>
        <TableCell>Local</TableCell>
      </TableRow>
    </TableBody>
  </Table>
</div>
```

#### 5.2 Config Type Update
**파일**: `main/types/config.ts`

```typescript
export interface ExecutionConfig {
  maxTokens: number;
  temperature: number;
  requestInterval: number;
  maxRounds: number;
  agentEngine?: 'appagent' | 'browser-use' | 'gelab';  // Updated for 3 engines
}
```

---

## 상세 설계

### Agent Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                      Task Execution Flow                      │
└──────────────────────────────────────────────────────────────┘

1. User creates task
      ↓
2. IPC Handler (task:start)
      ↓
3. Load AppConfig from config.json
      ↓
4. Agent Controller selects appropriate adapter
      ├─→ Check agentEngine setting (appagent | gelab)
      ├─→ Check platform support
      └─→ Return AgentAdapter instance
      ↓
5. Adapter provides execution details
      ├─→ getBasePath(): Working directory
      ├─→ buildTaskArgs(): CLI arguments
      ├─→ getPythonEnv(): Environment variables
      └─→ getTaskScript(): Script path
      ↓
6. Build environment
      ├─→ Base Python env (getPythonEnv)
      ├─→ Agent-specific env (adapter.getPythonEnv)
      ├─→ Config env vars (buildEnvFromConfig)
      └─→ Merge all
      ↓
7. Spawn Python subprocess
      ├─→ cwd: adapter.getBasePath()
      ├─→ args: adapter.buildTaskArgs()
      └─→ env: merged environment
      ↓
8. Python script runs
      ├─→ Load config from env vars (shared.config_loader)
      ├─→ Import shared utilities (shared.google_login, etc.)
      └─→ Execute task
      ↓
9. Stream output to renderer
      ├─→ Parse progress updates
      ├─→ Update metrics
      └─→ Save to projects.json
      ↓
10. Handle completion
      ├─→ Update task status
      ├─→ Cleanup if needed
      └─→ Notify renderer
```

### Configuration Flow

```
┌────────────────────────────────────────────────────────────┐
│               Configuration Management                      │
└────────────────────────────────────────────────────────────┘

Electron Layer:
~/.klever-desktop/config.json (Single Source of Truth)
    ↓
main/utils/config-storage.ts (loadAppConfig)
    ↓
main/utils/config-env-builder.ts (buildEnvFromConfig)
    ↓
22 Environment Variables
    ├─ MODEL_PROVIDER
    ├─ MODEL_NAME
    ├─ API_KEY
    ├─ ...
    └─ OUTPUT_LANGUAGE
    ↓
Python Subprocess Environment
    ↓
Python Layer:
agents/shared/config_loader.py (load_config)
    ↓
Python Dict
    ↓
Agent Scripts (self_explorer.py, etc.)
```

### Directory Structure (Final - 3 Agents)

```
/KleverDesktop
├── main/                           # Electron Main Process
│   ├── adapters/                   # Agent adapters
│   │   ├── appagent-adapter.ts
│   │   ├── browser-use-adapter.ts  # 🆕
│   │   └── gelab-adapter.ts
│   │
│   ├── handlers/                   # IPC Handlers (refactored)
│   │   ├── task.ts                # Uses agent-controller
│   │   ├── google-login.ts        # Uses agent-controller
│   │   ├── integration.ts         # Uses agent-controller
│   │   └── ...
│   │
│   ├── utils/
│   │   ├── agent-controller.ts    # Agent orchestration (3 engines)
│   │   ├── python-runtime.ts      # Path utilities + getBrowserUsePath() 🆕
│   │   ├── config-storage.ts      # Config loading (unchanged)
│   │   └── config-env-builder.ts  # Env var building (unchanged)
│   │
│   └── types/
│       ├── agent.ts               # Agent interfaces (updated)
│       ├── config.ts              # Updated with agentEngine: 'browser-use'
│       └── ...
│
├── agents/                        # Python Agents
│   ├── requirements.txt           # Unified dependencies (includes browser-use)
│   │
│   ├── shared/                    # Shared scripts
│   │   ├── __init__.py
│   │   ├── config_loader.py      # Env var → dict
│   │   ├── google_login.py       # Common login
│   │   ├── google_login_android.py
│   │   └── utils.py
│   │
│   ├── appagent/                  # AppAgent engine (Android only 🔄)
│   │   └── scripts/
│   │       ├── self_explorer.py  # Uses shared.config_loader (Android only)
│   │       ├── and_controller.py # Android automation
│   │       └── ...               # 🗑️ web_controller.py 제거 예정
│   │
│   ├── browser-use/               # 🆕 Browser-Use engine (Web only, AI-driven)
│   │   ├── scripts/
│   │   │   ├── __init__.py
│   │   │   ├── self_explorer.py  # Browser-Use entry point
│   │   │   └── browser_use_wrapper.py  # LiteLLM integration
│   │   │
│   │   └── requirements.txt      # Browser-Use specific
│   │       # browser-use>=0.11.2
│   │       # langchain>=0.1.0
│   │       # langchain-openai, langchain-anthropic, langchain-ollama
│   │
│   └── gelab-zero/               # GELab-Zero engine (Android only)
│       └── klever_wrapper/
│           ├── self_explorer.py  # Uses shared.config_loader
│           └── ...
│
└── src/                          # Renderer Process
    └── pages/
        └── Settings.tsx          # Agent engine selection UI (3 options)
```

---

## 마이그레이션 체크리스트 (Updated for 3 Agents)

### Phase 1: 공통 레이어 ✅
- [ ] `agents/shared/` 디렉토리 생성
- [ ] `google_login.py` 이동 및 import 경로 업데이트
- [ ] `google_login_android.py` 이동
- [ ] `config_loader.py` 생성 및 테스트
- [ ] `utils.py` 생성
- [ ] `agents/appagent/config.yaml` 제거
- [ ] Python 스크립트들 `shared.config_loader` 사용하도록 업데이트
- [ ] 테스트: 기존 task 실행이 정상 작동하는지 확인

### Phase 1.5: Browser-Use 분리 & AppAgent 웹 코드 제거 ✅ 🆕
- [ ] `agents/browser-use/` 디렉토리 생성
- [ ] `agents/browser-use/scripts/` 생성
- [ ] `agents/appagent/scripts/browser_use_wrapper.py` → `agents/browser-use/scripts/` 이동
- [ ] `agents/browser-use/scripts/self_explorer.py` 생성 (Browser-Use 전용 entry point)
- [ ] `agents/browser-use/requirements.txt` 생성 (browser-use, langchain 등)
- [ ] `main/utils/python-runtime.ts`에 `getBrowserUsePath()` 추가
- [ ] 🔄 **AppAgent 웹 코드 제거**:
  - [ ] `agents/appagent/scripts/web_controller.py` 제거
  - [ ] `agents/appagent/scripts/self_explorer.py`에서 `platform == 'web'` 분기 제거
  - [ ] `agents/appagent/learn.py`에서 웹 관련 코드 제거
  - [ ] `agents/appagent/run.py`에서 웹 관련 코드 제거
- [ ] 테스트: Browser-Use 단독 실행 확인
- [ ] 테스트: AppAgent는 Android만 실행 확인

### Phase 2: Adapter 레이어 ✅
- [ ] `main/types/agent.ts` 생성 (인터페이스 정의, 3 engines)
- [ ] `main/adapters/appagent-adapter.ts` 구현
- [ ] `main/adapters/browser-use-adapter.ts` 구현 🆕
- [ ] `main/adapters/gelab-adapter.ts` 구현
- [ ] `main/utils/agent-controller.ts` 구현 (3 engines)
- [ ] 단위 테스트 작성 (adapter methods)
- [ ] TypeScript 컴파일 오류 없는지 확인

### Phase 3: 핸들러 리팩토링 ✅
- [ ] `main/handlers/task.ts` 리팩토링
  - [ ] `startTaskExecution()` 함수
  - [ ] `cleanupEmulatorIfIdle()` 함수
  - [ ] `cleanupTaskProcesses()` 함수
- [ ] `main/handlers/google-login.ts` 리팩토링
- [ ] `main/handlers/integration.ts` 리팩토링
- [ ] 각 핸들러별 테스트 (AppAgent, Browser-Use, GELab)

### Phase 4: 설정 UI ✅
- [ ] `main/types/config.ts`에 `agentEngine` 필드 추가 (3 옵션)
- [ ] `src/pages/Settings.tsx`에 Agent Engine 선택 UI 추가 (3 옵션 + 비교표)
- [ ] Browser-Use 선택 시 모델 권장 표시
- [ ] 기본값 설정 (appagent)
- [ ] UI 테스트 (설정 저장/로드)

### Phase 5: 통합 테스트 ✅
- [ ] AppAgent로 Android task 실행 ✅
- [ ] 🔄 AppAgent로 Web task 실행 시도 → 에러 확인 (Android only)
- [ ] Browser-Use로 Web task 실행 🆕
- [ ] GELab로 Android task 실행
- [ ] Google Login (Web) - Browser-Use만 테스트 🆕
- [ ] Google Login (Android) - AppAgent 테스트
- [ ] Integration Test (AppAgent) - Android only
- [ ] Emulator cleanup (AppAgent)
- [ ] 설정 변경 후 에이전트 전환 (3 engines)
- [ ] 🔄 Web 프로젝트에서 AppAgent 선택 시 경고 메시지 확인

### Phase 6: Browser-Use 최적화 ✅ 🆕
- [ ] 복잡한 웹 작업 벤치마크 (로그인, 폼, 장바구니 등)
- [ ] AppAgent Web vs Browser-Use 정확도 비교
- [ ] 토큰 사용량 및 비용 측정
- [ ] 권장 모델 리스트 작성 (GPT-4o, Claude 3.5, Gemini 2.0 등)
- [ ] 에러 핸들링 개선 (vision model 없을 때)

### Phase 7: 문서화 ✅
- [ ] CLAUDE.md 업데이트 (3-agent 아키텍처 설명)
- [ ] README 업데이트 (Browser-Use 소개)
- [ ] API 문서 생성 (AgentAdapter interface)
- [ ] Migration guide 작성 (기존 사용자용)
- [ ] Browser-Use 사용 가이드 작성 🆕

### Phase 8: 배포 ✅
- [ ] 버전 업데이트 (2.1.0)
- [ ] CHANGELOG 작성 (Browser-Use 추가 강조)
- [ ] CI/CD 테스트
- [ ] 릴리스 노트 작성
- [ ] GitHub Release

---

## 이점 (3-Agent Architecture)

### 개발자
1. **확장성**: 새 에이전트 추가 시 Adapter만 구현하면 됨
2. **테스트 용이성**: Adapter를 mock으로 교체 가능
3. **유지보수**: 에이전트 로직이 한 곳에 캡슐화됨
4. **타입 안전성**: TypeScript 인터페이스로 계약 명확화
5. **🆕 책임 분리**: Browser-Use가 독립 폴더로 분리되어 관리 용이

### 사용자
1. **선택권**: 플랫폼과 작업에 맞는 에이전트 선택
2. **일관성**: UI는 동일, 백엔드만 변경
3. **안정성**: 에이전트별 격리로 한 쪽 에러가 다른 쪽에 영향 없음
4. **성능**: 플랫폼 최적화된 엔진 사용 가능
5. **🆕 웹 자동화 품질**: Browser-Use로 전문화, 68% 정확도 향상 (52.5% → 88.2%)
6. **🔄 명확한 역할 분리**: AppAgent(Android), Browser-Use(Web), GELab(Android multi-device)

### 프로젝트
1. **모듈화**: 각 컴포넌트가 명확한 책임
2. **재사용성**: 공통 기능은 shared/에 집중
3. **진화 가능성**: 향후 더 많은 에이전트 추가 가능
4. **설정 일원화**: Electron의 config.json이 단일 진실 원천
5. **🆕 Browser-Use 독립성**: appagent와 분리되어 각자 최적화 가능

---

## 3-Agent 비교표

| 특징 | AppAgent | Browser-Use 🆕 | GELab-Zero |
|------|----------|---------------|-----------|
| **플랫폼** | Android only 🔄 | Web only | Android only |
| **방식** | Traditional | AI-driven | Traditional |
| **모델 요구사항** | Any (via LiteLLM) | Vision (GPT-4o, Claude 3.5+) | Any (via LiteLLM) 🔄 |
| **웹 정확도** | N/A (removed) | 88.2% 🏆 | N/A |
| **Android 정확도** | 89% 🏆 | N/A | 89% 🏆 |
| **복잡도** | 중간 | 높음 | 높음 |
| **속도** | 빠름 | 중간 | 빠름 |
| **비용** | 낮음 (로컬 가능) | 높음 (API 호출) | 낮음 (로컬 가능) |
| **오프라인** | ✅ (Ollama) | ❌ | ✅ (Ollama) |
| **Google Login (Web)** | ❌ | ✅ | ❌ |
| **Google Login (Android)** | ✅ | ❌ | ❌ |
| **통합 테스트** | ✅ | ❌ | ❌ |

**추천 사용 사례**:
- **AppAgent**: Android 앱 자동화 (원래 목적으로 복귀 🔄), LiteLLM 지원 (100+ models), 로컬 또는 API 모델
- **Browser-Use**: 모든 웹 작업 (로그인, SPA, 장바구니 등), Vision 모델 필수
- **GELab-Zero**: 멀티 디바이스 Android 테스트, LiteLLM 지원 (100+ models) 🔄, 로컬 또는 API 모델

**🔄 중요 변경사항**:
- AppAgent는 더 이상 웹을 지원하지 않습니다 (원래 Android 전용으로 복귀)
- 모든 웹 자동화는 Browser-Use를 사용해야 합니다
- AppAgent의 웹 관련 코드(`web_controller.py` 등)는 제거됩니다
- **GELab도 LiteLLM 통합으로 100+ provider 지원** (구식 OpenAI SDK 제거)

---

## 독립 실행 지원 (Standalone Execution)

### ✅ 결론: 리팩토링 후에도 독립 실행 가능

공통 모듈을 `agents/shared/`로 추출한 후에도 **각 에이전트는 여전히 독립적으로 실행 가능**합니다. 테스트 편의성은 유지됩니다.

### 핵심 메커니즘

#### 1. 자동 Python Path 설정

각 에이전트 스크립트 시작 시 `agents/` 루트를 자동으로 Python path에 추가:

```python
# agents/appagent/scripts/self_explorer.py (시작 부분)
import sys
from pathlib import Path

# Ensure agents root is in Python path (works both standalone and Electron)
agents_root = Path(__file__).parent.parent.parent  # ../../ → agents/
if str(agents_root) not in sys.path:
    sys.path.insert(0, str(agents_root))

# Now shared modules are importable
from shared.llm.model_factory import create_model
from shared.android.emulator import start_emulator
from shared.utils.config import load_config
```

#### 2. 독립 실행 래퍼 스크립트

각 에이전트에 `run_standalone.sh` 제공 (권장):

```bash
# agents/appagent/run_standalone.sh
#!/bin/bash

# Auto-detect agents directory
AGENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PYTHONPATH="${AGENTS_DIR}"

# Set default environment variables (override as needed)
export MODEL_NAME="${MODEL_NAME:-ollama/llama3.2-vision}"
export MAX_TOKENS="${MAX_TOKENS:-4096}"
export TEMPERATURE="${TEMPERATURE:-0.0}"
# ... 22 env vars total

# Run the agent
python "${AGENTS_DIR}/appagent/scripts/self_explorer.py" "$@"
```

**사용 예시**:
```bash
cd agents/appagent

# 기본 설정으로 실행
./run_standalone.sh --platform android --app MyApp --task_desc "Test task"

# 모델 오버라이드
MODEL_NAME="gpt-4o" API_KEY="sk-..." ./run_standalone.sh --platform android --app MyApp --task_desc "..."
```

#### 3. 하이브리드 설정 로더

`agents/shared/utils/config.py`가 다음 우선순위로 설정 로드:

```
1. 환경 변수 (Electron 실행 시, 또는 수동 설정)
   ↓
2. agents/{agent}/config.test.yaml (독립 실행 시 fallback)
   ↓
3. 하드코딩된 기본값 (최후 수단)
```

이를 통해:
- **Electron 실행**: 환경 변수 22개를 `buildEnvFromConfig()`로 자동 주입
- **독립 실행**: `config.test.yaml` 또는 환경 변수로 설정

#### 4. 독립 실행 전/후 비교

**변경 전** (현재):
```bash
cd agents/appagent
python scripts/self_explorer.py --platform android --app MyApp --task_desc "..."
# ✅ 작동: appagent 내부에 모든 코드 포함
```

**변경 후** (리팩토링 후):
```bash
cd agents/appagent

# 방법 A: PYTHONPATH 수동 설정
PYTHONPATH=.. python scripts/self_explorer.py --platform android --app MyApp --task_desc "..."

# 방법 B: 래퍼 스크립트 사용 (권장)
./run_standalone.sh --platform android --app MyApp --task_desc "..."

# ✅ 여전히 작동: shared 모듈을 import할 수 있음
```

### 독립 실행 체크리스트

각 에이전트 폴더에 추가할 파일:

```
agents/appagent/
├── scripts/
│   ├── self_explorer.py      # sys.path 설정 코드 추가
│   └── ...
├── run_standalone.sh          # 🆕 독립 실행 래퍼
├── config.test.yaml           # 🆕 테스트용 설정 (optional, gitignore)
└── README_STANDALONE.md       # 🆕 독립 실행 가이드
```

### 실행 모드 비교

| | Electron 실행 | 독립 실행 (Standalone) |
|---|---|---|
| **Python Path** | `python-runtime.ts`에서 자동 설정 | 스크립트 시작 시 `sys.path.insert()` |
| **설정 로드** | 환경 변수 22개 자동 주입 | 환경 변수 또는 `config.test.yaml` |
| **실행 명령** | Electron UI에서 클릭 | `./run_standalone.sh ...` |
| **사용 사례** | 프로덕션, 일반 사용자 | 개발, 디버깅, 유닛 테스트 |
| **장점** | UI/UX 통합, 자동화 | 빠른 반복, IDE 디버깅 |

### 추가 이점

1. **개발 속도**: Electron 빌드 없이 Python만 수정하고 즉시 테스트
2. **디버깅**: IDE (PyCharm, VS Code)에서 breakpoint 설정하여 디버깅
3. **CI/CD**: GitHub Actions에서 에이전트 단독 테스트 가능
4. **문서화**: 각 에이전트의 독립성과 인터페이스가 명확히 정의됨

---

## 리스크 및 대응

### 리스크 1: 기존 작업 중단
**대응**: Phase별로 점진적 마이그레이션, 각 단계마다 회귀 테스트

### 리스크 2: 에이전트 간 기능 차이
**대응**: Adapter의 `supports*()` 메서드로 기능 가용성 체크, UI에서 지원 여부 표시

### 리스크 3: Python 경로 충돌
**대응**: `agents/shared/`를 PYTHONPATH에 추가, import 순서 명확히 정의

### 리스크 4: 성능 저하
**대응**: Adapter는 경량 객체, 인스턴스 재사용, 캐싱 활용

---

## 다음 단계

1. ✅ **현재 문서 리뷰**: 팀원들과 설계 리뷰
2. 🔄 **Phase 1 시작**: 공통 레이어 구축 (가장 중요)
3. 🔄 **단계별 구현**: 각 Phase를 순차적으로 완료
4. 🔄 **지속적 테스트**: 각 단계마다 기존 기능 검증
5. 📝 **문서 업데이트**: 구현 진행에 맞춰 문서 갱신

**예상 소요 시간**: 2-3주 (단계별 진행)

**우선순위**: HIGH (현재 구조는 확장성에 제약)
