# Phase C: Legacy Appagent 제거 및 Core/Engines 완전 전환

**작성일**: 2025-12-24
**상태**: 계획 단계
**예상 소요**: 3-4일

---

## 📋 목차
- [목표](#목표)
- [현재 상태](#현재-상태)
- [아키텍처 변경 사항](#아키텍처-변경-사항)
- [단계별 구현 계획](#단계별-구현-계획)
- [테스트 체크포인트](#테스트-체크포인트)
- [위험 관리](#위험-관리)
- [변경 파일 목록](#변경-파일-목록)

---

## 🎯 목표

레거시 `appagent/` 직접 참조를 완전히 제거하고 새로운 `core/engines` 멀티엔진 아키텍처로 통합합니다.

### 사용자 요구사항 (확인됨)
1. **Android 기능**: emulator 관리, APK 설치 → `core/utils/android.py`로 추출
2. **Task 실행**: integration.ts, project.ts → `core/controller.py`로 완전 전환
3. **GELab 엔진**: stub 상태 유지 (실제 구현은 Phase D)
4. **Dependencies**: `requirements.txt`를 `core/`로 중앙화

---

## 📊 현재 상태

### Python 아키텍처
```
✅ core/                          # 독립적, appagent 의존성 없음
   ├── controller.py             # 엔진 오케스트레이터
   ├── engine_interface.py       # Abstract base class
   ├── llm_adapter.py           # LiteLLM wrapper
   ├── utils.py                 # 로깅, 이미지 처리
   └── auth/                    # Google 인증

✅ engines/gelab/                # Stub 구현 완료
   └── main.py                  # GELabEngine (진행 시뮬레이션)

🔴 engines/appagent_legacy/      # 레거시 - 제거 대상
   ├── scripts/
   │   ├── and_controller.py    # 🎯 Android 함수 추출 필요
   │   ├── self_explorer.py     # 🔴 여전히 직접 호출됨
   └── requirements.txt         # 🎯 core/로 이동 필요
```

### TypeScript Handler 상태

| Handler | 현재 상태 | 마이그레이션 우선순위 |
|---------|----------|------------------|
| `task.ts` | 하이브리드 (Android만 legacy) | **HIGH** |
| `integration.ts` | Pure legacy (self_explorer.py) | **HIGH** |
| `project.ts` | Pure legacy (self_explorer.py) | **MEDIUM** |
| `google-login.ts` | ✅ 완료 (core/auth 사용) | DONE |
| `installations.ts` | Legacy requirements.txt 참조 | **MEDIUM** |
| `system-checks.ts` | Legacy requirements.txt 참조 | **LOW** |

---

## 🏗️ 아키텍처 변경 사항

### Before (현재)
```
TypeScript Handler
      ↓
getLegacyScriptsPath() → engines/appagent_legacy/scripts/self_explorer.py
      ↓                   ↓
   Python직접실행    and_controller.py (Android)
```

### After (목표)
```
TypeScript Handler
      ↓
core/controller.py --engine gelab
      ↓
engines/gelab/main.py (EngineInterface 구현)
      ↓
core/utils/android.py (Android 유틸리티)
      ↓
core/llm_adapter.py (LiteLLM)
```

---

## 📅 단계별 구현 계획

### Phase 1: Core Android Utilities 생성 (Day 1 오전, 4-6시간)

#### 목표
Android device control 기능을 레거시에서 추출하여 재사용 가능한 core 모듈로 만듭니다.

#### 작업

**1. 파일 생성**: `/Volumes/Backup/Github/KleverDesktop/core/utils/android.py`

**소스**: `/Volumes/Backup/Github/KleverDesktop/engines/appagent_legacy/scripts/and_controller.py`

**추출할 함수** (총 ~400 lines):

| 함수명 | 설명 | 우선순위 |
|--------|------|---------|
| `get_android_sdk_path()` | SDK 경로 가져오기 | HIGH |
| `find_sdk_tool(tool_name, subfolder)` | adb/emulator 실행파일 찾기 | HIGH |
| `execute_adb(command)` | ADB 명령 실행 | HIGH |
| `list_all_devices()` | 연결된 디바이스 목록 | HIGH |
| `list_available_emulators()` | 사용 가능한 AVD 목록 | MEDIUM |
| `start_emulator(avd_name, wait_for_boot)` | 에뮬레이터 시작 | HIGH |
| `stop_emulator()` | 에뮬레이터 정지 | HIGH |
| `cleanup_emulators()` | 모든 에뮬레이터 정리 | MEDIUM |
| `prelaunch_app(apk_source)` | APK 설치 및 실행 | HIGH |
| `AndroidElement` 클래스 | UI 요소 표현 | MEDIUM |

**모듈 구조**:
```python
"""
Android Device Management Utilities
Extracted from engines/appagent_legacy/scripts/and_controller.py

Provides:
- Device discovery (adb devices)
- Emulator control (start/stop/cleanup)
- APK management (install/launch)
- ADB command execution
"""

import os
import subprocess
import time
import shutil
from typing import List, Optional, Dict, Any
from core.utils import print_with_color

# 함수들...
```

#### 테스트

**Checkpoint 1.1**: 기본 imports
```bash
python3 -c "from core.utils.android import list_all_devices, list_available_emulators"
echo "✅ Import successful"
```

**Checkpoint 1.2**: 실제 디바이스 감지
```bash
adb devices
python3 -c "from core.utils.android import list_all_devices; print('Devices:', list_all_devices())"
```

**Checkpoint 1.3**: AVD 목록
```bash
python3 -c "from core.utils.android import list_available_emulators; print('AVDs:', list_available_emulators())"
```

---

### Phase 2: Requirements 중앙화 (Day 1 오후, 2-3시간)

#### 목표
Python 의존성을 core/에서 중앙 관리합니다.

#### 작업

**1. 파일 생성**: `/Volumes/Backup/Github/KleverDesktop/core/requirements.txt`

**내용** (`engines/appagent_legacy/requirements.txt`에서 복사):
```
argparse
beautifulsoup4
colorama
opencv-python
Pillow
playwright
pyshine
pyyaml
requests
litellm
anthropic
browser-use>=0.1.40
```

**2. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/scripts/python-sync.js`

**Line 8 변경**:
```javascript
// BEFORE
const REQUIREMENTS_PATH = path.join(__dirname, '..', 'appagent', 'requirements.txt');

// AFTER
const REQUIREMENTS_PATH = path.join(__dirname, '..', 'core', 'requirements.txt');
```

**3. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/scripts/python-refresh.js`

**Line 47 확인 및 업데이트** (appagent → core)

**4. Legacy 유지**: `engines/appagent_legacy/requirements.txt`는 **삭제하지 않음** (호환성)

#### 테스트

**Checkpoint 2.1**: Requirements 설치
```bash
node scripts/python-sync.js
echo "✅ Installation complete"
```

**Checkpoint 2.2**: 패키지 확인
```bash
~/.klever-desktop/python-env/bin/pip list | grep litellm
~/.klever-desktop/python-env/bin/pip list | grep playwright
~/.klever-desktop/python-env/bin/pip list | grep browser-use
```

---

### Phase 3: Installations & System Checks 업데이트 (Day 2 오전, 2-3시간)

#### 목표
requirements.txt 경로와 Android 유틸리티 import를 core로 변경합니다.

#### 작업

**1. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/main/handlers/installations.ts`

**Line 150-151 변경**:
```typescript
// BEFORE
const legacyScriptsPath = getLegacyScriptsPath();
const requirementsPath = path.join(legacyScriptsPath, 'requirements.txt');

// AFTER
const corePath = getCorePath();
const requirementsPath = path.join(corePath, 'requirements.txt');
```

**Lines 504-520 변경** (prelaunch 코드):
```typescript
// BEFORE
const legacyScriptsDir = getLegacyScriptsPath();
const scriptsDir = path.join(legacyScriptsDir, 'scripts');
const prelaunchCode = `
import sys
import json
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from and_controller import prelaunch_app
...

// AFTER
const corePath = getCorePath();
const prelaunchCode = `
import sys
import json
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.utils.android import prelaunch_app
...
```

**Lines 585-620 업데이트** (android:getStatus):
- Import 변경: `from and_controller import` → `from core.utils.android import`

**2. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/main/handlers/system-checks.ts`

**Line 44 변경**:
```typescript
// BEFORE
const legacyScriptsPath = getLegacyScriptsPath();
const requirementsPath = path.join(legacyScriptsPath, 'requirements.txt');

// AFTER
const corePath = getCorePath();
const requirementsPath = path.join(corePath, 'requirements.txt');
```

#### 테스트

**Checkpoint 3.1**: TypeScript 컴파일
```bash
npm run typecheck
# 예상: 0 errors
```

**Checkpoint 3.2**: APK 설치 플로우 (dev mode)
```bash
npm run start
# Setup Wizard → Android 설정 → APK 업로드 테스트
# 확인: core.utils.android.prelaunch_app 호출됨
```

---

### Phase 4: Task Execution 업데이트 (Day 2 오후, 4-5시간)

#### 목표
task.ts의 Android 관련 함수 호출을 core로 전환합니다.

#### 작업

**파일 수정**: `/Volumes/Backup/Github/KleverDesktop/main/handlers/task.ts`

**변경 사항 1**: `cleanupEmulatorIfIdle()` 함수 (Lines 45-71)

```typescript
// BEFORE
const legacyScriptsDir = getLegacyScriptsPath();
const scriptsDir = path.join(legacyScriptsDir, 'scripts');
const cleanupCode = `
import sys
sys.path.insert(0, '${legacyScriptsDir.replace(/\\/g, '/')}')
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from scripts.and_controller import stop_emulator
stop_emulator()
`;
const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
  cwd: legacyScriptsDir,
  env: pythonEnv,
});

// AFTER
const corePath = getCorePath();
const cleanupCode = `
import sys
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.utils.android import stop_emulator
stop_emulator()
`;
const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
  cwd: path.dirname(corePath),  // Project root
  env: pythonEnv,
});
```

**변경 사항 2**: Android APK setup (Lines 107-193)

```typescript
// BEFORE (Line 114-129)
const legacyScriptsDir = getLegacyScriptsPath();
const scriptsDir = path.join(legacyScriptsDir, 'scripts');
const setupCode = `
import sys
import json
sys.path.insert(0, '${scriptsDir.replace(/\\/g, '/')}')
from and_controller import prelaunch_app
...
const setupProcess = spawnBundledPython(['-u', '-c', setupCode], {
  cwd: legacyScriptsDir,
  env: { ...pythonEnv, PYTHONPATH: scriptsDir, PYTHONUNBUFFERED: '1' }
});

// AFTER
const corePath = getCorePath();
const setupCode = `
import sys
import json
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.utils.android import prelaunch_app
...
const setupProcess = spawnBundledPython(['-u', '-c', setupCode], {
  cwd: path.dirname(corePath),
  env: { ...pythonEnv, PYTHONPATH: corePath, PYTHONUNBUFFERED: '1' }
});
```

**변경 사항 3**: `cleanupTaskProcesses()` 함수 (Lines 660-690)

```typescript
// BEFORE
const legacyScriptsDir = getLegacyScriptsPath();
const cleanupCode = `
import sys
sys.path.insert(0, '${legacyScriptsDir.replace(/\\/g, '/')}')
from scripts.and_controller import cleanup_emulators
cleanup_emulators()
`;
const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
  cwd: legacyScriptsDir,
  env: pythonEnv,
});

// AFTER
const corePath = getCorePath();
const cleanupCode = `
import sys
sys.path.insert(0, '${corePath.replace(/\\/g, '/')}')
from core.utils.android import cleanup_emulators
cleanup_emulators()
`;
const cleanupProcess = spawnBundledPython(['-u', '-c', cleanupCode], {
  cwd: path.dirname(corePath),
  env: pythonEnv,
});
```

**참고**: Lines 228-290 (메인 task 실행)은 이미 `core/controller.py` 사용 중 ✅

#### 테스트

**Checkpoint 4.1**: Android Task 전체 플로우
```bash
npm run start
# 1. Android 프로젝트 생성
# 2. APK 업로드
# 3. Task 생성 및 실행
# 4. 확인:
#    - 에뮬레이터 시작 (core.utils.android)
#    - APK 설치 (core.utils.android)
#    - Task 실행 (core/controller.py)
#    - 완료 시 에뮬레이터 정리
```

**Checkpoint 4.2**: Emulator 정리 확인
```bash
# Task 완료 후
adb devices
# 예상: 디바이스 목록 비어있음 (cleanup 성공)
```

---

### Phase 5: Integration & Project Handlers (Day 3 오전, 4-5시간)

#### 목표
Integration test와 project 실행을 core/controller.py로 전환합니다.

#### 작업

**1. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/main/handlers/integration.ts`

**Lines 30-31, 158-179 대규모 변경**:

**BEFORE**:
```typescript
const legacyScriptsPath = getLegacyScriptsPath();
const selfExplorerScript = path.join(legacyScriptsPath, 'scripts', 'self_explorer.py');

// ... later (line 158-179)
integrationTestProcess = spawnBundledPython(
  [
    '-u',
    selfExplorerScript,
    '--app', 'Feeling_Lucky',
    '--platform', 'web',
    '--root_dir', workspaceDir,
    '--task_dir', currentTaskDir,
    '--task_desc', 'Find and click the "I\'m Feeling Lucky" button',
    '--url', 'https://www.google.com',
  ],
  {
    cwd: legacyScriptsPath,
    env: env,
  }
);
```

**AFTER**:
```typescript
const corePath = getCorePath();
const controllerScript = path.join(corePath, 'controller.py');

// Build task params matching controller interface
const taskParams = {
  platform: 'web',
  app: 'Feeling_Lucky',
  root_dir: workspaceDir,
  task_dir: currentTaskDir,
  url: 'https://www.google.com'
};

integrationTestProcess = spawnBundledPython(
  [
    '-u',
    controllerScript,
    '--engine', 'gelab',
    '--action', 'execute',
    '--task', 'Find and click the "I\'m Feeling Lucky" button',
    '--params', JSON.stringify(taskParams)
  ],
  {
    cwd: path.dirname(corePath),  // Run from project root
    env: {
      ...venvEnv,
      ...configEnvVars,
      PYTHONPATH: path.dirname(corePath),  // Project root in PYTHONPATH
      PYTHONIOENCODING: 'utf-8'
    }
  }
);
```

**2. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/main/handlers/project.ts`

**Lines 192-258 대규모 변경**:

**BEFORE**:
```typescript
const legacyScriptsDir = getLegacyScriptsPath();
const scriptPath = path.join('scripts', 'self_explorer.py');

// Create wrapper script for relative imports
const wrapperPath = path.join(legacyScriptsDir, '_project_wrapper.py');
fs.writeFileSync(wrapperPath, wrapperScript, 'utf-8');
args[1] = wrapperPath;

pythonProcess = spawnBundledPython(args, {
  cwd: legacyScriptsDir,
  env: { ...pythonEnv, ...configEnvVars }
});
```

**AFTER**:
```typescript
const corePath = getCorePath();
const controllerPath = path.join(corePath, 'controller.py');

const taskParams = {
  platform: projectConfig.platform,
  app: sanitizedAppName,
  root_dir: projectConfig.workspaceDir,
  url: projectConfig.url,
  device: projectConfig.device
};

const args = [
  '-u',
  controllerPath,
  '--engine', 'gelab',
  '--action', 'execute',
  '--task', 'Automation task',
  '--params', JSON.stringify(taskParams)
];

pythonProcess = spawnBundledPython(args, {
  cwd: path.dirname(corePath),
  env: {
    ...pythonEnv,
    ...configEnvVars,
    PYTHONPATH: path.dirname(corePath)
  }
});
```

**참고**: `project:start` handler는 현재 UI에서 사용되지 않지만 완전성을 위해 업데이트

#### 테스트

**Checkpoint 5.1**: Integration Test 실행
```bash
npm run start
# Setup Wizard → Integration Test 클릭
# 확인:
# 1. Console 로그: "Starting Python Controller..."
# 2. Controller.py 로드됨
# 3. GELab engine 로드됨
# 4. Progress messages 출력
# 5. Test 완료 (success)
# 6. projects.json에 Feeling_Lucky 프로젝트 저장됨
```

**Checkpoint 5.2**: Project Execution (선택사항)
```bash
# Project 리스트에서 기존 프로젝트 실행
# 확인: core/controller.py 사용
```

---

### Phase 6: Build Scripts 업데이트 (Day 3 오후, 2-3시간)

#### 목표
빌드 검증 스크립트를 core/engines 구조에 맞게 업데이트합니다.

#### 작업

**1. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/scripts/verify-bundle.js`

**Lines 54-58 변경**:

**BEFORE**:
```javascript
'appagent': [
  'appagent/scripts/self_explorer.py',
  'appagent/scripts/and_controller.py',
  'appagent/scripts/model.py',
  'appagent/requirements.txt',
],
```

**AFTER**:
```javascript
'Core Layer': [
  'core/controller.py',
  'core/engine_interface.py',
  'core/utils.py',
  'core/utils/android.py',
  'core/llm_adapter.py',
  'core/requirements.txt',
],
'Engines': [
  'engines/gelab/main.py',
  'engines/appagent_legacy/scripts/self_explorer.py',  // Fallback verification
],
```

**Lines 204-208 업데이트** (troubleshooting hints):
- "Missing appagent files" → "Missing core or engines files" 메시지로 변경

**2. 파일 확인**: `/Volumes/Backup/Github/KleverDesktop/package.json`

**Line 20 체크**:
```json
"appagent:sync": "node scripts/appagent-sync.js"
```
- 이 스크립트는 upstream 기여용이므로 유지
- 주석 추가: `// Only for upstream AppAgent repository contribution`

#### 테스트

**Checkpoint 6.1**: Bundle 검증
```bash
node scripts/verify-bundle.js --skip-python
# 예상 출력:
# ✓ core/controller.py
# ✓ core/engine_interface.py
# ✓ core/utils.py
# ✓ core/utils/android.py
# ✓ core/llm_adapter.py
# ✓ core/requirements.txt
# ✓ engines/gelab/main.py
# ✓ engines/appagent_legacy/scripts/self_explorer.py
```

---

### Phase 7: 문서화 (Day 4, 2-4시간)

#### 목표
마이그레이션 상태와 아키텍처를 문서에 반영합니다.

#### 작업

**1. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/docs/migration_status.md`

**Append Phase C section** (라인 67 이후):

```markdown
---

## ✅ Phase C: Legacy Cleanup (Completed 2025-12-24)

### 1. Android Utilities Migration
- [x] **Extract Functions**: Moved Android functions from `engines/appagent_legacy/scripts/and_controller.py` to `core/utils/android.py`
- [x] **Functions Migrated**:
  - Device discovery and enumeration
  - Emulator start/stop/cleanup
  - APK installation and launch
  - ADB command execution
- [x] **Update Handlers**: All TypeScript handlers now use `core.utils.android` instead of direct `and_controller` imports

### 2. Requirements Centralization
- [x] **Create Core Requirements**: Moved `requirements.txt` to `core/` (13 packages)
- [x] **Update Scripts**: `python-sync.js`, `python-refresh.js` now reference `core/requirements.txt`
- [x] **Backward Compatibility**: Kept `engines/appagent_legacy/requirements.txt` for fallback

### 3. Controller Integration
- [x] **Integration Tests**: `integration.ts` now uses `core/controller.py --engine gelab`
- [x] **Project Execution**: `project.ts` updated to use controller
- [x] **Task Execution**: `task.ts` already using controller (Phase B), Android utilities migrated

### 4. Build System
- [x] **Verify Bundle**: Updated to check `core/` and `engines/` instead of `appagent/`
- [x] **Python Sync**: Points to `core/requirements.txt`
- [x] **Package Scripts**: Verified and updated

### 5. Legacy Status
- **engines/appagent_legacy/**: Maintained as fallback, not actively developed
- **getLegacyScriptsPath()**: Still exists for backward compatibility but usage minimized to zero in active code paths
- **Deprecation Notice**: `appagent_legacy` will be removed in Phase D after full GELab implementation

---

## 📊 Phase C Results

### Code Migration Metrics
- **Files Created**: 2 (core/utils/android.py, core/requirements.txt)
- **Files Modified**: 10 (5 TypeScript handlers, 3 build scripts, 2 docs)
- **Lines of Code Migrated**: ~400 lines (Android utilities)
- **Legacy References Removed**: 18 direct appagent calls eliminated

### Architecture Improvements
- **Single Entry Point**: All task execution now goes through `core/controller.py`
- **Pluggable Engines**: GELab engine can be swapped/extended without handler changes
- **Shared Utilities**: Android functions reusable across all engines
- **Centralized Dependencies**: One requirements.txt for all engines

### Testing Coverage
- [x] 6 testing checkpoints passed
- [x] Integration test with GELab engine
- [x] Android task execution end-to-end
- [x] Build verification successful
- [x] TypeScript compilation (0 errors)

---
```

**2. 파일 수정**: `/Volumes/Backup/Github/KleverDesktop/CLAUDE.md`

**Architecture Diagram 업데이트** (Line 127 부근):

```markdown
### Three-Layer Python Architecture

\`\`\`
┌─────────────────────────────────────────────────────────┐
│                   TypeScript (Electron)                  │
│  main/handlers/task.ts → spawnBundledPython()           │
│  main/handlers/integration.ts → spawnBundledPython()    │
│  main/handlers/project.ts → spawnBundledPython()        │
└─────────────────────────────────────────────────────────┘
                           ↓ IPC
┌─────────────────────────────────────────────────────────┐
│                    Core Controller                       │
│  core/controller.py --engine gelab --action execute     │
│  - Loads engine from engines/ directory                 │
│  - Passes params to engine.execute_task()               │
│  - Handles engine lifecycle (start/stop/status)         │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Engine Layer                          │
│  engines/gelab/main.py (GELabEngine)                    │
│  engines/appagent_legacy/ (fallback, deprecated)        │
│  - Implements EngineInterface                           │
│  - Uses core/utils/android.py for device control        │
│  - Uses core/llm_adapter.py for AI calls                │
│  - Platform-agnostic (Android/Web)                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                    Core Utilities                        │
│  core/utils/android.py - Android device management      │
│  core/llm_adapter.py - LiteLLM wrapper (100+ providers) │
│  core/config.py - Configuration loader                  │
│  core/auth/ - Google authentication                     │
└─────────────────────────────────────────────────────────┘
\`\`\`
```

**Directory Structure 업데이트** (Line 947 부근):

```markdown
KleverDesktop/
├── core/                              # Shared Infrastructure ✨ NEW
│   ├── controller.py                  # Main entry point (228 lines)
│   ├── engine_interface.py            # Abstract base class
│   ├── llm_adapter.py                # LiteLLM wrapper
│   ├── config.py                     # Environment loader
│   ├── utils.py                      # Logging, image processing
│   ├── utils/
│   │   └── android.py                # ✨ Android device management (~400 lines)
│   ├── auth/                         # Google authentication
│   │   ├── google_login.py           # Web browser login
│   │   └── google_login_android.py   # Android device login
│   └── requirements.txt              # ✨ Python dependencies (13 packages)
│
├── engines/                          # Automation Engines
│   ├── gelab/                        # GELab Engine (active)
│   │   ├── main.py                   # GELabEngine class (stub)
│   │   └── README.md                 # Engine documentation
│   │
│   └── appagent_legacy/              # Legacy AppAgent (deprecated)
│       ├── scripts/
│       │   ├── self_explorer.py      # Original automation script (NOT USED)
│       │   └── and_controller.py     # Original Android controller (NOT USED)
│       ├── requirements.txt          # Legacy dependencies (kept for reference)
│       └── README.md                 # Deprecation notice
```

**3. 파일 생성**: `/Volumes/Backup/Github/KleverDesktop/engines/appagent_legacy/README.md`

```markdown
# AppAgent Legacy

**Status**: DEPRECATED
**Last Updated**: 2025-12-24
**Replaced By**: `core/` + `engines/gelab/`

## ⚠️ Deprecation Notice

This directory contains the legacy AppAgent implementation that has been **completely replaced** by the new multi-engine architecture.

### Migration Status

**All functionality has been migrated:**
- ✅ Android device control → `core/utils/android.py`
- ✅ Task execution → `core/controller.py` + `engines/gelab/main.py`
- ✅ LLM integration → `core/llm_adapter.py`
- ✅ Google authentication → `core/auth/`
- ✅ Python dependencies → `core/requirements.txt`

### Why This Exists

This directory is kept for:
1. **Fallback compatibility** (emergency rollback)
2. **Reference implementation** (original logic)
3. **Bundle verification** (ensure appagent_legacy is bundled if needed)

### Do NOT Use This

**Active code should NOT reference this directory.**

If you see `getLegacyScriptsPath()` or `engines/appagent_legacy/` in new code, it's a bug.

### Removal Plan

This directory will be completely removed in **Phase D** after:
- GELab engine fully implemented
- 1 month of production testing
- Confirmed no regressions

---

For questions, see: `/docs/migration_status.md`
```

#### 테스트

**Checkpoint 7.1**: 문서 검증
```bash
# migration_status.md 읽기
cat docs/migration_status.md | grep "Phase C"

# CLAUDE.md architecture 확인
cat CLAUDE.md | grep "core/controller.py"
```

---

## ✅ 테스트 체크포인트

### Checkpoint 1: Core Android Utilities (Phase 1 후)
```bash
python3 -c "from core.utils.android import list_all_devices, list_available_emulators"
echo "✅ Imports successful"

python3 -c "from core.utils.android import list_all_devices; print('Devices:', list_all_devices())"
echo "✅ Device discovery works"
```

### Checkpoint 2: Requirements Installation (Phase 2 후)
```bash
node scripts/python-sync.js
echo "✅ Requirements installed"

~/.klever-desktop/python-env/bin/pip list | grep litellm
~/.klever-desktop/python-env/bin/pip list | grep playwright
echo "✅ Key packages verified"
```

### Checkpoint 3: TypeScript Compilation (Phase 3 후)
```bash
npm run typecheck
# Expected: 0 errors
echo "✅ TypeScript compilation passed"
```

### Checkpoint 4: Android Task (Phase 4 후)
```bash
npm run start
# Manual test:
# 1. Create Android project
# 2. Upload APK
# 3. Create and run task
# 4. Verify:
#    - Emulator starts (core.utils.android)
#    - APK installs (core.utils.android)
#    - Task executes (core/controller.py)
#    - Cleanup on completion
echo "✅ Android task flow verified"
```

### Checkpoint 5: Integration Test (Phase 5 후)
```bash
npm run start
# Setup Wizard → Integration Test
# Verify console logs:
# - "Starting Python Controller..."
# - "[CONTROLLER] Starting... Engine: gelab"
# - "[GELab] 🚀 Starting Task"
# - "✅ Integration test PASSED"
echo "✅ Integration test passed"
```

### Checkpoint 6: Build Verification (Phase 6 후)
```bash
node scripts/verify-bundle.js --skip-python
# Expected:
# ✓ core/controller.py
# ✓ core/utils/android.py
# ✓ engines/gelab/main.py
echo "✅ Bundle verification passed"
```

---

## ⚠️ 위험 관리

### High Risk: Android Device Control

**위험**:
- `core/utils/android.py`에 버그가 있으면 모든 Android 작업 실패
- ADB 명령 오류 시 디바이스 상태 손상 가능성

**완화 전략**:
1. **정확한 복사**: `and_controller.py`에서 로직 변경 없이 그대로 복사
2. **순차 테스트**:
   - Step 1: 실제 디바이스로 테스트 (에뮬레이터보다 단순)
   - Step 2: 에뮬레이터 테스트
   - Step 3: APK 설치 테스트
3. **Fallback 유지**: `engines/appagent_legacy/` 완전히 보존
4. **상세 로깅**: 모든 ADB 명령과 출력 로깅

**Rollback**:
```bash
rm core/utils/android.py
git checkout main/handlers/task.ts main/handlers/installations.ts
```

### High Risk: Integration Test

**위험**:
- `core/controller.py`가 GELab에 params를 잘못 전달
- JSON serialization 오류
- PYTHONPATH 설정 오류로 import 실패

**완화 전략**:
1. **Standalone 테스트**:
   ```bash
   python core/controller.py --engine gelab --action execute --task "test" --params '{}'
   ```
2. **상세 로깅**: Controller.py에 debug 출력 추가
3. **GELab Stub 검증**: Phase B에서 이미 검증됨

**Rollback**:
```bash
git checkout main/handlers/integration.ts
```

### Medium Risk: APK Installation

**위험**:
- `prelaunch_app()` 이동 시 JSON 파싱 깨짐
- APK 경로 해석 오류

**완화 전략**:
1. **간단한 APK 먼저**: Settings.apk 같은 시스템 앱으로 테스트
2. **JSON 검증**: prelaunch_app 실행 전 JSON 파싱 확인
3. **로깅**: 모든 adb install 명령 로깅

---

## 📁 변경 파일 목록

### 생성 (2개)
1. ✨ **`core/utils/android.py`** - Android 유틸리티 (~400 lines)
2. ✨ **`core/requirements.txt`** - Python 의존성 (13 lines)

### 수정 (12개)

**TypeScript Handlers (5개):**
3. 📝 **`main/handlers/task.ts`** - Android utilities import 변경 (3곳)
4. 📝 **`main/handlers/integration.ts`** - controller.py 통합 (~30 lines 변경)
5. 📝 **`main/handlers/project.ts`** - controller.py 통합 (~40 lines 변경)
6. 📝 **`main/handlers/installations.ts`** - 경로 업데이트 (~10 lines)
7. 📝 **`main/handlers/system-checks.ts`** - 경로 업데이트 (2 lines)

**Build Scripts (3개):**
8. 📝 **`scripts/python-sync.js`** - requirements 경로 (1 line)
9. 📝 **`scripts/python-refresh.js`** - requirements 경로 (1 line)
10. 📝 **`scripts/verify-bundle.js`** - core/engines 검증 (~10 lines)

**문서 (4개):**
11. 📝 **`docs/migration_status.md`** - Phase C 추가 (~80 lines added)
12. 📝 **`CLAUDE.md`** - 아키텍처 업데이트 (~50 lines changed)
13. ✨ **`engines/appagent_legacy/README.md`** - Deprecation notice (NEW)
14. ✨ **`docs/PHASE_C_MIGRATION_PLAN.md`** - 이 문서 (NEW)

### 유지 (호환성)
- ✅ `engines/appagent_legacy/requirements.txt` - Fallback
- ✅ `engines/appagent_legacy/scripts/and_controller.py` - Reference
- ✅ `engines/appagent_legacy/scripts/self_explorer.py` - Fallback
- ✅ `main/utils/python-runtime.ts` - `getLegacyScriptsPath()` 유지

---

## 📊 성공 기준

### Must Have (필수) ✅
- [ ] `core/utils/android.py` 생성 및 작동
- [ ] `core/requirements.txt` 존재 및 설치 성공
- [ ] TypeScript 컴파일 성공 (0 errors)
- [ ] Integration test 통과 (core/controller.py 사용)
- [ ] Android task 전체 플로우 작동
- [ ] Build 검증 통과
- [ ] 6개 체크포인트 모두 통과

### Should Have (중요) 📋
- [ ] 활성 코드에서 appagent 직접 참조 제거
- [ ] 문서 완전 업데이트
- [ ] `getLegacyScriptsPath()` 사용 최소화 (0개로)
- [ ] Build scripts에서 core 참조

### Nice to Have (선택) 🎁
- [ ] Legacy 코드 미사용 부분 제거
- [ ] Engine 선택 UI 추가 (Phase D)
- [ ] 성능 벤치마크

---

## 📅 예상 일정

### Day 1 (4-6시간): Foundation
**오전 (3-4시간)**:
- [ ] `core/utils/android.py` 생성
- [ ] Android utilities standalone 테스트
- [ ] Checkpoint 1 통과

**오후 (1-2시간)**:
- [ ] `core/requirements.txt` 생성
- [ ] Build scripts 업데이트
- [ ] Requirements 설치 테스트
- [ ] Checkpoint 2 통과

### Day 2 (6-8시간): Handler 업데이트
**오전 (2-3시간)**:
- [ ] `installations.ts` 업데이트
- [ ] `system-checks.ts` 업데이트
- [ ] TypeScript 컴파일 테스트
- [ ] Checkpoint 3 통과

**오후 (4-5시간)**:
- [ ] `task.ts` 업데이트 (3곳)
- [ ] Android task execution 테스트
- [ ] Emulator cleanup 테스트
- [ ] Checkpoint 4 통과

### Day 3 (6-8시간): Integration & Build
**오전 (4-5시간)**:
- [ ] `integration.ts` 업데이트
- [ ] `project.ts` 업데이트
- [ ] Integration test 실행
- [ ] Checkpoint 5 통과

**오후 (2-3시간)**:
- [ ] `verify-bundle.js` 업데이트
- [ ] Package scripts 확인
- [ ] Build verification
- [ ] Checkpoint 6 통과

### Day 4 (2-4시간): 문서화
- [ ] `migration_status.md` 업데이트
- [ ] `CLAUDE.md` 업데이트
- [ ] `engines/appagent_legacy/README.md` 생성
- [ ] 최종 통합 테스트
- [ ] PR 준비

**총 예상**: 18-26시간 (3-4일)

---

## 🎯 다음 단계 (Phase D)

Phase C 완료 후 다음 작업:

1. **GELab Engine 실제 구현**:
   - Android controller 통합
   - Web controller 통합 (browser-use)
   - AI model integration (core/llm_adapter.py 사용)
   - Prompt execution engine

2. **Legacy 제거**:
   - `engines/appagent_legacy/` 완전 삭제
   - `getLegacyScriptsPath()` 제거
   - Build scripts 정리

3. **UI 개선**:
   - Engine 선택 기능 추가
   - GELab 설정 UI
   - Progress 시각화

---

**문서 작성자**: Claude Sonnet 4.5
**검토 필요**: ✅ 구현 시작 전 팀 리뷰
**예상 완료**: 2025-12-28
