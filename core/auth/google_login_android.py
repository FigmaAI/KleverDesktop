"""
Google Login CLI for Android (Klever Desktop)

Standalone script to handle Google login on Android devices via ADB.
Does NOT depend on legacy AppAgent scripts.

Usage:
    python google_login_android.py --mode check|login [--device <device_id>]
"""

import argparse
import sys
import os
import subprocess
import time
import shutil
import platform


# ============================================
# ADB & Emulator Utils
# ============================================

def get_sdk_path():
    """Get Android SDK path from environment or common locations"""
    # 1. Environment variables
    sdk_path = os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT')
    if sdk_path and os.path.exists(sdk_path):
        return sdk_path

    # 2. Common locations
    home = os.path.expanduser("~")
    system = platform.system()
    
    common_paths = []
    if system == "Darwin":  # macOS
        common_paths = [os.path.join(home, 'Library/Android/sdk')]
    elif system == "Windows":
        common_paths = [os.path.join(home, 'AppData/Local/Android/Sdk')]
    elif system == "Linux":
        common_paths = [os.path.join(home, 'Android/Sdk')]
        
    for path in common_paths:
        if os.path.exists(path):
            return path
            
    return None

def find_tool(tool_name):
    """Find path to SDK tool (adb, emulator)"""
    # 1. Check PATH
    path_executable = shutil.which(tool_name)
    if path_executable:
        return path_executable
        
    # 2. Check SDK directories
    sdk_path = get_sdk_path()
    if not sdk_path:
        return None
        
    search_dirs = ['platform-tools', 'emulator', 'tools', 'tools/bin', 'cmdline-tools/latest/bin']
    
    executable_name = f"{tool_name}.exe" if platform.system() == "Windows" else tool_name
    
    for subdir in search_dirs:
        tool_path = os.path.join(sdk_path, subdir, executable_name)
        if os.path.exists(tool_path):
            return tool_path
            
    return None

def run_adb(args, device_serial=None):
    """Run ADB command"""
    adb_path = find_tool('adb')
    if not adb_path:
        return None
        
    cmd = [adb_path]
    if device_serial:
        cmd.extend(['-s', device_serial])
    
    if isinstance(args, list):
        cmd.extend(args)
    else:
        cmd.extend(args.split())
        
    try:
        result = subprocess.run(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE,
            text=True,
            encoding='utf-8',
            errors='replace'
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except Exception as e:
        print(f"[ADB Error] {e}", file=sys.stderr)
        return None

def list_devices():
    """List connected devices"""
    output = run_adb("devices")
    if not output:
        return []
        
    devices = []
    # Skip first line (List of devices attached)
    for line in output.split('\n')[1:]:
        parts = line.strip().split('\t')
        if len(parts) >= 2 and parts[1] == 'device':
            devices.append(parts[0])
            
    return devices

def list_emulators():
    """List available AVDs"""
    emulator_path = find_tool('emulator')
    if not emulator_path:
        return []
        
    try:
        result = subprocess.run(
            [emulator_path, '-list-avds'],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode == 0:
            return [avd.strip() for avd in result.stdout.strip().split('\n') if avd.strip()]
    except:
        pass
    return []

def start_emulator_process(avd_name):
    """Start emulator process"""
    emulator_path = find_tool('emulator')
    if not emulator_path:
        return False
        
    print(f"[GOOGLE_LOGIN_ANDROID] Starting emulator: {avd_name}...", flush=True)
    
    # Start detached process
    subprocess.Popen(
        [emulator_path, '-avd', avd_name, '-no-snapshot-load'],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    return True

def wait_for_device(timeout=60):
    """Wait for a device to be ready"""
    print(f"[GOOGLE_LOGIN_ANDROID] Waiting for device...", flush=True)
    
    start_time = time.time()
    while time.time() - start_time < timeout:
        devices = list_devices()
        if devices:
            # Check boot completion
            device = devices[0]
            boot_complete = run_adb("shell getprop sys.boot_completed", device)
            if boot_complete == "1":
                return device
        time.sleep(2)
        
    return None

def get_account_count(device):
    """Get Google account count"""
    output = run_adb("shell dumpsys account", device)
    if not output:
        return -1
    return output.count("Account {")

def open_account_settings(device):
    """Open Add Account settings"""
    result = run_adb("shell am start -a android.settings.ADD_ACCOUNT_SETTINGS", device)
    return result is not None


# ============================================
# Main Logic
# ============================================

def print_status(status, message=""):
    print(f"[GOOGLE_LOGIN_ANDROID] {status}: {message}", flush=True)

def handle_check_mode():
    """Check status only"""
    adb_path = find_tool('adb')
    if not adb_path:
        print_status("CHECK_RESULT", "adb=False, devices=0, emulators=0")
        sys.exit(1)
        
    devices = list_devices()
    emulators = list_emulators()
    
    print_status(
        "CHECK_RESULT", 
        f"adb=True, devices={len(devices)}, emulators={len(emulators)}"
    )
    sys.exit(0 if (devices or emulators) else 1)

def handle_login_mode(target_device=None):
    """Handle login flow"""
    # 1. Device Selection
    device = None
    
    # Try specified device
    if target_device:
        devices = list_devices()
        if target_device in devices:
            device = target_device
            print_status("DEVICE_SELECTED", f"Using specified device: {device}")
            
    # Try first connected device
    if not device:
        devices = list_devices()
        if devices:
            device = devices[0]
            print_status("DEVICE_FOUND", f"Using connected device: {device}")
            
    # Try to start emulator
    if not device:
        print_status("NO_DEVICE", "Checking for emulators...")
        emulators = list_emulators()
        
        if not emulators:
            print_status("ERROR", "No devices or emulators found")
            sys.exit(1)
            
        # Start first emulator
        avd = emulators[0]
        if start_emulator_process(avd):
            device = wait_for_device(timeout=120)
            
        if not device:
            print_status("ERROR", "Failed to start emulator or wait for device")
            sys.exit(1)
            
        print_status("EMULATOR_READY", f"Emulator ready: {device}")

    # 2. Check current accounts
    print_status("CHECKING_ACCOUNTS", "Getting account count...")
    initial_count = get_account_count(device)
    
    if initial_count < 0:
        print_status("ERROR", "Failed to get account count from device")
        sys.exit(1)
        
    print_status("ACCOUNT_COUNT", f"Current Google accounts: {initial_count}")
    
    if initial_count > 0:
        print_status("ALREADY_LOGGED_IN", f"Device already has {initial_count} accounts")
        print_status("LOGIN_SUCCESS", f"Device: {device}")
        sys.exit(0)
        
    # 3. Open Settings & Wait
    print_status("OPENING_SETTINGS", "Opening account settings...")
    if not open_account_settings(device):
        print_status("ERROR", "Failed to open account settings")
        sys.exit(1)
        
    print_status("WAITING", "Please log in to your Google account on the device...")
    
    # 4. Polling loop
    timeout = 600  # 10 minutes
    start_time = time.time()
    
    while time.time() - start_time < timeout:
        current_count = get_account_count(device)
        
        if current_count > initial_count:
            print_status("ACCOUNT_DETECTED", "New account detected!")
            print_status("LOGIN_SUCCESS", f"Device: {device}")
            sys.exit(0)
            
        time.sleep(3)
        
    print_status("TIMEOUT", "Login timed out")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Android Google Login for Klever Desktop")
    parser.add_argument("--mode", choices=['check', 'login'], default='login')
    parser.add_argument("--device", default=None)
    
    args = parser.parse_args()
    
    if args.mode == 'check':
        handle_check_mode()
    else:
        handle_login_mode(args.device)

if __name__ == "__main__":
    main()
