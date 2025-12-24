"""
Android Device Management Utilities
Extracted from engines/appagent_legacy/scripts/and_controller.py

Provides:
- Device discovery (adb devices)
- Emulator control (start/stop/cleanup)
- APK management (install/launch)
- ADB command execution

Usage:
    from core.android import list_all_devices, start_emulator, prelaunch_app
"""

import sys
import os
import subprocess
import time
import shutil
import re
from typing import List, Optional, Dict, Any
from urllib.parse import urlparse, parse_qs

# Ensure project root is in sys.path for core module imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Import from core modules
from core.utils import print_with_color
from core.config import load_config


# Load config at module level
configs = load_config()


# ============================================
# Android SDK Path Resolution
# ============================================

def get_android_sdk_path() -> str:
    """
    Get Android SDK path from config.

    Priority:
    1. configs['ANDROID_SDK_PATH'] (set by SetupWizard or Settings, passed via Electron env var)
    2. Empty string (will trigger common_paths fallback in find_sdk_tool)

    Returns:
        str: Android SDK path or empty string
    """
    return configs.get('ANDROID_SDK_PATH', '')


def find_sdk_tool(tool_name: str, subfolder: str = 'platform-tools') -> Optional[str]:
    """
    Find Android SDK tool (adb, emulator, etc.) using SDK path or common paths.

    Args:
        tool_name: Tool executable name (e.g., 'adb', 'emulator')
        subfolder: SDK subfolder containing the tool (e.g., 'platform-tools', 'emulator')

    Returns:
        str: Full path to the tool or None if not found
    """
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


def get_adb_path() -> Optional[str]:
    """Get adb executable path using find_sdk_tool helper"""
    return find_sdk_tool('adb', 'platform-tools')


# ============================================
# ADB Command Execution
# ============================================

def execute_adb(adb_command: str) -> str:
    """
    Execute adb command using full path to adb executable

    Args:
        adb_command: Command string (e.g., "adb devices" or just "devices")

    Returns:
        Command output or "ERROR"
    """
    # Get adb path
    adb_path = get_adb_path()
    if not adb_path:
        print_with_color("ERROR: adb command not found", "red")
        print_with_color("Please configure Android SDK path in Settings", "yellow")
        sdk_path = get_android_sdk_path()
        if sdk_path:
            print_with_color(f"Current ANDROID_SDK_PATH: {sdk_path}", "yellow")
        else:
            print_with_color("ANDROID_SDK_PATH not set - configure in Settings", "yellow")
        return "ERROR"

    # Replace 'adb' with full path in command
    # Handle both "adb devices" and "devices" formats
    if adb_command.startswith('adb '):
        adb_command = adb_command.replace('adb ', f'{adb_path} ', 1)
    else:
        adb_command = f'{adb_path} {adb_command}'

    result = subprocess.run(adb_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if result.returncode == 0:
        return result.stdout.strip()
    print_with_color(f"Command execution failed: {adb_command}", "red")
    print_with_color(result.stderr, "red")
    return "ERROR"


# ============================================
# Device Discovery
# ============================================

def list_all_devices() -> List[str]:
    """List all connected Android devices"""
    adb_path = get_adb_path()
    if not adb_path:
        print_with_color("ERROR: adb not found. Please configure Android SDK path in Settings", "red")
        return []

    device_list = []
    result = execute_adb("devices")
    if result != "ERROR":
        devices = result.split("\n")[1:]
        for d in devices:
            if d.strip():  # Skip empty lines
                device_list.append(d.split()[0])

    return device_list


def list_available_emulators() -> List[str]:
    """List all available Android emulators (AVDs)"""

    # Find emulator using helper function
    emulator_path = find_sdk_tool('emulator', 'emulator')

    if not emulator_path:
        print_with_color("ERROR: emulator command not found. Please install Android SDK.", "red")
        print_with_color("Set ANDROID_SDK_PATH in Settings or ensure emulator is in PATH", "yellow")
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


# ============================================
# Emulator Control
# ============================================

def start_emulator(avd_name: str = None, wait_for_boot: bool = True) -> bool:
    """
    Start an Android emulator

    Args:
        avd_name: Name of AVD to start (if None, uses first available)
        wait_for_boot: Wait for emulator to fully boot

    Returns:
        True if successful, False otherwise
    """
    # Get emulator path using helper function
    emulator_path = find_sdk_tool('emulator', 'emulator')

    if not emulator_path:
        print_with_color("ERROR: emulator command not found", "red")
        print_with_color("Please configure Android SDK path in Settings", "yellow")
        sdk_path = get_android_sdk_path()
        if sdk_path:
            print_with_color(f"Current ANDROID_SDK_PATH: {sdk_path}", "yellow")
        else:
            print_with_color("ANDROID_SDK_PATH not set - configure in Settings", "yellow")
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


def wait_for_device(timeout: int = 120) -> bool:
    """
    Wait for Android device to be ready

    Args:
        timeout: Maximum seconds to wait

    Returns:
        True if device is ready, False if timeout
    """
    print_with_color(f"Waiting for device to be ready (timeout: {timeout}s)...", "yellow")

    # Wait for device to be detected
    start_time = time.time()
    while time.time() - start_time < timeout:
        devices = list_all_devices()
        if devices:
            print_with_color(f"Device detected: {devices[0]}", "green")
            break
        time.sleep(2)
    else:
        print_with_color("ERROR: Timeout waiting for device", "red")
        return False

    # Wait for device to boot completely
    print_with_color("Waiting for device to boot completely...", "yellow")
    adb_command = "adb wait-for-device shell getprop sys.boot_completed"

    start_time = time.time()
    while time.time() - start_time < timeout:
        result = execute_adb(adb_command)
        if result == "1":
            print_with_color("✓ Device is ready!", "green")
            time.sleep(2)  # Extra wait for stability
            return True
        time.sleep(3)

    print_with_color("ERROR: Device did not boot in time", "red")
    return False


def stop_emulator(device_serial: str = None) -> bool:
    """
    Stop a running Android emulator

    Args:
        device_serial: Serial number of the emulator to stop (e.g., 'emulator-5554')
                      If None, stops the first detected emulator

    Returns:
        True if successful, False otherwise
    """
    # Find emulator using helper function
    emulator_path = find_sdk_tool('emulator', 'emulator')
    
    if not emulator_path:
        print_with_color("WARNING: emulator command not found, using adb emu kill", "yellow")
        # Fallback to adb emu kill method
        
    # Get device serial if not specified
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            print_with_color("No devices found to stop", "yellow")
            return True
        # Find first emulator (starts with 'emulator-')
        emulators = [d for d in devices if d.startswith('emulator-')]
        if not emulators:
            print_with_color("No emulators found (only physical devices connected)", "yellow")
            return True
        device_serial = emulators[0]
    
    print_with_color(f"Stopping emulator: {device_serial}...", "yellow")
    
    # Try graceful shutdown using adb emu kill
    adb_command = f"adb -s {device_serial} emu kill"
    result = execute_adb(adb_command)
    
    if result != "ERROR":
        print_with_color(f"✓ Emulator {device_serial} stopped successfully", "green")
        # Wait a moment for emulator to fully shut down
        time.sleep(2)
        return True
    else:
        print_with_color(f"Failed to stop emulator {device_serial}", "red")
        return False


def cleanup_emulators() -> int:
    """
    Stop all running emulators
    
    Returns:
        Number of emulators stopped
    """
    devices = list_all_devices()
    emulators = [d for d in devices if d.startswith('emulator-')]
    
    if not emulators:
        print_with_color("No running emulators to clean up", "yellow")
        return 0
    
    print_with_color(f"Cleaning up {len(emulators)} running emulator(s)...", "yellow")
    stopped_count = 0
    
    for emulator in emulators:
        if stop_emulator(emulator):
            stopped_count += 1
    
    print_with_color(f"✓ Stopped {stopped_count}/{len(emulators)} emulator(s)", "green")
    return stopped_count


# ============================================
# App Discovery & Launch
# ============================================

def find_app_package(app_name: str) -> Optional[str]:
    """
    Find app package name by searching installed packages
    
    Args:
        app_name: App name to search for (e.g., 'youtube', 'instagram')
    
    Returns:
        Package name if found, None otherwise
    """
    # Normalize app name for search
    search_term = app_name.lower().strip()
    
    # Get list of all installed packages
    result = execute_adb("adb shell pm list packages")
    if result == "ERROR":
        print_with_color("ERROR: Failed to list packages", "red")
        return None
    
    # Parse package list and search
    packages = result.strip().split('\n')
    matching_packages = []
    
    for pkg in packages:
        # Format: "package:com.example.app"
        if pkg.startswith('package:'):
            package_name = pkg.replace('package:', '').strip()
            if search_term in package_name.lower():
                matching_packages.append(package_name)
    
    if not matching_packages:
        print_with_color(f"No packages found matching '{app_name}'", "yellow")
        return None
    
    # If multiple matches, prefer exact matches or most relevant
    # Priority: exact match > contains search term at end > first match
    for pkg in matching_packages:
        pkg_lower = pkg.lower()
        # Exact match in package name (e.g., com.google.android.youtube)
        if pkg_lower.endswith('.' + search_term) or pkg_lower.endswith(search_term):
            print_with_color(f"Found app package: {pkg}", "green")
            return pkg
    
    # Return first match
    best_match = matching_packages[0]
    print_with_color(f"Found app package: {best_match} (from {len(matching_packages)} matches)", "green")
    return best_match


def launch_app(package_name: str, device_serial: str = None) -> bool:
    """
    Launch an app by package name
    
    Args:
        package_name: Full package name (e.g., 'com.google.android.youtube')
        device_serial: Device serial (optional, uses first device if not specified)
    
    Returns:
        True if successful, False otherwise
    """
    if not package_name:
        print_with_color("ERROR: No package name provided", "red")
        return False
    
    # Get device serial if not specified
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            print_with_color("ERROR: No devices connected", "red")
            return False
        device_serial = devices[0]
    
    print_with_color(f"Launching app: {package_name}...", "yellow")
    
    # Use monkey to launch app (simpler, doesn't require activity name)
    adb_command = f"adb -s {device_serial} shell monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
    result = execute_adb(adb_command)
    
    if result != "ERROR" and "No activities found" not in result:
        print_with_color(f"✓ App launched: {package_name}", "green")
        time.sleep(2)  # Wait for app to start
        return True
    
    # Fallback: try to find and launch main activity
    print_with_color("Trying alternative launch method...", "yellow")
    
    # Get main activity
    dump_cmd = f"adb -s {device_serial} shell dumpsys package {package_name} | grep -A 1 'android.intent.action.MAIN'"
    result = execute_adb(dump_cmd)
    
    if result != "ERROR" and result:
        # Try to extract activity name
        lines = result.strip().split('\n')
        for line in lines:
            if '/' in line and package_name in line:
                # Extract activity: com.example/.MainActivity
                parts = line.strip().split()
                for part in parts:
                    if package_name in part and '/' in part:
                        activity = part.strip()
                        am_cmd = f"adb -s {device_serial} shell am start -n {activity}"
                        result = execute_adb(am_cmd)
                        if result != "ERROR":
                            print_with_color(f"✓ App launched via activity: {activity}", "green")
                            time.sleep(2)
                            return True
    
    print_with_color(f"Failed to launch app: {package_name}", "red")
    return False


# ============================================
# APK Installation
# ============================================

def parse_playstore_url(url: str) -> Optional[str]:
    """
    Extract package name from Google Play Store URL.
    
    Args:
        url: Play Store URL (e.g., 'https://play.google.com/store/apps/details?id=com.example.app')
    
    Returns:
        Package name (e.g., 'com.example.app') or None if not found
    """
    if not url:
        return None
    
    try:
        # Parse the URL
        parsed = urlparse(url)
        
        # Check if it's a Play Store URL
        if 'play.google.com' not in parsed.netloc:
            print_with_color(f"Not a Play Store URL: {url}", "yellow")
            return None
        
        # Extract package name from query parameter 'id'
        query_params = parse_qs(parsed.query)
        if 'id' in query_params:
            package_name = query_params['id'][0]
            print_with_color(f"Extracted package name from URL: {package_name}", "green")
            return package_name
        
        # Try to extract from path (alternative URL format)
        # e.g., /store/apps/details/com.example.app
        path_match = re.search(r'/details/([a-zA-Z0-9._]+)', parsed.path)
        if path_match:
            package_name = path_match.group(1)
            print_with_color(f"Extracted package name from path: {package_name}", "green")
            return package_name
        
        print_with_color(f"Could not extract package name from URL: {url}", "yellow")
        return None
        
    except Exception as e:
        print_with_color(f"Error parsing Play Store URL: {e}", "red")
        return None


def get_package_from_apk(apk_path: str) -> Optional[str]:
    """
    Extract package name from APK file using aapt.
    
    Args:
        apk_path: Path to APK file
    
    Returns:
        Package name or None if extraction failed
    """
    if not os.path.exists(apk_path):
        print_with_color(f"APK file not found: {apk_path}", "red")
        return None
    
    # Try to find aapt in Android SDK build-tools
    sdk_path = get_android_sdk_path()
    aapt_path = None
    
    # Common aapt locations
    if sdk_path:
        build_tools_dir = os.path.join(sdk_path, 'build-tools')
        if os.path.exists(build_tools_dir):
            # Get latest version of build-tools
            versions = sorted(os.listdir(build_tools_dir), reverse=True)
            for version in versions:
                candidate = os.path.join(build_tools_dir, version, 'aapt')
                if os.path.exists(candidate):
                    aapt_path = candidate
                    break
                # Windows
                candidate_exe = os.path.join(build_tools_dir, version, 'aapt.exe')
                if os.path.exists(candidate_exe):
                    aapt_path = candidate_exe
                    break
    
    # Fallback: check if aapt is in PATH
    if not aapt_path:
        aapt_path = shutil.which('aapt')
    
    if not aapt_path:
        print_with_color("aapt not found. Cannot extract package name from APK.", "red")
        print_with_color("Please ensure Android SDK build-tools are installed.", "yellow")
        return None
    
    try:
        # Run aapt dump badging to get package info
        result = subprocess.run(
            [aapt_path, 'dump', 'badging', apk_path],
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print_with_color(f"aapt failed: {result.stderr}", "red")
            return None
        
        # Parse output to find package name
        # Format: package: name='com.example.app' versionCode='1' ...
        match = re.search(r"package:\s+name='([^']+)'", result.stdout)
        if match:
            package_name = match.group(1)
            print_with_color(f"Extracted package name from APK: {package_name}", "green")
            return package_name
        
        print_with_color("Could not parse package name from aapt output", "red")
        return None
        
    except subprocess.TimeoutExpired:
        print_with_color("aapt command timed out", "red")
        return None
    except Exception as e:
        print_with_color(f"Error running aapt: {e}", "red")
        return None


def is_app_installed(package_name: str, device_serial: str = None) -> bool:
    """
    Check if an app is installed on the device.
    
    Args:
        package_name: Package name to check
        device_serial: Device serial (optional)
    
    Returns:
        True if installed, False otherwise
    """
    if not package_name:
        return False
    
    # Build adb command
    if device_serial:
        cmd = f"adb -s {device_serial} shell pm list packages {package_name}"
    else:
        cmd = f"adb shell pm list packages {package_name}"
    
    result = execute_adb(cmd)
    if result == "ERROR":
        return False
    
    # Check if exact package is in the list
    expected = f"package:{package_name}"
    for line in result.strip().split('\n'):
        if line.strip() == expected:
            print_with_color(f"App is installed: {package_name}", "green")
            return True
    
    return False


def install_apk(apk_path: str, device_serial: str = None) -> Dict[str, Any]:
    """
    Install APK file to Android device via ADB.
    
    Args:
        apk_path: Path to APK file
        device_serial: Device serial (optional, uses first device if not specified)
    
    Returns:
        dict: {
            'success': bool,
            'package_name': str or None,
            'error': str or None
        }
    """
    if not os.path.exists(apk_path):
        return {'success': False, 'package_name': None, 'error': f'APK file not found: {apk_path}'}
    
    # Get package name from APK
    package_name = get_package_from_apk(apk_path)
    
    # Get device serial if not specified
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return {'success': False, 'package_name': package_name, 'error': 'No devices connected'}
        device_serial = devices[0]
    
    print_with_color(f"Installing APK: {apk_path}", "yellow")
    print_with_color(f"Target device: {device_serial}", "yellow")
    
    # Build adb install command
    # -r: replace existing application
    # -t: allow test packages
    adb_command = f"adb -s {device_serial} install -r -t \"{apk_path}\""
    
    result = execute_adb(adb_command)
    
    if result == "ERROR":
        return {'success': False, 'package_name': package_name, 'error': 'ADB install command failed'}
    
    # Check if installation was successful
    if "Success" in result:
        print_with_color(f"✓ APK installed successfully: {package_name or apk_path}", "green")
        time.sleep(1)  # Wait for installation to complete
        return {'success': True, 'package_name': package_name, 'error': None}
    elif "INSTALL_FAILED" in result:
        error_msg = result.strip()
        print_with_color(f"APK installation failed: {error_msg}", "red")
        return {'success': False, 'package_name': package_name, 'error': error_msg}
    else:
        print_with_color(f"APK installation result unclear: {result}", "yellow")
        return {'success': False, 'package_name': package_name, 'error': result}


def prelaunch_app(apk_source: Dict[str, Any], device_serial: str = None, status_callback=None) -> Dict[str, Any]:
    """
    Setup flow: Prepare device, install APK if needed, and launch app.
    
    Args:
        apk_source: dict with keys:
            - type: 'apk_file' | 'play_store_url'
            - path: APK file path (for apk_file type)
            - url: Play Store URL (for play_store_url type)
            - packageName: Package name (optional, will be extracted if not provided)
        device_serial: Target device serial (optional)
        status_callback: Optional callback function(status, message) for progress updates
    
    Returns:
        dict: {
            'success': bool,
            'device': str or None,
            'package_name': str or None,
            'error': str or None
        }
    """
    source_type = apk_source.get('type')
    apk_path = apk_source.get('path')
    playstore_url = apk_source.get('url')
    package_name = apk_source.get('packageName')
    
    # Step 1: Check/start device
    devices = list_all_devices()
    target_device = None
    
    if device_serial and device_serial in devices:
        target_device = device_serial
    elif devices:
        target_device = devices[0]
    else:
        # No devices - try to start emulator
        emulators = list_available_emulators()
        if not emulators:
            return {'success': False, 'device': None, 'package_name': package_name, 'error': 'No devices or emulators available'}
        
        if not start_emulator(emulators[0], wait_for_boot=True):
            return {'success': False, 'device': None, 'package_name': package_name, 'error': 'Failed to start emulator'}
        
        devices = list_all_devices()
        if not devices:
            return {'success': False, 'device': None, 'package_name': package_name, 'error': 'Emulator started but not detected'}
        
        target_device = devices[0]
    
    # Step 2: Determine package name and install if needed
    if source_type == 'apk_file' and apk_path:
        # Extract package name if not provided
        if not package_name:
            package_name = get_package_from_apk(apk_path)
        
        # Check if already installed
        if not (package_name and is_app_installed(package_name, target_device)):
            # Install APK
            install_result = install_apk(apk_path, target_device)
            
            if not install_result['success']:
                return {'success': False, 'device': target_device, 'package_name': package_name, 'error': install_result['error']}
            
            package_name = install_result['package_name'] or package_name
    
    elif source_type == 'play_store_url' and playstore_url:
        # Extract package name from URL if not provided
        if not package_name:
            package_name = parse_playstore_url(playstore_url)
        
        if not package_name:
            return {'success': False, 'device': target_device, 'package_name': None, 'error': 'Invalid Play Store URL'}
        
        # Check if already installed
        if not is_app_installed(package_name, target_device):
            # Cannot download from Play Store directly - open Play Store for manual installation
            playstore_cmd = f"adb -s {target_device} shell am start -a android.intent.action.VIEW -d 'market://details?id={package_name}'"
            execute_adb(playstore_cmd)
            
            return {
                'success': False,
                'device': target_device,
                'package_name': package_name,
                'error': f'Please install {package_name} from Play Store manually, then try again'
            }
    
    # Step 3: Launch app
    if package_name:
        launch_app(package_name, target_device)
    
    return {
        'success': True,
        'device': target_device,
        'package_name': package_name,
        'error': None
    }


# ============================================
# Helper Classes
# ============================================

class AndroidElement:
    """Represents an Android UI element with bounding box and attributes"""
    def __init__(self, uid: str, bbox: tuple, attrib: Any):
        self.uid = uid
        self.bbox = bbox
        self.attrib = attrib


# ============================================
# Google Login Functions (for Android)
# ============================================

def get_google_account_count(device_serial: str = None) -> int:
    """
    Get count of Google accounts on device
    
    Args:
        device_serial: Device serial (optional, uses first device if not specified)
    
    Returns:
        int: Number of Google accounts, or -1 on error
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return -1
        device_serial = devices[0]
    
    result = execute_adb(f"adb -s {device_serial} shell dumpsys account")
    if result == "ERROR":
        return -1
    
    # Count "Account {" occurrences
    count = result.count("Account {")
    return count


def open_google_account_settings(device_serial: str = None) -> bool:
    """
    Open Google account add settings on device
    
    Args:
        device_serial: Device serial (optional, uses first device if not specified)
    
    Returns:
        bool: True if successful
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            print_with_color("ERROR: No devices connected", "red")
            return False
        device_serial = devices[0]
    
    result = execute_adb(
        f"adb -s {device_serial} shell am start -a android.settings.ADD_ACCOUNT_SETTINGS"
    )
    return result != "ERROR"


def start_google_login(device_serial: str = None, timeout: int = 600, poll_interval: int = 3, status_callback=None) -> Dict[str, Any]:
    """
    Start Google login flow on Android device.
    
    If no device is connected, attempts to start an emulator.
    If device already has Google account, reports as already logged in.
    Otherwise, opens Google account settings and polls for new account addition.
    
    Args:
        device_serial: Target device serial (optional, auto-selects)
        timeout: Maximum wait time in seconds (default: 600 = 10 minutes)
        poll_interval: Polling interval in seconds (default: 3)
        status_callback: Optional callback function(status, message) for progress updates
    
    Returns:
        dict: {
            'success': bool,
            'device': str or None,
            'already_logged_in': bool,
            'error': str or None
        }
    """
    def report_status(status, message=""):
        """Report status via callback and print"""
        if status_callback:
            status_callback(status, message)
        # Also print for CLI usage
        print(f"[GOOGLE_LOGIN_ANDROID] {status}: {message}", flush=True)
    
    report_status("STARTING", "Starting Android Google login flow")
    
    # Check ADB
    adb_path = get_adb_path()
    if not adb_path:
        report_status("ERROR", "ADB not found. Please configure Android SDK path.")
        return {'success': False, 'device': None, 'already_logged_in': False, 'error': 'ADB not found'}
    
    # Get connected devices
    devices = list_all_devices()
    target_device = None
    
    if device_serial and device_serial in devices:
        target_device = device_serial
        report_status("DEVICE_SELECTED", f"Using specified device: {target_device}")
    elif devices:
        target_device = devices[0]
        report_status("DEVICE_FOUND", f"Using connected device: {target_device}")
    else:
        # No devices connected - try to start emulator
        report_status("NO_DEVICE", "No devices connected. Checking for emulators...")
        
        emulators = list_available_emulators()
        if not emulators:
            report_status("ERROR", "No devices connected and no emulators available.")
            return {'success': False, 'device': None, 'already_logged_in': False, 'error': 'No devices or emulators available'}
        
        report_status("STARTING_EMULATOR", f"Starting emulator: {emulators[0]}")
        
        # Start emulator (this will wait for boot)
        if not start_emulator(emulators[0], wait_for_boot=True):
            report_status("ERROR", "Failed to start emulator")
            return {'success': False, 'device': None, 'already_logged_in': False, 'error': 'Failed to start emulator'}
        
        # Get the new device ID
        devices = list_all_devices()
        if not devices:
            report_status("ERROR", "Emulator started but device not detected")
            return {'success': False, 'device': None, 'already_logged_in': False, 'error': 'Emulator started but not detected'}
        
        target_device = devices[0]
        report_status("EMULATOR_READY", f"Emulator ready: {target_device}")
    
    # Get initial account count
    report_status("CHECKING_ACCOUNTS", "Getting current account count...")
    initial_count = get_google_account_count(target_device)
    if initial_count < 0:
        report_status("ERROR", "Failed to get account count")
        return {'success': False, 'device': target_device, 'already_logged_in': False, 'error': 'Failed to get account count'}
    
    report_status("ACCOUNT_COUNT", f"Current Google accounts: {initial_count}")
    
    # If already has Google account, report as already logged in
    if initial_count > 0:
        report_status("ALREADY_LOGGED_IN", f"Device already has {initial_count} Google account(s)")
        report_status("LOGIN_SUCCESS", f"Device: {target_device}")
        return {'success': True, 'device': target_device, 'already_logged_in': True, 'error': None}
    
    # No account - open Google account settings for user to login
    report_status("OPENING_SETTINGS", "Opening Google account settings...")
    if not open_google_account_settings(target_device):
        report_status("ERROR", "Failed to open account settings")
        return {'success': False, 'device': target_device, 'already_logged_in': False, 'error': 'Failed to open account settings'}
    
    report_status("SETTINGS_OPENED", "Account settings opened on device")
    report_status("WAITING", "Please log in to your Google account on the device...")
    
    # Poll for new account
    elapsed = 0
    while elapsed < timeout:
        current_count = get_google_account_count(target_device)
        
        if current_count > initial_count:
            report_status("ACCOUNT_DETECTED", "New Google account detected!")
            report_status("LOGIN_SUCCESS", f"Device: {target_device}")
            return {'success': True, 'device': target_device, 'already_logged_in': False, 'error': None}
        
        time.sleep(poll_interval)
        elapsed += poll_interval
        
        if elapsed % 30 == 0:
            report_status("WAITING", f"Still waiting for login... ({elapsed}s)")
    
    report_status("TIMEOUT", "Login timeout exceeded")
    return {'success': False, 'device': target_device, 'already_logged_in': False, 'error': 'Timeout waiting for login'}


def check_google_login_status() -> Dict[str, Any]:
    """
    Quick check for Android device status for Google login.
    
    Returns:
        dict: {
            'adb_available': bool,
            'devices': list of connected devices,
            'emulators': list of available AVDs,
            'ready': bool (True if at least one device or emulator available)
        }
    """
    adb_path = get_adb_path()
    
    if not adb_path:
        return {
            'adb_available': False,
            'devices': [],
            'emulators': [],
            'ready': False
        }
    
    devices = list_all_devices()
    emulators = list_available_emulators()
    
    return {
        'adb_available': True,
        'devices': devices,
        'emulators': emulators,
        'ready': len(devices) > 0 or len(emulators) > 0
    }
