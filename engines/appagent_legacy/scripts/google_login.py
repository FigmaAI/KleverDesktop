"""
Google Login CLI for Web Browser (Klever Desktop)

Provides Google login functionality using Playwright for persistent browser sessions.

Usage:
    python google_login.py --profile_dir <path> --mode check|login
"""

import argparse
import json
import os
import re
import sys

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


# ============================================
# Google Login Functions (moved from web_controller.py)
# ============================================

def print_with_color(text: str, color: str):
    """Simple colored print for CLI output"""
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "reset": "\033[0m"
    }
    print(f"{colors.get(color, '')}{text}{colors['reset']}")


def get_storage_state_path(profile_dir: str) -> str:
    """Get path for storage state JSON file"""
    return os.path.join(profile_dir, 'google-auth.json')


def check_google_login_from_storage(profile_dir: str) -> dict:
    """
    Quick check if already logged into Google using saved storage state.
    No browser needed - just inspects the JSON file for auth cookies.
    
    Args:
        profile_dir: Browser profile directory path
    
    Returns:
        dict: {'logged_in': bool, 'has_auth_cookies': bool}
    """
    storage_path = get_storage_state_path(profile_dir)
    
    if not os.path.exists(storage_path):
        return {'logged_in': False, 'has_auth_cookies': False}
    
    try:
        with open(storage_path, 'r') as f:
            state = json.load(f)
            cookies = state.get('cookies', [])
            
            # Filter Google cookies
            google_cookies = [c for c in cookies if 'google.com' in c.get('domain', '')]
            
            # Check for essential Google auth cookies
            auth_cookie_names = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID']
            has_auth_cookies = any(
                c.get('name') in auth_cookie_names 
                for c in google_cookies
            )
            
            return {
                'logged_in': has_auth_cookies,
                'has_auth_cookies': has_auth_cookies
            }
            
    except Exception as e:
        print_with_color(f"Error reading storage state: {e}", "red")
        return {'logged_in': False, 'has_auth_cookies': False}


def start_google_login(profile_dir: str, timeout: int = 600, status_callback=None) -> dict:
    """
    Start Google login flow with persistent browser context.
    
    Uses Playwright's wait_for_url() for reliable login detection.
    
    Args:
        profile_dir: Directory to store browser profile
        timeout: Maximum wait time in seconds (default: 600 = 10 minutes)
        status_callback: Optional callback function(status, message) for progress updates
    
    Returns:
        dict: {
            'success': bool,
            'profile_path': str,
            'error': str or None
        }
    """
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    
    def report_status(status, message=""):
        """Report status via callback and print"""
        if status_callback:
            status_callback(status, message)
        print(f"[GOOGLE_LOGIN_WEB] {status}: {message}", flush=True)
    
    report_status("STARTING", f"Profile: {profile_dir}")
    os.makedirs(profile_dir, exist_ok=True)
    storage_state_path = get_storage_state_path(profile_dir)
    
    # Success URL patterns
    success_patterns = [
        r'myaccount\.google\.com',
        r'accounts\.google\.com/b/',
        r'accounts\.google\.com/SignOutOptions',
        r'mail\.google\.com',
        r'drive\.google\.com',
    ]
    success_regex = re.compile('|'.join(success_patterns), re.IGNORECASE)
    
    with sync_playwright() as p:
        report_status("LAUNCHING", "Opening browser...")
        
        context = p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            headless=False,
            viewport={"width": 1280, "height": 800},
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
            ],
            ignore_default_args=['--enable-automation'],
        )
        
        page = context.pages[0] if context.pages else context.new_page()
        
        # Navigate to Google accounts
        report_status("NAVIGATING", "Opening accounts.google.com")
        
        try:
            page.goto('https://accounts.google.com', wait_until='domcontentloaded', timeout=30000)
        except PlaywrightTimeout:
            report_status("WARNING", "Page load timeout, continuing...")
        
        current_url = page.url
        report_status("URL_LOADED", f"Current URL: {current_url}")
        
        # Check if already logged in
        if success_regex.search(current_url):
            report_status("ALREADY_LOGGED_IN", "User is already logged into Google!")
            
            try:
                context.storage_state(path=storage_state_path)
                report_status("STATE_SAVED", "Auth state saved")
            except Exception as e:
                report_status("WARNING", f"Could not save storage state: {e}")
            
            report_status("LOGIN_SUCCESS", "Google login session confirmed")
            
            # Wait for close signal
            report_status("WAITING_CONFIRM", "Waiting for confirmation...")
            try:
                page.wait_for_event("close", timeout=0)
            except:
                pass
            
            try:
                context.close()
            except:
                pass
            
            return {'success': True, 'profile_path': profile_dir, 'error': None}
        
        # Not logged in - wait for user to complete login
        report_status("WAITING", "Please log in to your Google account...")
        
        try:
            # Wait for redirect to success URL
            page.wait_for_url(
                lambda url: bool(success_regex.search(url)),
                timeout=timeout * 1000,
                wait_until='domcontentloaded'
            )
            
            final_url = page.url
            report_status("LOGIN_DETECTED", f"Redirected to: {final_url}")
            
            # Wait for cookies to settle
            page.wait_for_timeout(2000)
            
            # Save storage state
            try:
                context.storage_state(path=storage_state_path)
                report_status("STATE_SAVED", "Auth state saved")
            except Exception as e:
                report_status("WARNING", f"Could not save storage state: {e}")
            
            report_status("LOGIN_SUCCESS", "Google login detected successfully")
            
            # Wait for close signal
            report_status("WAITING_CONFIRM", "Waiting for confirmation...")
            try:
                page.wait_for_event("close", timeout=0)
            except:
                pass
            
            try:
                context.close()
            except:
                pass
            
            return {'success': True, 'profile_path': profile_dir, 'error': None}
            
        except PlaywrightTimeout:
            report_status("TIMEOUT", f"Login timeout - {timeout}s exceeded")
            try:
                context.close()
            except:
                pass
            return {'success': False, 'profile_path': profile_dir, 'error': 'Timeout'}
            
        except Exception as e:
            error_msg = str(e)
            if "Target page, context or browser has been closed" in error_msg:
                report_status("CANCELLED", "Browser closed by user")
            else:
                report_status("ERROR", f"Unexpected error: {error_msg[:200]}")
            
            try:
                context.close()
            except:
                pass
            return {'success': False, 'profile_path': profile_dir, 'error': error_msg}


# ============================================
# CLI Interface
# ============================================

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
