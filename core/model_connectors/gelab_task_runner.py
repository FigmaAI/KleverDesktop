"""
GELab Task Runner - Main execution loop for GELab-based automation.

This module provides the main execution loop for running tasks with GELab models.
It's designed to be called from self_explorer.py when a GELab model is detected.

Key differences from standard AppAgent flow:
- Uses raw screenshots (no UI element labeling)
- Uses GELabConnector for prompt generation and response parsing
- Uses coordinate-based actions (tap_coords, swipe_coords, etc.)
"""

import os
import sys
import json
import time
from typing import Dict, Any, Optional, Callable

# Add parent directories to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
core_dir = os.path.dirname(current_dir)
project_root = os.path.dirname(core_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from core.model_connectors.gelab import GELabConnector
from core.llm_adapter import LLMAdapter


def is_gelab_model(model_name: str) -> bool:
    """
    Check if the model is a GELab-family model.
    
    Args:
        model_name: Model name (e.g., 'ollama/gelab-zero-4b-preview')
        
    Returns:
        True if GELab model, False otherwise
    """
    if not model_name:
        return False
    return "gelab" in model_name.lower()


def draw_action_highlight(
    image_path: str,
    output_path: str,
    action_type: str,
    coords: tuple,
    end_coords: tuple = None,
    color: tuple = (0, 255, 0),  # Green in BGR
    thickness: int = 3
) -> str:
    """
    Draw action highlight on screenshot.
    
    Args:
        image_path: Path to original screenshot
        output_path: Path to save highlighted image
        action_type: Type of action (tap_coords, swipe_coords, long_press_coords)
        coords: (x, y) primary coordinates
        end_coords: (x, y) end coordinates for swipe
        color: BGR color tuple
        thickness: Line thickness
        
    Returns:
        Path to highlighted image or original path on error
    """
    import cv2
    import shutil
    
    try:
        img = cv2.imread(image_path)
        if img is None:
            return image_path
        
        x, y = int(coords[0]), int(coords[1])
        
        if action_type == "tap_coords":
            # Draw crosshair + circle for tap
            radius = 40
            cv2.circle(img, (x, y), radius, color, thickness)
            cv2.circle(img, (x, y), 5, color, -1)  # Filled center dot
            # Crosshair lines
            cv2.line(img, (x - radius - 10, y), (x - radius + 15, y), color, thickness)
            cv2.line(img, (x + radius - 15, y), (x + radius + 10, y), color, thickness)
            cv2.line(img, (x, y - radius - 10), (x, y - radius + 15), color, thickness)
            cv2.line(img, (x, y + radius - 15), (x, y + radius + 10), color, thickness)
            
        elif action_type == "long_press_coords":
            # Double circle for long press
            cv2.circle(img, (x, y), 50, color, thickness)
            cv2.circle(img, (x, y), 30, color, thickness)
            cv2.circle(img, (x, y), 5, color, -1)
            
        elif action_type == "swipe_coords" and end_coords:
            x2, y2 = int(end_coords[0]), int(end_coords[1])
            # Arrow from start to end
            cv2.arrowedLine(img, (x, y), (x2, y2), color, thickness, tipLength=0.1)
            cv2.circle(img, (x, y), 15, color, -1)  # Start point
            
        elif action_type == "text":
            # Keyboard icon area (just highlight cursor area)
            cv2.rectangle(img, (x - 50, y - 30), (x + 50, y + 30), (255, 165, 0), thickness)  # Orange
            
        cv2.imwrite(output_path, img)
        return output_path
        
    except Exception as e:
        # On error, just copy original
        try:
            shutil.copy(image_path, output_path)
        except:
            pass
        return output_path


def run_gelab_round(
    connector: GELabConnector,
    llm_adapter: LLMAdapter,
    controller,  # AndroidController instance
    task_desc: str,
    task_dir: str,
    round_count: int,
    last_summary: str = "",
    report_log_path: Optional[str] = None,
    emit_progress: Optional[Callable] = None,
    configs: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Execute a single round of GELab-based automation.
    
    This is the core function that handles:
    1. Take screenshot (raw, no labeling)
    2. Generate GELab prompt
    3. Call LLM
    4. Parse response
    5. Execute action
    
    Args:
        connector: GELabConnector instance
        llm_adapter: LLMAdapter instance for LLM calls
        controller: AndroidController instance
        task_desc: Task description
        task_dir: Directory to store task artifacts
        round_count: Current round number
        last_summary: Summary of previous actions
        report_log_path: Path to report log file
        emit_progress: Progress callback function
        configs: Configuration dictionary
        
    Returns:
        Dict with:
            - success: bool
            - action_type: str (tap_coords, text, FINISH, etc.)
            - summary: str (new summary for next round)
            - metadata: dict (tokens, response_time, etc.)
            - error: str or None
    """
    from engines.appagent.scripts.and_controller import (
        tap_coords, swipe_coords, long_press_coords, 
        gelab_coords_to_device, get_device_size as get_device_size_standalone
    )
    from core.utils import append_images_as_table
    from engines.appagent.scripts.utils import print_with_color, append_to_log
    
    configs = configs or {}
    
    # Step 1: Take screenshot (raw, no labeling needed for GELab)
    screenshot_path = controller.get_screenshot(f"{round_count}_before", task_dir)
    if screenshot_path == "ERROR":
        return {
            "success": False,
            "action_type": "ERROR",
            "summary": last_summary,
            "metadata": {},
            "error": "Failed to capture screenshot"
        }
    
    # Get device size for coordinate conversion
    device_size = (controller.width, controller.height)
    
    # Step 2: Generate GELab prompt
    prompt = connector.make_prompt(
        task=task_desc,
        image_path=screenshot_path,
        history=last_summary
    )
    
    # Step 3: Call LLM via LLMAdapter
    print_with_color("🤖 [GELab] Thinking about what to do...", "yellow")
    
    start_time = time.time()
    response = llm_adapter.chat(
        message=prompt,
        images=[screenshot_path]
    )
    elapsed = time.time() - start_time
    
    if not response.get("success"):
        return {
            "success": False,
            "action_type": "ERROR",
            "summary": last_summary,
            "metadata": {"response_time": elapsed},
            "error": response.get("error", "LLM call failed")
        }
    
    raw_response = response.get("content", "")
    metadata = {
        "response_time": elapsed,
        "total_tokens": response.get("usage", {}).get("total_tokens", 0),
        "prompt_tokens": response.get("usage", {}).get("prompt_tokens", 0),
        "completion_tokens": response.get("usage", {}).get("completion_tokens", 0),
        "model": llm_adapter.model,
        "provider": "gelab"
    }
    
    # Step 4: Parse response using connector
    parsed = connector.parse_response(raw_response)
    action_type = parsed.get("action_type", "ERROR")
    
    # Log to report
    if report_log_path:
        append_to_log(f"\n**Observation:** {parsed.get('observation', '')}\n", report_log_path)
        append_to_log(f"**Thought:** {parsed.get('thought', '')}\n", report_log_path)
        append_to_log(f"**Action:** {action_type}\n", report_log_path)
        append_to_log(f"**Summary:** {parsed.get('summary', '')}\n", report_log_path)
    
    print_with_color(f"🎯 [GELab] Action: {action_type}", "cyan")
    
    # Variables for highlight
    highlight_coords = None
    highlight_end_coords = None
    
    # Step 5: Execute action
    new_summary = parsed.get("summary", last_summary)
    device_serial = controller.device
    
    if action_type == "FINISH":
        return {
            "success": True,
            "action_type": "FINISH",
            "summary": new_summary,
            "metadata": metadata,
            "error": None,
            "value": parsed.get("value", "")
        }
    
    elif action_type == "tap_coords":
        target = parsed.get("target", [0, 0])
        x, y = connector.convert_coords_to_pixels(target, device_size)
        highlight_coords = (x, y)
        print_with_color(f"👆 [GELab] Tap at ({x}, {y}) [normalized: {target}]", "green")
        
        result = tap_coords(x, y, device_serial)
        if result == "ERROR":
            return {
                "success": False,
                "action_type": action_type,
                "summary": new_summary,
                "metadata": metadata,
                "error": "tap_coords execution failed"
            }
    
    elif action_type == "text":
        input_text = parsed.get("value", "")
        print_with_color(f"⌨️ [GELab] Type: '{input_text}'", "green")
        
        result = controller.text(input_text)
        if result == "ERROR":
            return {
                "success": False,
                "action_type": action_type,
                "summary": new_summary,
                "metadata": metadata,
                "error": "text execution failed"
            }
    
    elif action_type == "swipe_coords":
        start = parsed.get("target", [0, 0])
        end = parsed.get("end_point", [0, 0])
        x1, y1 = connector.convert_coords_to_pixels(start, device_size)
        x2, y2 = connector.convert_coords_to_pixels(end, device_size)
        highlight_coords = (x1, y1)
        highlight_end_coords = (x2, y2)
        print_with_color(f"👆 [GELab] Swipe from ({x1}, {y1}) to ({x2}, {y2})", "green")
        
        result = swipe_coords(x1, y1, x2, y2, 300, device_serial)
        if result == "ERROR":
            return {
                "success": False,
                "action_type": action_type,
                "summary": new_summary,
                "metadata": metadata,
                "error": "swipe_coords execution failed"
            }
    
    elif action_type == "long_press_coords":
        target = parsed.get("target", [0, 0])
        x, y = connector.convert_coords_to_pixels(target, device_size)
        highlight_coords = (x, y)
        print_with_color(f"👆 [GELab] Long press at ({x}, {y})", "green")
        
        result = long_press_coords(x, y, 1000, device_serial)
        if result == "ERROR":
            return {
                "success": False,
                "action_type": action_type,
                "summary": new_summary,
                "metadata": metadata,
                "error": "long_press_coords execution failed"
            }
    
    elif action_type == "wait":
        wait_time = int(parsed.get("value", 1))
        print_with_color(f"⏳ [GELab] Wait {wait_time}s", "green")
        time.sleep(wait_time)
    
    elif action_type == "launch_app":
        app_name = parsed.get("value", "")
        print_with_color(f"🚀 [GELab] Launch app: {app_name}", "green")
        from engines.appagent.scripts.and_controller import find_app_package, launch_app
        package = find_app_package(app_name)
        if package:
            launch_app(package, device_serial)
    
    elif action_type == "ask_user":
        question = parsed.get("value", "")
        print_with_color(f"❓ [GELab] Question for user: {question}", "blue")
        # For now, just log and continue - could be enhanced to pause for input
    
    else:
        print_with_color(f"⚠️ [GELab] Unknown action: {action_type}", "yellow")
    
    # Step 6: Save highlighted screenshot and add to report
    if highlight_coords and report_log_path:
        import shutil
        highlighted_path = os.path.join(task_dir, f"{round_count}_before_action.png")
        
        draw_action_highlight(
            image_path=screenshot_path,
            output_path=highlighted_path,
            action_type=action_type,
            coords=highlight_coords,
            end_coords=highlight_end_coords
        )
        
        # Add images to report as table
        append_images_as_table([
            ("Before", f"./{round_count}_before.png"),
            ("Action", f"./{round_count}_before_action.png")
        ], report_log_path)
    elif report_log_path:
        # No coordinates (e.g., text action) - just add original screenshot
        append_images_as_table([
            ("Screenshot", f"./{round_count}_before.png")
        ], report_log_path)
    
    # Emit progress if callback provided
    if emit_progress:
        emit_progress(
            round_count, 
            configs.get("MAX_ROUNDS", 20),
            metadata.get("total_tokens", 0),
            metadata.get("response_time", 0),
            metadata.get("prompt_tokens", 0),
            metadata.get("completion_tokens", 0)
        )
    
    return {
        "success": True,
        "action_type": action_type,
        "summary": new_summary,
        "metadata": metadata,
        "error": None
    }


def run_gelab_task(
    controller,
    task_desc: str,
    task_dir: str,
    model_name: str,
    api_key: str = "",
    base_url: str = "",
    max_rounds: int = 20,
    report_log_path: Optional[str] = None,
    emit_progress: Optional[Callable] = None,
    configs: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Run a complete task using GELab model.
    
    This is the main entry point called from self_explorer.py
    when a GELab model is detected.
    
    Args:
        controller: AndroidController instance
        task_desc: Task description
        task_dir: Directory for task artifacts
        model_name: Model name (e.g., 'ollama/gelab-zero-4b-preview')
        api_key: API key
        base_url: API base URL
        max_rounds: Maximum rounds
        report_log_path: Report log path
        emit_progress: Progress callback
        configs: Configuration dict
        
    Returns:
        Dict with success, rounds, error, etc.
    """
    from engines.appagent.scripts.utils import print_with_color
    
    configs = configs or {}
    
    # Initialize connector and LLM adapter
    connector = GELabConnector()
    llm_adapter = LLMAdapter(
        model=model_name,
        api_base=base_url if base_url else None,
        api_key=api_key if api_key else None,
        temperature=configs.get("TEMPERATURE", 0.5),
        max_tokens=configs.get("MAX_TOKENS", 2048)
    )
    
    print_with_color("=" * 60, "green")
    print_with_color("🚀 GELab Mode Activated", "green")
    print_with_color(f"   Model: {model_name}", "green")
    print_with_color(f"   Task: {task_desc}", "green")
    print_with_color("=" * 60, "green")
    
    round_count = 0
    last_summary = ""
    total_tokens = 0
    total_time = 0.0
    
    while round_count < max_rounds:
        round_count += 1
        print_with_color(f"\n--- Round {round_count}/{max_rounds} ---", "yellow")
        
        result = run_gelab_round(
            connector=connector,
            llm_adapter=llm_adapter,
            controller=controller,
            task_desc=task_desc,
            task_dir=task_dir,
            round_count=round_count,
            last_summary=last_summary,
            report_log_path=report_log_path,
            emit_progress=emit_progress,
            configs=configs
        )
        
        # Accumulate metrics
        total_tokens += result.get("metadata", {}).get("total_tokens", 0)
        total_time += result.get("metadata", {}).get("response_time", 0)
        
        if not result.get("success"):
            return {
                "success": False,
                "rounds": round_count,
                "total_tokens": total_tokens,
                "total_time": total_time,
                "error": result.get("error", "Unknown error")
            }
        
        if result.get("action_type") == "FINISH":
            print_with_color(f"\n✅ Task completed in {round_count} rounds!", "green")
            return {
                "success": True,
                "rounds": round_count,
                "total_tokens": total_tokens,
                "total_time": total_time,
                "error": None
            }
        
        last_summary = result.get("summary", last_summary)
        
        # Wait between rounds
        time.sleep(configs.get("REQUEST_INTERVAL", 1))
    
    # Max rounds reached
    print_with_color(f"\n⚠️ Max rounds ({max_rounds}) reached", "yellow")
    return {
        "success": False,
        "rounds": round_count,
        "total_tokens": total_tokens,
        "total_time": total_time,
        "error": f"Max rounds ({max_rounds}) reached without completing task"
    }
