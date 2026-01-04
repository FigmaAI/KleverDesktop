"""
Android UI Automation Controller for AppAgent

This module provides UI automation-specific functions for Android devices.
Basic Android utilities (device management, emulator control, APK installation)
are imported from core.android module to avoid code duplication.

Architecture:
- core.android: Basic Android utilities (used by all engines and setup)
- and_controller: AppAgent-specific UI automation (AndroidController class)
"""

import os
import subprocess
import xml.etree.ElementTree as ET
import cv2
import shutil

from config import load_config
from utils import print_with_color

# Import basic Android utilities from core module
from core.android import (
    # SDK & ADB utilities
    get_android_sdk_path,
    find_sdk_tool,
    get_adb_path,
    execute_adb,

    # Device discovery
    list_all_devices,
    list_available_emulators,

    # Emulator control
    start_emulator,
    wait_for_device,
    stop_emulator,
    restart_emulator_cold,
    cleanup_emulators,

    # App management
    find_app_package,
    launch_app,
    parse_playstore_url,
    get_package_from_apk,
    is_app_installed,
    install_apk,
    prelaunch_app,

    # Google login
    get_google_account_count,
    open_google_account_settings,
    start_google_login,
    check_google_login_status,

    # Data classes
    AndroidElement,
)

configs = load_config()


# ============================================
# AppAgent-specific utility functions
# ============================================

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


# ============================================
# AndroidController Class
# ============================================

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

    def enter(self):
        """Press Enter key (useful for submitting search queries)"""
        adb_command = f"adb -s {self.device} shell input keyevent KEYCODE_ENTER"
        ret = execute_adb(adb_command)
        return ret

    def tap(self, x, y):
        adb_command = f"adb -s {self.device} shell input tap {x} {y}"
        ret = execute_adb(adb_command)
        return ret

    def text(self, input_str):
        """
        Input text to the device.

        Supports UTF-8 characters (including Korean, Chinese, Japanese) by using
        ADBKeyboard IME for non-ASCII text and direct input for ASCII text.

        Method:
        - ASCII text: Uses 'input text' command (fast)
        - Non-ASCII text (Korean, etc.): Uses ADBKeyboard IME or clipboard fallback
        """
        import base64
        import time

        if not input_str:
            return "ERROR"

        # Check if input contains non-ASCII characters (e.g., Korean, Chinese, Japanese)
        has_non_ascii = any(ord(char) > 127 for char in input_str)

        if has_non_ascii:
            # Method 1: Try ADBKeyboard IME (most reliable for non-ASCII)
            # ADBKeyboard uses base64 encoding via broadcast
            encoded = base64.b64encode(input_str.encode('utf-8')).decode('ascii')
            broadcast_cmd = f'adb -s {self.device} shell am broadcast -a ADB_INPUT_B64 --es msg {encoded}'
            result = execute_adb(broadcast_cmd)

            # Check if ADBKeyboard received the broadcast successfully
            if result != "ERROR" and "result=0" in result:
                print_with_color(f"Text entered via ADBKeyboard: {input_str}", "green")
                return result

            # Method 2: Try clipboard + paste (works on most devices)
            print_with_color(f"ADBKeyboard not available, trying clipboard method for: {input_str}", "yellow")

            # Escape special shell characters in the input string
            escaped_str = input_str.replace('\\', '\\\\').replace('"', '\\"').replace("'", "\\'").replace('$', '\\$').replace('`', '\\`')

            # Set clipboard content (Android 8.0+ / API 26+)
            # Note: Some emulators may not support cmd clipboard
            clipboard_cmd = f'adb -s {self.device} shell "cmd clipboard set \\"{escaped_str}\\""'
            clipboard_result = execute_adb(clipboard_cmd)

            if clipboard_result == "ERROR":
                # Try alternative clipboard method using settings
                print_with_color("Clipboard cmd failed, trying am broadcast method...", "yellow")

                # Method 3: Use am broadcast to set clipboard (works on more devices)
                clip_broadcast = f'adb -s {self.device} shell am broadcast -a clipper.set -e text "{escaped_str}"'
                clip_result = execute_adb(clip_broadcast)

                if clip_result == "ERROR" or "result=-1" in clip_result:
                    print_with_color(f"Failed to set clipboard for text: {input_str}", "red")
                    print_with_color("Tip: Install ADBKeyboard for reliable non-ASCII input", "yellow")
                    return "ERROR"

            # Small delay to ensure clipboard is set
            time.sleep(0.2)

            # Send paste keyevent (Ctrl+V = KEYCODE_PASTE = 279)
            paste_cmd = f"adb -s {self.device} shell input keyevent 279"
            paste_result = execute_adb(paste_cmd)

            if paste_result != "ERROR":
                print_with_color(f"Text pasted from clipboard: {input_str}", "green")
                return paste_result

            # Method 4: Final fallback - type character by character using Unicode
            print_with_color("Paste failed, trying Unicode input method...", "yellow")
            for char in input_str:
                # Use %s for space, Unicode code point for non-ASCII
                if ord(char) > 127:
                    # Input Unicode character using shell printf
                    unicode_cmd = f"adb -s {self.device} shell input text $(printf '\\u{ord(char):04x}')"
                    execute_adb(unicode_cmd)
                    time.sleep(0.05)
                elif char == ' ':
                    execute_adb(f"adb -s {self.device} shell input text %s")
                else:
                    execute_adb(f"adb -s {self.device} shell input text {char}")
                    time.sleep(0.01)

            print_with_color(f"Text entered character by character: {input_str}", "yellow")
            return "OK"
        else:
            # ASCII text - use standard input text command (fast and reliable)
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


# ============================================
# Coordinate-based Action Functions (for GELab connector)
# ============================================

def tap_coords(x: int, y: int, device_serial: str = None):
    """
    Standalone coordinate-based tap function.

    Used by GELab connector for coordinate-based actions.

    Args:
        x: X coordinate in pixels
        y: Y coordinate in pixels
        device_serial: Device serial (optional, uses first device)

    Returns:
        Command result or "ERROR"
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return "ERROR"
        device_serial = devices[0]

    adb_command = f"adb -s {device_serial} shell input tap {x} {y}"
    return execute_adb(adb_command)


def swipe_coords(x1: int, y1: int, x2: int, y2: int, duration: int = 300, device_serial: str = None):
    """
    Standalone coordinate-based swipe function.

    Args:
        x1, y1: Start coordinates
        x2, y2: End coordinates
        duration: Swipe duration in ms (default: 300)
        device_serial: Device serial (optional)

    Returns:
        Command result or "ERROR"
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return "ERROR"
        device_serial = devices[0]

    adb_command = f"adb -s {device_serial} shell input swipe {x1} {y1} {x2} {y2} {duration}"
    return execute_adb(adb_command)


def long_press_coords(x: int, y: int, duration: int = 1000, device_serial: str = None):
    """
    Standalone coordinate-based long press function.

    Args:
        x: X coordinate in pixels
        y: Y coordinate in pixels
        duration: Press duration in ms (default: 1000)
        device_serial: Device serial (optional)

    Returns:
        Command result or "ERROR"
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return "ERROR"
        device_serial = devices[0]

    # Long press is implemented as swipe from same point to same point
    adb_command = f"adb -s {device_serial} shell input swipe {x} {y} {x} {y} {duration}"
    return execute_adb(adb_command)


def gelab_coords_to_device(point: list, device_size: tuple) -> tuple:
    """
    Convert GELab normalized coordinates (0-1000) to device pixels.

    GELab uses a 0-1000 coordinate system normalized to screen dimensions.
    This function converts to actual device pixel coordinates.

    Args:
        point: [x, y] in 0-1000 range
        device_size: (width, height) in pixels

    Returns:
        (x, y) pixel coordinates
    """
    x = int(point[0] / 1000 * device_size[0])
    y = int(point[1] / 1000 * device_size[1])
    return (x, y)


def get_device_size(device_serial: str = None) -> tuple:
    """
    Get device screen size in pixels.

    Args:
        device_serial: Device serial (optional, uses first device)

    Returns:
        (width, height) or (0, 0) on error
    """
    if device_serial is None:
        devices = list_all_devices()
        if not devices:
            return (0, 0)
        device_serial = devices[0]

    adb_command = f"adb -s {device_serial} shell wm size"
    result = execute_adb(adb_command)

    if result != "ERROR":
        try:
            size_str = result.split(": ")[1]
            width, height = map(int, size_str.split("x"))
            return (width, height)
        except (IndexError, ValueError):
            pass

    return (0, 0)
