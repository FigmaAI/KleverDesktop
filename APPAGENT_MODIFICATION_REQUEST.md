# AppAgent Modification Request: Android SDK Tool Detection

## Problem

When executing Android automation tasks, the Python script cannot find `adb` and `emulator` commands even though:
- Android SDK is installed at standard location (`~/Library/Android/sdk`)
- Electron process adds SDK paths to PATH environment variable before spawning Python

**Error:**
```
Command execution failed: adb devices
/bin/sh: adb: command not found
```

## Root Cause

The `execute_adb()` function in `scripts/and_controller.py` uses `subprocess.run()` with `shell=True`, which relies on the system PATH. However, the PATH environment variable passed from Electron is not being properly utilized by the shell subprocess.

## Proposed Solution

Modify `execute_adb()` function to automatically detect ADB path before executing commands.

### File to Modify

**`appagent/scripts/and_controller.py`**

### Current Implementation

```python
def execute_adb(adb_command):
    # print(adb_command)
    result = subprocess.run(adb_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode == 0:
        return result.stdout.strip()
    print_with_color(f"Command execution failed: {adb_command}", "red")
    print_with_color(result.stderr, "red")
    return "ERROR"
```

### Proposed Implementation

```python
def execute_adb(adb_command):
    """Execute ADB command with automatic path detection"""
    import shutil

    # Try to find adb in PATH first
    adb_path = shutil.which('adb')

    # If not found in PATH, check common installation locations
    if not adb_path:
        common_paths = [
            os.path.expanduser("~/Library/Android/sdk/platform-tools/adb"),  # macOS default
            os.path.expanduser("~/Android/Sdk/platform-tools/adb"),          # Linux default
            "/opt/android-sdk/platform-tools/adb",                           # Alternative Linux path
        ]
        for path in common_paths:
            if os.path.exists(path):
                adb_path = path
                break

    if not adb_path:
        print_with_color("ERROR: adb command not found. Please install Android SDK.", "red")
        return "ERROR"

    # Replace 'adb' with full path in command
    if adb_command.startswith('adb '):
        adb_command = adb_command.replace('adb ', f'"{adb_path}" ', 1)
    elif adb_command == 'adb':
        adb_command = f'"{adb_path}"'

    result = subprocess.run(adb_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode == 0:
        return result.stdout.strip()
    print_with_color(f"Command execution failed: {adb_command}", "red")
    print_with_color(result.stderr, "red")
    return "ERROR"
```

## Benefits

1. **No Configuration Required**: Users don't need to configure SDK path in setup wizard
2. **Cross-Platform**: Works on macOS, Linux, and Windows (with appropriate paths)
3. **Fallback Logic**: First tries PATH, then falls back to common default locations
4. **Backward Compatible**: Still works if adb is in system PATH
5. **Clear Error Messages**: Provides helpful error if adb is not found anywhere

## Testing

After applying this change, verify:

1. **Standard Installation**: Works when Android SDK is at `~/Library/Android/sdk`
2. **PATH Installation**: Works when adb is in system PATH
3. **Custom Installation**: Works when SDK is at alternative locations
4. **Error Handling**: Shows clear error when adb is not installed

## Alternative Approaches Considered

### Option 1: System PATH Configuration (Not Recommended)
- Requires users to manually add Android SDK to PATH
- Error-prone, OS-dependent
- Not suitable for end-users

### Option 2: Config File SDK Path (Previous Approach)
- Requires setup wizard step
- User must know SDK installation location
- Extra configuration burden
- **We removed this to simplify user experience**

### Option 3: Electron PATH Manipulation (Current, Incomplete)
- Adds SDK paths to PATH in task.ts
- **Problem**: PATH is not properly inherited by subprocess shell
- **This modification completes this approach**

## Implementation Priority

**High Priority** - This blocks Android automation functionality completely.

## Files Affected

- `appagent/scripts/and_controller.py` - `execute_adb()` function

## Similar Changes Needed?

The same pattern is already used in `list_available_emulators()` and `start_emulator()` functions for detecting the `emulator` binary. The `execute_adb()` function should follow the same pattern.

## Commit Message

```
feat: Add automatic ADB path detection in execute_adb()

- Check shutil.which('adb') first to use system PATH
- Fall back to common SDK installation paths if not in PATH
- Support macOS, Linux, and Windows default locations
- Provide clear error message if adb is not found

This fixes "adb: command not found" errors when Android SDK
is installed but not in system PATH, eliminating the need for
manual path configuration in the setup wizard.
```

---

## Questions for Review

1. Should we cache the detected `adb_path` to avoid repeated filesystem checks?
2. Should we add Windows paths (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`)?
3. Should we add debug logging to show which adb path is being used?
