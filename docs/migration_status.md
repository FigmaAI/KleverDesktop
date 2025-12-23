# Appagent → Common/Engines Migration Status
**Date:** 2025-12-24
**Status:** Phase A Completed / Phase B (Multi-Engine Architecture) Planned

## 🎯 Objective
Transition Klever Desktop from a single-script runner (`appagent`) to a **Multi-Engine Architecture**.
- **Goal:** Completely replace AppAgent with **GELab (gelab-zero)**.
- **Strategy:** Introduce a `Common Controller` that manages engines. The existing `appagent` will be moved to `engines/appagent-legacy` and treated as an archive/legacy engine until fully replaced.

---

## 🏗️ New Architecture

### 1. `common/` (Shared Infrastructure)
The backbone ensuring consistent Behavior across engines.

| Component | Status | Description |
|-----------|--------|-------------|
| **Engine Interface** | 🚧 Planned | `common/engine_interface.py` (Defines `start`, `stop`, `execute`) |
| **Engine Controller** | 🚧 Planned | `common/controller.py` (Electron calls THIS, not specific scripts) |
| **LLM Adapter** | ✅ Ready | `common/llm_adapter.py` (Unified LightLLM/OpenAI interface) |
| **Configuration** | ✅ Ready | `common/config.py` (Global setup) |
| **Authentication** | ✅ Ready | `common/auth/` (Independent Google Login) |
| **Utilities** | 🚧 Planned | `common/utils.py` (Logging, Image Processing from `utils.py`) |

### 2. `engines/` (Pluggable Automation Cores)

#### A. `engines/gelab/` (Target Engine: gelab-zero)
The new standard for UI automation.
- **Structure:** Implements `common.EngineInterface`.
- **Features:** Self-contained logic (Controller, Recorder, Executor) optimized for performance and reliability.
- **Dependency:** Uses `common` for I/O (Screenshots, Logs) and LLM, but manages Device Control internally if needed (or via common if aligned).

#### B. `engines/appagent-legacy/` (Archive)
The current `appagent` folder moved here.
- **Status:** Maintenance Mode / Archive.
- **Usage:** Fallback until GELab is feature-complete.

---

## ✅ Phase A: Common Layer & Cleanup (Completed)

### 1. File Independence
- **Google Login:** `google_login_android.py` decoupled from `and_controller.py`.
- **Electron Pathing:** All `appagent` path references in Electron (`main/`) updated to `legacyScripts` variables.

---

## 🚀 Phase B: Multi-Engine Migration Plan (Completed)

### Step 1: Foundation (Common Layer) ✅
- [x] **Define Interface**: Create `common/engine_interface.py` (Abstract Base Class).
- [x] **Port Utilities**: Move generic image/log utilities from `appagent/scripts/utils.py` to `common/utils.py`.
- [x] **Create Controller**: Implement `common/controller.py` to load and run engines.

### Step 2: Legacy Migration ✅
- [x] **Move AppAgent**: Move `appagent/` content to `engines/appagent-legacy/`.
- [x] **Register Legacy**: Make `controller.py` capable of running the legacy script via the new interface wrapper.

### Step 3: GELab Setup ✅
- [x] **Initialize**: Create `engines/gelab/` structure.
- [x] **Implement**: Build GELab entry point implementing `EngineInterface`.

### Step 4: Electron Integration ✅
- [x] **Update Task Handler**: `main/handlers/task.ts` updated to execute `common/controller.py` instead of direct script paths.
- [x] **Engine Selection**: Defaulting to `gelab` engine in `task.ts` (Explicit Engine selection UI planned for Phase C).
```
