import os
import time
import shutil
from typing import List, Tuple
from playwright.sync_api import sync_playwright, Page, Browser
import cv2
from bs4 import BeautifulSoup

from config import load_config
from utils import print_with_color


configs = load_config()


def normalize_url(url: str) -> str:
    """
    Normalize URL by adding protocol if missing.

    Args:
        url: URL string (e.g., "google.com" or "https://google.com")

    Returns:
        Normalized URL with protocol (e.g., "https://google.com")
    """
    if not url:
        return url

    # Remove whitespace
    url = url.strip()

    # Add protocol if missing
    if not url.startswith(('http://', 'https://', 'file://')):
        url = f'https://{url}'

    return url


class WebElement:
    """Web element similar to AndroidElement for consistency"""
    def __init__(self, uid, bbox, attrib):
        self.uid = uid
        self.bbox = bbox
        self.attrib = attrib


def extract_interactive_elements(page: Page, html_content: str = None) -> List[WebElement]:
    """
    Extract interactive elements from HTML using Playwright's accessibility tree
    and DOM analysis. Returns list of WebElement objects.

    Interactive elements include:
    - Links (<a>)
    - Buttons (<button>, <input type="button/submit">)
    - Input fields (<input>, <textarea>, <select>)
    - Clickable elements (role="button", onclick handlers)
    """
    elem_list = []

    if html_content is None:
        html_content = page.content()

    # Use Playwright's built-in locator to find interactive elements
    # This is more reliable than pure HTML parsing
    selectors = [
        'a[href]',  # Links
        'button',  # Buttons
        'input:not([type="hidden"])',  # Input fields (excluding hidden)
        'textarea',  # Text areas
        'select',  # Dropdowns
        '[role="button"]',  # ARIA buttons
        '[onclick]',  # Elements with click handlers
        '[role="link"]',  # ARIA links
        '[role="textbox"]',  # ARIA textboxes
        '[contenteditable="true"]',  # Editable content
    ]

    seen_positions = set()
    min_dist = configs.get("MIN_DIST", 30)

    for selector in selectors:
        try:
            elements = page.locator(selector).all()
            for elem in elements:
                try:
                    # Check if element is visible
                    if not elem.is_visible():
                        continue

                    # Get bounding box
                    bbox_dict = elem.bounding_box()
                    if not bbox_dict:
                        continue

                    x = bbox_dict['x']
                    y = bbox_dict['y']
                    width = bbox_dict['width']
                    height = bbox_dict['height']

                    # Skip tiny elements (likely not interactive)
                    if width < 5 or height < 5:
                        continue

                    # Calculate center
                    center_x = int(x + width / 2)
                    center_y = int(y + height / 2)

                    # Check if too close to existing element
                    too_close = False
                    for seen_pos in seen_positions:
                        dist = ((center_x - seen_pos[0]) ** 2 + (center_y - seen_pos[1]) ** 2) ** 0.5
                        if dist < min_dist:
                            too_close = True
                            break

                    if too_close:
                        continue

                    seen_positions.add((center_x, center_y))

                    # Get element attributes
                    tag_name = elem.evaluate("el => el.tagName.toLowerCase()")
                    elem_id = elem.get_attribute("id") or ""
                    elem_class = elem.get_attribute("class") or ""
                    elem_type = elem.get_attribute("type") or ""
                    elem_role = elem.get_attribute("role") or ""
                    elem_text = elem.inner_text()[:50] if elem.inner_text() else ""
                    elem_placeholder = elem.get_attribute("placeholder") or ""

                    # Create unique identifier
                    uid = f"{tag_name}"
                    if elem_id:
                        uid += f"#{elem_id}"
                    elif elem_class:
                        class_name = elem_class.split()[0] if elem_class else ""
                        uid += f".{class_name}"
                    if elem_type:
                        uid += f"[type={elem_type}]"
                    if elem_text:
                        safe_text = elem_text.replace(" ", "_").replace("/", "_")[:20]
                        uid += f"_{safe_text}"

                    # Store attributes
                    attrib = {
                        "tag": tag_name,
                        "id": elem_id,
                        "class": elem_class,
                        "type": elem_type,
                        "role": elem_role,
                        "text": elem_text,
                        "placeholder": elem_placeholder,
                        "selector": selector,
                        "center": (center_x, center_y)
                    }

                    # Create WebElement
                    bbox = ((int(x), int(y)), (int(x + width), int(y + height)))
                    web_elem = WebElement(uid, bbox, attrib)
                    elem_list.append(web_elem)

                except Exception as e:
                    # Skip elements that cause errors
                    continue

        except Exception as e:
            # Skip selectors that cause errors
            continue

    print_with_color(f"Found {len(elem_list)} interactive elements on the page", "yellow")
    return elem_list


class WebController:
    """Web controller using Playwright, similar interface to AndroidController"""

    def __init__(self, browser_type="chromium", headless=False, url=None, user_data_dir=None):
        """
        Initialize Playwright browser

        Args:
            browser_type: "chromium", "firefox", or "webkit"
            headless: Run browser in headless mode
            url: Initial URL to navigate to
            user_data_dir: Path to browser profile directory for persistent context.
                          If provided, uses launch_persistent_context to maintain
                          login sessions and cookies across restarts.
        """
        self.playwright = sync_playwright().start()
        self.browser = None  # Only set when not using persistent context
        self.user_data_dir = user_data_dir
        self._is_persistent = user_data_dir is not None

        if user_data_dir:
            # Use persistent context for maintaining login sessions
            os.makedirs(user_data_dir, exist_ok=True)
            print_with_color(f"Using persistent browser profile: {user_data_dir}", "yellow")
            
            if browser_type == "chromium":
                self.context = self.playwright.chromium.launch_persistent_context(
                    user_data_dir=user_data_dir,
                    headless=headless,
                    viewport={"width": 1280, "height": 720},
                    args=[
                        '--disable-blink-features=AutomationControlled',
                        '--disable-infobars',
                    ],
                    ignore_default_args=['--enable-automation'],
                )
            elif browser_type == "firefox":
                self.context = self.playwright.firefox.launch_persistent_context(
                    user_data_dir=user_data_dir,
                    headless=headless,
                    viewport={"width": 1280, "height": 720},
                )
            elif browser_type == "webkit":
                self.context = self.playwright.webkit.launch_persistent_context(
                    user_data_dir=user_data_dir,
                    headless=headless,
                    viewport={"width": 1280, "height": 720},
                )
            else:
                raise ValueError(f"Invalid browser_type: {browser_type}")
            
            # Get or create page from persistent context
            if self.context.pages:
                self.page = self.context.pages[0]
            else:
                self.page = self.context.new_page()
        else:
            # Standard non-persistent browser launch
            if browser_type == "chromium":
                self.browser = self.playwright.chromium.launch(headless=headless)
            elif browser_type == "firefox":
                self.browser = self.playwright.firefox.launch(headless=headless)
            elif browser_type == "webkit":
                self.browser = self.playwright.webkit.launch(headless=headless)
            else:
                raise ValueError(f"Invalid browser_type: {browser_type}")

            # Create context and page
            self.context = self.browser.new_context(
                viewport={"width": 1280, "height": 720},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            self.page = self.context.new_page()

        # Get viewport size
        viewport = self.page.viewport_size
        self.width = viewport["width"]
        self.height = viewport["height"]

        mode = "persistent" if self._is_persistent else "standard"
        print_with_color(f"WebController initialized: {browser_type}, {self.width}x{self.height} ({mode} mode)", "green")

        # Navigate to initial URL if provided
        if url:
            url = normalize_url(url)
            try:
                # Use 'load' instead of 'networkidle' for dynamic sites like Gmail
                self.page.goto(url, wait_until="load", timeout=60000)
            except Exception as e:
                # If load times out, try domcontentloaded as fallback
                print_with_color(f"Initial navigation slow, waiting for content: {e}", "yellow")
                try:
                    self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
                except Exception:
                    print_with_color(f"Navigation timeout - page may still be loading", "yellow")
            print_with_color(f"Navigated to: {url}", "yellow")

    def navigate(self, url: str):
        """Navigate to URL"""
        url = normalize_url(url)
        try:
            self.page.goto(url, wait_until="load", timeout=60000)
        except Exception:
            # Fallback for slow pages
            try:
                self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
            except Exception:
                print_with_color(f"Navigation timeout - page may still be loading", "yellow")
        time.sleep(1)  # Extra wait for dynamic content
        return self.page.url

    def get_screenshot(self, prefix: str, save_dir: str) -> str:
        """
        Capture screenshot and save to file

        Args:
            prefix: Filename prefix (e.g., "step_1")
            save_dir: Directory to save screenshot

        Returns:
            Path to saved screenshot
        """
        os.makedirs(save_dir, exist_ok=True)
        screenshot_path = os.path.join(save_dir, f"{prefix}.png")
        self.page.screenshot(path=screenshot_path, full_page=False)
        return screenshot_path

    def get_html(self, prefix: str, save_dir: str) -> str:
        """
        Get HTML content and save to file (similar to get_xml for Android)

        Args:
            prefix: Filename prefix
            save_dir: Directory to save HTML

        Returns:
            Path to saved HTML file
        """
        os.makedirs(save_dir, exist_ok=True)
        html_path = os.path.join(save_dir, f"{prefix}.html")
        html_content = self.page.content()

        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html_content)

        return html_path

    def get_interactive_elements(self) -> List[WebElement]:
        """Get list of interactive elements on current page"""
        return extract_interactive_elements(self.page)

    def back(self):
        """Go back to previous page"""
        self.page.go_back(wait_until="networkidle")
        return "SUCCESS"

    def tap(self, x: int, y: int):
        """
        Click at coordinates (x, y)

        Args:
            x: X coordinate
            y: Y coordinate
        """
        try:
            self.page.mouse.click(x, y)
            time.sleep(0.5)  # Wait for click to register
            return "SUCCESS"
        except Exception as e:
            print_with_color(f"Click failed: {e}", "red")
            return "ERROR"

    def click_element(self, element: WebElement):
        """Click on a WebElement"""
        center = element.attrib.get("center")
        if center:
            return self.tap(center[0], center[1])
        return "ERROR"

    def text(self, input_str: str):
        """
        Type text into focused element

        Args:
            input_str: Text to type
        """
        try:
            self.page.keyboard.type(input_str)
            time.sleep(0.3)
            return "SUCCESS"
        except Exception as e:
            print_with_color(f"Text input failed: {e}", "red")
            return "ERROR"

    def text_to_element(self, element: WebElement, input_str: str):
        """Type text into specific element"""
        try:
            # Click element first to focus
            self.click_element(element)
            time.sleep(0.2)

            # Clear existing text if input field
            if element.attrib.get("tag") in ["input", "textarea"]:
                self.page.keyboard.press("Control+A")
                self.page.keyboard.press("Backspace")

            # Type text
            return self.text(input_str)
        except Exception as e:
            print_with_color(f"Text to element failed: {e}", "red")
            return "ERROR"

    def scroll(self, direction: str, amount: int = None):
        """
        Scroll the page

        Args:
            direction: "up", "down", "left", "right"
            amount: Scroll amount in pixels (default: 1/3 of viewport)
        """
        if amount is None:
            amount = self.height // 3 if direction in ["up", "down"] else self.width // 3

        try:
            if direction == "down":
                self.page.mouse.wheel(0, amount)
            elif direction == "up":
                self.page.mouse.wheel(0, -amount)
            elif direction == "right":
                self.page.mouse.wheel(amount, 0)
            elif direction == "left":
                self.page.mouse.wheel(-amount, 0)
            else:
                return "ERROR"

            time.sleep(0.5)  # Wait for scroll to complete
            return "SUCCESS"
        except Exception as e:
            print_with_color(f"Scroll failed: {e}", "red")
            return "ERROR"

    def swipe(self, x: int, y: int, direction: str, dist: str = "medium", quick: bool = False):
        """
        Swipe gesture (implemented as scroll for web)
        Kept for compatibility with Android controller interface
        """
        return self.scroll(direction)

    def get_current_url(self) -> str:
        """Get current page URL"""
        return self.page.url

    def get_page_title(self) -> str:
        """Get current page title"""
        return self.page.title()

    def get_screenshot_with_bbox(self, screenshot_before, save_path, tl, br):
        """
        Copy screenshot and draw bounding box on it

        Args:
            screenshot_before: Path to original screenshot
            save_path: Path to save screenshot with bbox
            tl: Top-left corner (x, y)
            br: Bottom-right corner (x, y)

        Returns:
            Path to saved screenshot
        """
        # Copy the screenshot_before image
        shutil.copy(screenshot_before, save_path)

        # Load the copied image
        img = cv2.imread(save_path)

        # Draw the bounding box on the image
        cv2.rectangle(img, (int(tl[0]), int(tl[1])), (int(br[0]), int(br[1])), (0, 255, 0), 2)

        # Save the image with the bounding box
        cv2.imwrite(save_path, img)

        return save_path

    def draw_circle(self, x, y, img_path, r=10, thickness=2):
        """
        Draw a circle on an image at specified coordinates

        Args:
            x: X coordinate
            y: Y coordinate
            img_path: Path to image file
            r: Circle radius (default: 10)
            thickness: Line thickness (default: 2)
        """
        img = cv2.imread(img_path)
        cv2.circle(img, (int(x), int(y)), r, (0, 0, 255), thickness)
        cv2.imwrite(img_path, img)

    def draw_arrow(self, x, y, direction, dist, image_path, arrow_color=(0, 255, 0), thickness=2):
        """
        Draw an arrow on an image to indicate swipe direction

        Args:
            x: Starting X coordinate
            y: Starting Y coordinate
            direction: Arrow direction ("up", "down", "left", "right")
            dist: Distance ("short", "medium", "long")
            image_path: Path to image file
            arrow_color: RGB color tuple (default: green)
            thickness: Line thickness (default: 2)
        """
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

    def close(self):
        """Close browser and cleanup"""
        try:
            self.page.close()
        except Exception:
            pass
        
        try:
            self.context.close()
        except Exception:
            pass
        
        # Only close browser if not using persistent context
        if self.browser is not None:
            try:
                self.browser.close()
            except Exception:
                pass
        
        try:
            self.playwright.stop()
        except Exception:
            pass
        
        mode = "persistent" if self._is_persistent else "standard"
        print_with_color(f"WebController closed ({mode} mode)", "yellow")
    
    def is_persistent(self) -> bool:
        """Check if using persistent browser context"""
        return self._is_persistent
    
    def get_profile_path(self) -> str:
        """Get the browser profile directory path (only for persistent context)"""
        return self.user_data_dir if self._is_persistent else None
    
    def save_storage_state(self, path: str = None) -> str:
        """
        Save browser storage state (cookies, localStorage) to JSON file.
        Useful for preserving login sessions.
        
        Args:
            path: Path to save storage state (default: google-auth.json in profile dir)
        
        Returns:
            Path to saved storage state file
        """
        if path is None and self.user_data_dir:
            path = os.path.join(self.user_data_dir, 'google-auth.json')
        elif path is None:
            raise ValueError("Must specify path or use persistent context")
        
        self.context.storage_state(path=path)
        print_with_color(f"Storage state saved to: {path}", "green")
        return path


# ============================================
# Google Login Functions
# ============================================

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
    import json
    
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
    import re
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
                report_status("STATE_SAVED", f"Auth state saved")
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
                report_status("STATE_SAVED", f"Auth state saved")
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
