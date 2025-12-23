"""
Google Login CLI for Android (Klever Desktop)

CLI wrapper for and_controller.py Google login functions.

Usage:
    python google_login_android.py --mode check|login [--device <device_id>]
"""

import argparse
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from and_controller import check_google_login_status, start_google_login


def main():
    parser = argparse.ArgumentParser(description="Android Google Login for Klever Desktop")
    parser.add_argument(
        "--mode",
        type=str,
        choices=['check', 'login'],
        default='login',
        help="Mode: 'check' to verify device status, 'login' to perform login"
    )
    parser.add_argument(
        "--device",
        type=str,
        default=None,
        help="Target device ID (optional, auto-selects if not provided)"
    )
    
    args = parser.parse_args()
    
    if args.mode == 'check':
        result = check_google_login_status()
        
        # Print status for Electron
        print(f"[GOOGLE_LOGIN_ANDROID] CHECK_RESULT: adb={result['adb_available']}, "
              f"devices={len(result['devices'])}, emulators={len(result['emulators'])}", flush=True)
        
        sys.exit(0 if result['ready'] else 1)
    else:
        # Full login flow - status_callback will print to stdout
        result = start_google_login(device_serial=args.device)
        sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()
