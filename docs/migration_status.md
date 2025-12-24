# Appagent → Core/Engines Migration Status
**Date:** 2025-12-24
**Status:** Phase A, B, & C Completed ✅

## 🎯 Objective
Transition Klever Desktop from a single-script runner (`appagent`) to a **Multi-Engine Architecture**.
- **Goal:** Completely replace AppAgent with **GELab (gelab-zero)**.
- **Strategy:** Introduce a `Core Controller` that manages engines. The existing `appagent` has been moved to `engines/appagent_legacy` and is treated as an archive/legacy engine until fully replaced.

---

## 🏗️ New Architecture

### 1. `core/` (Shared Infrastructure)
The backbone ensuring consistent behavior across engines. **Renamed from `common/` to `core/` on 2025-12-24.**

| Component | Status | Description |
|-----------|--------|-------------|
| **Engine Interface** | ✅ Complete | `core/engine_interface.py` (Defines `start`, `stop`, `execute`) |
| **Engine Controller** | ✅ Complete | `core/controller.py` (Electron calls THIS, not specific scripts) |
| **LLM Adapter** | ✅ Complete | `core/llm_adapter.py` (Unified LiteLLM/OpenAI interface) |
| **Configuration** | ✅ Complete | `core/config.py` (Global setup) |
| **Authentication** | ✅ Complete | `core/auth/` (Independent Google Login) |
| **Utilities** | ✅ Complete | `core/utils.py` (Logging, Image Processing from `utils.py`) |
| **Android Utilities** | ✅ Complete | `core/android.py` (Device control, APK management) |
| **Requirements** | ✅ Complete | `core/requirements.txt` (Centralized Python dependencies) |

### 2. `engines/` (Pluggable Automation Cores)

#### A. `engines/gelab/` (Target Engine: gelab-zero)
The new standard for UI automation.
- **Structure:** Implements `core.EngineInterface`.
- **Features:** Self-contained logic (Controller, Recorder, Executor) optimized for performance and reliability.
- **Dependency:** Uses `core` for I/O (Screenshots, Logs) and LLM, but manages Device Control internally if needed (or via core if aligned).

#### B. `engines/appagent_legacy/` (Archive)
The current `appagent` folder moved here.
- **Status:** Maintenance Mode / Archive.
- **Usage:** Fallback until GELab is feature-complete.
- **Note:** All TypeScript handlers NOW use `core/` utilities instead of `appagent_legacy/scripts/` directly.

---

## ✅ Phase A: Core Layer & Cleanup (Completed)

### 1. File Independence
- **Google Login:** `google_login_android.py` decoupled from `and_controller.py`.
- **Electron Pathing:** All `appagent` path references in Electron (`main/`) updated to `legacyScripts` variables.

---

## ✅ Phase B: Multi-Engine Migration Plan (Completed)

### Step 1: Foundation (Core Layer) ✅
- [x] **Define Interface**: Create `core/engine_interface.py` (Abstract Base Class).
- [x] **Port Utilities**: Move generic image/log utilities from `appagent/scripts/utils.py` to `core/utils.py`.
- [x] **Create Controller**: Implement `core/controller.py` to load and run engines.
- [x] **Rename to Core**: Rename `common/` to `core/` for clearer semantics (2025-12-24).

### Step 2: Legacy Migration ✅
- [x] **Move AppAgent**: Move `appagent/` content to `engines/appagent_legacy/`.
- [x] **Register Legacy**: Make `controller.py` capable of running the legacy script via the new interface wrapper.

### Step 3: GELab Setup ✅
- [x] **Initialize**: Create `engines/gelab/` structure.
- [x] **Implement**: Build GELab entry point implementing `EngineInterface`.

### Step 4: Electron Integration ✅
- [x] **Update Task Handler**: `main/handlers/task.ts` updated to execute `core/controller.py` instead of direct script paths.
- [x] **Update All References**: All Python and TypeScript imports updated from `common` to `core`.
- [x] **Update Build Config**: `forge.config.js` extraResource updated to include `core` and `engines`.
- [x] **Engine Selection**: Defaulting to `gelab` engine in `task.ts` (Explicit Engine selection UI planned for Phase C).

---

## ✅ Phase C: Legacy Cleanup & Core Centralization (Completed 2025-12-24)

### Step 1: Core Android Utilities ✅
- [x] **Create `core/android.py`**: Extract Android device management functions from `and_controller.py`.
- [x] **Functions Migrated**: `get_android_sdk_path`, `find_sdk_tool`, `execute_adb`, `list_all_devices`, `list_available_emulators`, `start_emulator`, `stop_emulator`, `cleanup_emulators`, `prelaunch_app`, `install_apk`, `AndroidElement`.

### Step 2: Requirements Centralization ✅
- [x] **Create `core/requirements.txt`**: Centralized Python dependencies.
- [x] **Update `scripts/python-sync.js`**: Points to `core/requirements.txt`.
- [x] **Update `main/utils/python-sync.ts`**: Uses `getCorePath()` for requirements path.

### Step 3: TypeScript Handler Updates ✅
- [x] **`installations.ts`**: Uses `core.android` for prelaunch and device status.
- [x] **`system-checks.ts`**: Uses `core/requirements.txt` for package checks.
- [x] **`task.ts`**: Uses `core.android` for emulator cleanup and APK setup.
- [x] **`integration.ts`**: Uses `core/controller.py` with gelab engine.
- [x] **`project.ts`**: Uses `core/controller.py` with gelab engine.

### Step 4: Verification ✅
- [x] **TypeScript Compilation**: All handlers compile without errors.
- [x] **Python Import Test**: `from core.android import list_all_devices` works.

---

## 🚀 Next Steps (Phase D)

### 1. Full GELab Implementation
- [ ] Replace current stub with actual gelab-zero logic
- [ ] Implement complete browser-use integration

### 2. UI Updates
- [ ] Add engine selection UI in project settings
- [ ] Add engine status indicators in task execution

### 3. Cleanup
- [ ] Remove deprecated wrapper scripts
- [ ] Consider removing `engines/appagent_legacy/` after full validation

