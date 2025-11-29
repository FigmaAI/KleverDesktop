"""
Google Login CLI for Web Browser (Klever Desktop)

CLI wrapper for web_controller.py Google login functions.

Usage:
    python google_login.py --profile_dir <path> --mode check|login
"""

import argparse
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from web_controller import check_google_login_from_storage, start_google_login


def print_status(status: str, message: str = ""):
    """Print status message for Electron to capture"""
    print(f"[GOOGLE_LOGIN_STATUS] {status}: {message}", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Google Login with Playwright")
    parser.add_argument(
        "--profile_dir",
        type=str,
        required=True,
        help="Directory to store browser profile and auth state"
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=['check', 'login'],
        default='login',
        help="Mode: 'check' to verify login status, 'login' to perform login"
    )
    parser.add_argument(
        "--url",
        type=str,
        default="https://accounts.google.com",
        help="Initial URL to navigate to (for login mode)"
    )
    
    args = parser.parse_args()
    
    if args.mode == 'check':
        # Quick check without browser
        result = check_google_login_from_storage(args.profile_dir)
        
        if result['logged_in']:
            print_status("CHECK_RESULT", "LOGGED_IN")
        else:
            print_status("CHECK_RESULT", "NOT_LOGGED_IN")
        
        sys.exit(0 if result['logged_in'] else 1)
    else:
        # Full login flow
        def status_callback(status, message):
            # Translate to expected format
            print_status(status, message)
        
        result = start_google_login(
            profile_dir=args.profile_dir,
            status_callback=status_callback
        )
        
        sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()
