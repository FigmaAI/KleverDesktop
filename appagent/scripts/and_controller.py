import os
import subprocess
import xml.etree.ElementTree as ET
import cv2
import shutil

from config import load_config
from utils import print_with_color


configs = load_config()


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


class AndroidElement:
    def __init__(self, uid, bbox, attrib):
        self.uid = uid
        self.bbox = bbox
        self.attrib = attrib


def get_adb_path():
    """Get adb executable path using find_sdk_tool helper"""
    return find_sdk_tool('adb', 'platform-tools')


def execute_adb(adb_command):
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


def list_all_devices():
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


def list_available_emulators():
    """List all available Android emulators (AVDs)"""

    # Find emulator using new helper function
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


def wait_for_device(timeout=120):
    """
    Wait for Android device to be ready

    Args:
        timeout: Maximum seconds to wait

    Returns:
        True if device is ready, False if timeout
    """
    import time

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


def find_app_package(app_name):
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


def launch_app(package_name, device_serial=None):
    """
    Launch an app by package name
    
    Args:
        package_name: Full package name (e.g., 'com.google.android.youtube')
        device_serial: Device serial (optional, uses first device if not specified)
    
    Returns:
        True if successful, False otherwise
    """
    import time
    
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


def start_emulator_with_app(avd_name=None, app_name=None, wait_for_boot=True):
    """
    Start emulator and optionally launch an app
    
    Args:
        avd_name: Name of AVD to start (if None, uses first available)
        app_name: App name to launch after boot (e.g., 'youtube')
        wait_for_boot: Wait for emulator to fully boot
    
    Returns:
        True if successful, False otherwise
    """
    # Start emulator
    if not start_emulator(avd_name, wait_for_boot):
        return False
    
    # Launch app if specified
    if app_name:
        package_name = find_app_package(app_name)
        if package_name:
            return launch_app(package_name)
        else:
            print_with_color(f"App '{app_name}' not found, but device is ready", "yellow")
            return True  # Device is ready, just app not found
    
    return True


def stop_emulator(device_serial=None):
    """
    Stop a running Android emulator

    Args:
        device_serial: Serial number of the emulator to stop (e.g., 'emulator-5554')
                      If None, stops the first detected emulator

    Returns:
        True if successful, False otherwise
    """
    import time

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


def cleanup_emulators():
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
# Google Login Functions
# ============================================

def get_google_account_count(device_serial=None):
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


def open_google_account_settings(device_serial=None):
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


def start_google_login(device_serial=None, timeout=600, poll_interval=3, status_callback=None):
    """
    Start Google login flow on Android device.
    
    If no device is connected, attempts to start an emulator.
    If device already has Google account, asks user to confirm.
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
    import time
    
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


def check_google_login_status():
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


def get_id_from_element(elem):
    bounds = elem.attrib["bounds"][1:-1].split("][")
    x1, y1 = map(int, bounds[0].split(","))
    x2, y2 = map(int, bounds[1].split(","))
    elem_w, elem_h = x2 - x1, y2 - y1
    if "resource-id" in elem.attrib and elem.attrib["resource-id"]:
        elem_id = elem.attrib["resource-id"].replace(":", ".").replace("/", "_")
    else:
        elem_id = f"{elem.attrib['class']}_{elem_w}_{elem_h}"
    if "content-desc" in elem.attrib and elem.attrib["content-desc"] and len(elem.attrib["content-desc"]) < 20:
        content_desc = elem.attrib['content-desc'].replace("/", "_").replace(" ", "").replace(":", "_")
        elem_id += f"_{content_desc}"
    return elem_id


def traverse_tree(xml_path, elem_list, attrib, add_index=False):
    path = []
    for event, elem in ET.iterparse(xml_path, ['start', 'end']):
        if event == 'start':
            path.append(elem)
            if attrib in elem.attrib and elem.attrib[attrib] == "true":
                parent_prefix = ""
                if len(path) > 1:
                    parent_prefix = get_id_from_element(path[-2])
                bounds = elem.attrib["bounds"][1:-1].split("][")
                x1, y1 = map(int, bounds[0].split(","))
                x2, y2 = map(int, bounds[1].split(","))
                center = (x1 + x2) // 2, (y1 + y2) // 2
                elem_id = get_id_from_element(elem)
                if parent_prefix:
                    elem_id = parent_prefix + "_" + elem_id
                if add_index:
                    elem_id += f"_{elem.attrib['index']}"
                close = False
                for e in elem_list:
                    bbox = e.bbox
                    center_ = (bbox[0][0] + bbox[1][0]) // 2, (bbox[0][1] + bbox[1][1]) // 2
                    dist = (abs(center[0] - center_[0]) ** 2 + abs(center[1] - center_[1]) ** 2) ** 0.5
                    if dist <= configs["MIN_DIST"]:
                        close = True
                        break
                if not close:
                    elem_list.append(AndroidElement(elem_id, ((x1, y1), (x2, y2)), attrib))

        if event == 'end':
            path.pop()

class AndroidController:
    def __init__(self, device):
        self.device = device
        self.screenshot_dir = configs["ANDROID_SCREENSHOT_DIR"]
        self.xml_dir = configs["ANDROID_XML_DIR"]
        self.backslash = "\\"
        self.width, self.height = self.get_device_size()
        self.setup_device()

    def setup_device(self):
        """Setup device: prepare for automation"""
        print_with_color("Device ready for automation", "green")

    def get_device_size(self):
        adb_command = f"adb -s {self.device} shell wm size"
        result = execute_adb(adb_command)
        if result != "ERROR":
            return map(int, result.split(": ")[1].split("x"))
        return 0, 0

    def get_screenshot(self, prefix, save_dir):
        cap_command = f"adb -s {self.device} shell screencap -p " \
                      f"{os.path.join(self.screenshot_dir, prefix + '.png').replace(self.backslash, '/')}"
        pull_command = f"adb -s {self.device} pull " \
                       f"{os.path.join(self.screenshot_dir, prefix + '.png').replace(self.backslash, '/')} " \
                       f"{os.path.join(save_dir, prefix + '.png')}"
        result = execute_adb(cap_command)
        if result != "ERROR":
            result = execute_adb(pull_command)
            if result != "ERROR":
                return os.path.join(save_dir, prefix + ".png")
            return result
        return result

    def get_xml(self, prefix, save_dir):
        dump_command = f"adb -s {self.device} shell uiautomator dump " \
                       f"{os.path.join(self.xml_dir, prefix + '.xml').replace(self.backslash, '/')}"
        pull_command = f"adb -s {self.device} pull " \
                       f"{os.path.join(self.xml_dir, prefix + '.xml').replace(self.backslash, '/')} " \
                       f"{os.path.join(save_dir, prefix + '.xml')}"
        result = execute_adb(dump_command)
        if result != "ERROR":
            result = execute_adb(pull_command)
            if result != "ERROR":
                return os.path.join(save_dir, prefix + ".xml")
            return result
        return result

    def back(self):
        adb_command = f"adb -s {self.device} shell input keyevent KEYCODE_BACK"
        ret = execute_adb(adb_command)
        return ret

    def tap(self, x, y):
        adb_command = f"adb -s {self.device} shell input tap {x} {y}"
        ret = execute_adb(adb_command)
        return ret

    def text(self, input_str):
        input_str = input_str.replace(" ", "%s")
        input_str = input_str.replace("'", "")
        adb_command = f"adb -s {self.device} shell input text {input_str}"
        ret = execute_adb(adb_command)
        return ret

    def long_press(self, x, y, duration=1000):
        adb_command = f"adb -s {self.device} shell input swipe {x} {y} {x} {y} {duration}"
        ret = execute_adb(adb_command)
        return ret

    def swipe(self, x, y, direction, dist="medium", quick=False):
        unit_dist = int(self.width / 10)
        if dist == "long":
            unit_dist *= 3
        elif dist == "medium":
            unit_dist *= 2
        if direction == "up":
            offset = 0, -2 * unit_dist
        elif direction == "down":
            offset = 0, 2 * unit_dist
        elif direction == "left":
            offset = -1 * unit_dist, 0
        elif direction == "right":
            offset = unit_dist, 0
        else:
            return "ERROR"
        duration = 100 if quick else 400
        adb_command = f"adb -s {self.device} shell input swipe {x} {y} {x+offset[0]} {y+offset[1]} {duration}"
        ret = execute_adb(adb_command)
        return ret

    def swipe_precise(self, start, end, duration=400):
        start_x, start_y = start
        end_x, end_y = end
        adb_command = f"adb -s {self.device} shell input swipe {start_x} {start_y} {end_x} {end_y} {duration}"
        ret = execute_adb(adb_command)
        return ret

    def get_screenshot_with_bbox(self, screenshot_before, save_dir, tl, br):
        # Copy the screenshot_before image
        img_path = save_dir
        shutil.copy(screenshot_before, img_path)

        # Load the copied image
        img = cv2.imread(img_path)

        # Draw the bounding box on the image
        cv2.rectangle(img, (int(tl[0]), int(tl[1])), (int(br[0]), int(br[1])), (0, 255, 0), 2)

        # Save the image with the bounding box
        cv2.imwrite(img_path, img)

        return img_path

    def draw_circle(self, x, y, img_path, r=10, thickness=2):
        img = cv2.imread(img_path)
        cv2.circle(img, (int(x), int(y)), r, (0, 0, 255), thickness)
        cv2.imwrite(img_path, img)

    def draw_arrow(self, x, y, direction, dist, image_path, arrow_color=(0, 255, 0), thickness=2):
        img = cv2.imread(image_path)

        # Calculate the arrow length based on the screen width and dist
        screen_width = img.shape[1]
        unit_dist = int(screen_width / 10)
        if dist == "long":
            arrow_length = 3 * unit_dist
        elif dist == "medium":
            arrow_length = 2 * unit_dist
        else:
            arrow_length = unit_dist

        # Define the arrow directions
        if direction == "up":
            end_point = (x, y - arrow_length)
        elif direction == "down":
            end_point = (x, y + arrow_length)
        elif direction == "left":
            end_point = (x - arrow_length, y)
        elif direction == "right":
            end_point = (x + arrow_length, y)
        else:
            raise ValueError(f"Invalid direction: {direction}")

        # Draw the arrow
        cv2.arrowedLine(img, (x, y), end_point, arrow_color, thickness)

        # Save the modified image
        cv2.imwrite(image_path, img)
