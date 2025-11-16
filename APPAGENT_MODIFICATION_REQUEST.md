# Android SDK Path Enhancement Planning

## Goal
Improve `execute_adb` and emulator-related functions to **prioritize environment variables** instead of hardcoded paths, creating a more flexible and maintainable structure.

## Core Principles

1. **UI Configuration**: Set SDK path via SetupWizard (initial setup) or Settings page (anytime)
2. **Storage**: Stored in config.json, passed to appagent as ANDROID_SDK_PATH environment variable
3. **Fallback Mechanism**: Auto-detect from common_paths if not set
4. **Naming Convention**: Follow Klever Desktop's `{SECTION}_{PROPERTY}` pattern (ANDROID_SDK_PATH)
5. **Simplicity**: Single source of truth - no external environment variable dependencies

---

## Changes

### 1. Environment Variable Definition

Introduce new environment variable following Klever Desktop naming convention:

| Variable | Purpose | Example |
|---------|---------|---------|
| `ANDROID_SDK_PATH` | Android SDK root directory (set by SetupWizard) | `/Users/username/Library/Android/sdk` |

> **Naming Convention**: `ANDROID_SDK_PATH` follows Klever Desktop's `{SECTION}_{PROPERTY}` pattern, consistent with `ANDROID_SCREENSHOT_DIR` and `ANDROID_XML_DIR`.

---

### 2. `config.yaml` Extension

Add Android SDK path configuration:

```yaml
# Android Configuration
ANDROID_SCREENSHOT_DIR: "/sdcard/Pictures"
ANDROID_XML_DIR: "/sdcard/Documents"
ANDROID_SDK_PATH: "/Users/username/Library/Android/sdk"  # Set by SetupWizard
```

**Design Philosophy**:
- `ANDROID_SDK_PATH` is set by SetupWizard (initial setup) or Settings page (anytime)
- Value is stored in `config.json` (Electron) and passed to `config.yaml` (appagent) via environment variables
- If empty or not set, falls back to common paths auto-detection

---

### 3. `config.py` Modification

Improve environment variable handling logic:

```python
def load_config(config_path="./config.yaml"):
    # Load YAML first as defaults
    with open(config_path, "r") as file:
        configs = yaml.safe_load(file)

    # Override with environment variables (higher priority)
    bool_keys = ['ENABLE_LOCAL', 'ENABLE_API', 'WEB_HEADLESS', 'OPTIMIZE_IMAGES', 'DOC_REFINE', 'DARK_MODE']
    int_keys = ['MAX_TOKENS', 'REQUEST_INTERVAL', 'WEB_VIEWPORT_WIDTH', 'WEB_VIEWPORT_HEIGHT',
                'IMAGE_MAX_WIDTH', 'IMAGE_MAX_HEIGHT', 'IMAGE_QUALITY', 'MAX_ROUNDS', 'MIN_DIST']

    for key in configs.keys():
        if key in os.environ:
            value = os.environ[key]
            # Type conversion
            if key in bool_keys:
                configs[key] = value.lower() in ('true', '1', 'yes')
            elif key in int_keys:
                configs[key] = int(value)
            else:
                configs[key] = value

    # Special handling for ANDROID_SDK_PATH
    # Get from environment variable (passed by Electron)
    if 'ANDROID_SDK_PATH' in os.environ:
        configs['ANDROID_SDK_PATH'] = os.environ['ANDROID_SDK_PATH']
    elif 'ANDROID_SDK_PATH' not in configs:
        configs['ANDROID_SDK_PATH'] = ""  # Will use common paths fallback in and_controller.py

    return configs
```

**Changes**:
1. Special handling for `ANDROID_SDK_PATH` key (follows Klever Desktop naming convention)
2. Priority: env `ANDROID_SDK_PATH` (from Electron) → `config.yaml` → empty string
3. If empty, `and_controller.py` will perform fallback path detection using common paths

---

### 4. `and_controller.py` Refactoring

#### 4.1. Add New Helper Functions

```python
def get_android_sdk_path():
    """
    Get Android SDK path from config.

    Priority:
    1. configs['ANDROID_SDK_PATH'] (set by SetupWizard or Settings, passed via Electron env var)
    2. Empty string (will trigger common_paths fallback in find_sdk_tool)

    Returns:
        str: Android SDK path or empty string
    """
    # Get from config (already loaded at module level, passed from Electron)
    return configs.get('ANDROID_SDK_PATH', '')


def find_sdk_tool(tool_name, subfolder='platform-tools'):
    """
    Find Android SDK tool (adb, emulator, etc.) using SDK root or common paths.

    Args:
        tool_name: Tool executable name (e.g., 'adb', 'emulator')
        subfolder: SDK subfolder containing the tool (e.g., 'platform-tools', 'emulator')

    Returns:
        str: Full path to the tool or None if not found
    """
    import shutil

    # First, check if tool is in PATH
    tool_path = shutil.which(tool_name)
    if tool_path:
        return tool_path

    # Get SDK path from config/env
    sdk_path = get_android_sdk_path()

    # If SDK path is specified, check there first
    if sdk_path:
        candidate_path = os.path.join(sdk_path, subfolder, tool_name)
        if os.path.exists(candidate_path):
            return candidate_path

    # Fallback to common paths (platform-specific)
    common_paths = []
    if tool_name == 'emulator':
        common_paths = [
            os.path.expanduser("~/Library/Android/sdk/emulator/emulator"),      # macOS
            os.path.expanduser("~/Android/Sdk/emulator/emulator"),               # Linux
            "C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk\\emulator\\emulator.exe",  # Windows
            "/opt/android-sdk/emulator/emulator"                                 # Linux (alternative)
        ]
    elif tool_name == 'adb':
        common_paths = [
            os.path.expanduser("~/Library/Android/sdk/platform-tools/adb"),     # macOS
            os.path.expanduser("~/Android/Sdk/platform-tools/adb"),              # Linux
            "C:\\Users\\%USERNAME%\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe",  # Windows
            "/opt/android-sdk/platform-tools/adb"                                # Linux (alternative)
        ]

    # Check common paths
    for path in common_paths:
        expanded_path = os.path.expandvars(path)  # Expand %USERNAME% on Windows
        if os.path.exists(expanded_path):
            return expanded_path

    return None
```

#### 4.2. Modify `list_available_emulators()`

```python
def list_available_emulators():
    """List all available Android emulators (AVDs)"""

    # Find emulator using new helper function
    emulator_path = find_sdk_tool('emulator', 'emulator')

    if not emulator_path:
        print_with_color("ERROR: emulator command not found. Please install Android SDK.", "red")
        print_with_color("Set ANDROID_SDK_PATH in SetupWizard or ensure emulator is in PATH", "yellow")
        return []

    # List AVDs
    result = subprocess.run([emulator_path, '-list-avds'],
                          stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE,
                          text=True)

    if result.returncode == 0:
        avds = [avd.strip() for avd in result.stdout.strip().split('\n') if avd.strip()]
        return avds
    return []
```

#### 4.3. Modify `start_emulator()`

```python
def start_emulator(avd_name=None, wait_for_boot=True):
    """
    Start an Android emulator

    Args:
        avd_name: Name of AVD to start (if None, uses first available)
        wait_for_boot: Wait for emulator to fully boot

    Returns:
        True if successful, False otherwise
    """
    import time

    # Get emulator path using new helper function
    emulator_path = find_sdk_tool('emulator', 'emulator')

    if not emulator_path:
        print_with_color("ERROR: emulator command not found", "red")
        print_with_color("Please configure Android SDK path in SetupWizard", "yellow")
        sdk_path = get_android_sdk_path()
        if sdk_path:
            print_with_color(f"Current ANDROID_SDK_PATH: {sdk_path}", "yellow")
        else:
            print_with_color("ANDROID_SDK_PATH not set - configure in SetupWizard", "yellow")
        return False

    # Get AVD list
    avds = list_available_emulators()
    if not avds:
        print_with_color("ERROR: No Android emulators (AVDs) found", "red")
        print_with_color("Create an AVD using Android Studio or avdmanager", "yellow")
        return False

    # Select AVD
    if avd_name is None:
        avd_name = avds[0]
        print_with_color(f"Using first available emulator: {avd_name}", "yellow")
    elif avd_name not in avds:
        print_with_color(f"ERROR: AVD '{avd_name}' not found", "red")
        print_with_color(f"Available AVDs: {', '.join(avds)}", "yellow")
        return False

    # Start emulator in background with cold boot
    print_with_color(f"Starting emulator: {avd_name} (cold boot)...", "green")
    subprocess.Popen([emulator_path, '-avd', avd_name, '-no-snapshot-load'],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL)

    if wait_for_boot:
        return wait_for_device()

    return True
```

#### 4.4. Improve `execute_adb()` (Optional)

`execute_adb()` already uses `adb` from system PATH, so major changes aren't needed, but we can improve error messages:

```python
def execute_adb(adb_command):
    """
    Execute ADB command with error handling.

    Note: This function assumes 'adb' is in PATH or ANDROID_SDK_ROOT is set correctly.
    """
    # Optional: Check if adb is available before executing
    if not shutil.which('adb'):
        adb_path = find_sdk_tool('adb', 'platform-tools')
        if not adb_path:
            print_with_color("ERROR: adb command not found", "red")
            print_with_color("Please configure Android SDK path in SetupWizard", "yellow")
            return "ERROR"
        # Replace 'adb' in command with full path
        adb_command = adb_command.replace('adb ', f'"{adb_path}" ', 1)

    result = subprocess.run(adb_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode == 0:
        return result.stdout.strip()
    print_with_color(f"Command execution failed: {adb_command}", "red")
    print_with_color(result.stderr, "red")
    return "ERROR"
```

**Note**: This change is **optional**. Current `execute_adb()` runs `adb` as shell command, so it works well if in system PATH. This is just an extra safety measure for cases where PATH doesn't include adb.

---

## Implementation Priority

### Phase 1: Electron Configuration (Required) ✅ COMPLETED
1. ✅ Add `android.sdkPath` to Electron `config.ts`
2. ✅ Add `ANDROID_SDK_PATH` to environment variable mapping (23 vars total)
3. ✅ Add Android SDK path detection to SetupWizard (auto-detect via checkAndroidStudio)
4. ✅ Add Android SDK path configuration to Settings page (already existed in PlatformSettingsCard)
5. ✅ Update config-env-builder to pass `ANDROID_SDK_PATH`

**Commit**: `cad3610` - feat: Add Android SDK path configuration to Electron

### Phase 2: appagent Core Features (Required) ✅ COMPLETED
6. ✅ `ANDROID_SDK_PATH` automatically loaded via config.py (no changes needed)
7. ✅ Environment variable handling already works (config.py loads all env vars)
8. ✅ Add `get_android_sdk_path()` function to `and_controller.py`
9. ✅ Add `find_sdk_tool()` function to `and_controller.py`

### Phase 3: Function Refactoring (Required) ✅ COMPLETED
10. ✅ Modify `list_available_emulators()` to use find_sdk_tool()
11. ✅ Modify `start_emulator()` to use find_sdk_tool() with better error messages

**Commit (appagent)**: `2d04a5a` - feat: Add ANDROID_SDK_PATH support for flexible SDK location
**Commit (main)**: `2b36cb3` - chore: Update appagent submodule with ANDROID_SDK_PATH support

### Phase 4: Additional Improvements (Optional)
12. ⬜ Improve `execute_adb()` (for cases without PATH)
13. ⬜ Write unit tests
14. ⬜ Update CLAUDE.md documentation

---

## Test Scenarios

### Scenario 1: UI Configuration (Primary)
User sets SDK path via SetupWizard or Settings → Electron passes via `ANDROID_SDK_PATH` env var
```bash
# In Electron: ANDROID_SDK_PATH="/Users/username/Library/Android/sdk"
# Passed to Python subprocess
```
**Expected**: SDK path retrieved from config (set by SetupWizard or Settings)

### Scenario 2: Explicit Path in config.yaml
```yaml
ANDROID_SDK_PATH: "/custom/path/to/android/sdk"
```
**Expected**: config.yaml path used with priority

### Scenario 3: No Configuration (Fallback)
```bash
# ANDROID_SDK_PATH not set in config
python scripts/self_explorer.py
```
**Expected**: Auto-detect from `common_paths` (macOS: `~/Library/Android/sdk`, Linux: `~/Android/Sdk`, etc.)

---

## Improved Error Messages

Before:
```
ERROR: emulator command not found. Please install Android SDK.
```

After:
```
ERROR: emulator command not found
Please configure Android SDK path in Settings
ANDROID_SDK_PATH not set - configure in Settings
```

Or if path is set but tool not found:
```
ERROR: emulator command not found
Please verify Android SDK path in Settings
Current ANDROID_SDK_PATH: /Users/username/Library/Android/sdk
```

---

## Benefits

1. **User-Friendly**: SetupWizard + Settings UI for easy SDK path configuration (no manual env var setup)
2. **Flexible**: Can be configured during initial setup (SetupWizard) or changed anytime (Settings)
3. **Consistent Naming**: `ANDROID_SDK_PATH` follows Klever Desktop's `{SECTION}_{PROPERTY}` pattern
4. **Simple & Clear**: Single source of truth (config.json) with fallback to common paths
5. **Portability**: Works across different machines and setups
6. **Maintainability**: Removes hardcoded paths, centralizes SDK path logic
7. **Clear Priority**: config.json (SetupWizard/Settings) → common paths auto-detection

---

## References

- Android SDK Official Docs: https://developer.android.com/studio/command-line/variables
- `ANDROID_SDK_ROOT` vs `ANDROID_HOME`: https://stackoverflow.com/questions/47530857/
- Python `os.environ` Docs: https://docs.python.org/3/library/os.html#os.environ
- Klever Desktop Config Documentation: [CLAUDE.md](/CLAUDE.md)

---

## Implementation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SetupWizard / Settings (Electron)                            │
│    - Detect Android SDK path (via Android Studio check)         │
│    - User can configure/edit in Settings anytime                │
│    - Save to config.json as android.sdkPath                     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. config-env-builder.ts (Electron)                             │
│    - Read config.json android.sdkPath                           │
│    - Map to ANDROID_SDK_PATH environment variable               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. task.ts / project.ts (Electron)                              │
│    - Spawn Python subprocess with ANDROID_SDK_PATH env var      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. config.py (appagent)                                         │
│    - Load config.yaml, override with env ANDROID_SDK_PATH       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. and_controller.py (appagent)                                 │
│    - get_android_sdk_path() reads from configs                  │
│    - find_sdk_tool() uses SDK path to locate adb/emulator       │
│    - Fallback to common paths if not found                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. ✅ Update planning document with `ANDROID_SDK_PATH` naming convention
2. ✅ Implement Electron changes (Phase 1) - Commit `cad3610`
3. ✅ Implement appagent changes (Phase 2-3) - Commits `2d04a5a`, `2b36cb3`
4. ⬜ Test each scenario (Scenarios 1-3) - Ready for testing
5. ⬜ Update CLAUDE.md documentation (Optional)

---

**Last Updated**: 2025-11-16
**Status**: ✅ **IMPLEMENTATION COMPLETE** - Ready for Testing
**Naming Convention**: `ANDROID_SDK_PATH` (follows Klever Desktop `{SECTION}_{PROPERTY}` pattern)

## Implementation Summary

All required phases (1-3) have been completed and pushed to the repository.

**Data Flow:**
```
SetupWizard → checkAndroidStudio() → Detect SDK path
           ↓
config.json (android.sdkPath: "/path/to/sdk")
           ↓
config-env-builder.ts → ANDROID_SDK_PATH env var
           ↓
Python subprocess (task execution)
           ↓
config.py → Load ANDROID_SDK_PATH from env
           ↓
and_controller.py → get_android_sdk_path() + find_sdk_tool()
           ↓
list_available_emulators() / start_emulator()
```

**User Experience:**
- SetupWizard automatically detects Android SDK path
- Users can edit path anytime in Settings → Platform Configuration → Android SDK Path
- Error messages guide users to configure in Settings if path is missing
- Fallback to common paths if SDK path not configured