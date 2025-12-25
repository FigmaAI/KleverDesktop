"""
GELab (General Element Lab) Automation Engine.
The next-generation UI automation engine for Klever Desktop.

Rewritten based on engines/gelab/examples/run_single_task.py
which was verified to work correctly with the emulator.
"""

import os
import sys
import json
import time
import signal

# Ensure project root is in path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Ensure gelab engine dir is in path for local imports (copilot_*, tools, etc.)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from core.engine_interface import EngineInterface
from core.utils import print_with_color, append_to_log

# Global flag for graceful shutdown
_shutdown_requested = False

def signal_handler(signum, frame):
    """Handle SIGTERM/SIGINT for graceful shutdown."""
    global _shutdown_requested
    _shutdown_requested = True
    print_with_color("[GELab] Shutdown signal received, stopping...", "yellow")

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

# Global cumulative token tracking for Electron progress
_cumulative_tokens = 0
_cumulative_input_tokens = 0
_cumulative_output_tokens = 0

# Step timing tracking (from run_single_task.py)
_step_times = []


def emit_progress(round_num, max_rounds, tokens_this_round=0,
                  input_tokens_this_round=0, output_tokens_this_round=0):
    """Emit structured progress JSON for Electron to parse."""
    global _cumulative_tokens, _cumulative_input_tokens, _cumulative_output_tokens
    _cumulative_tokens += tokens_this_round
    _cumulative_input_tokens += input_tokens_this_round
    _cumulative_output_tokens += output_tokens_this_round
    
    progress = {
        "round": round_num,
        "maxRounds": max_rounds,
        "totalTokens": _cumulative_tokens,
        "inputTokens": _cumulative_input_tokens,
        "outputTokens": _cumulative_output_tokens
    }
    print(f"PROGRESS:{json.dumps(progress)}", flush=True)


def wrap_automate_step_with_timing(server_instance, max_rounds):
    """
    Wrap automate_step method to add timing and progress reporting.
    Based on run_single_task.py pattern.
    """
    original_method = server_instance.automate_step

    def timed_automate_step(payload):
        step_start = time.time()
        try:
            result = original_method(payload)
        finally:
            duration = time.time() - step_start
            _step_times.append(duration)
            step_num = len(_step_times)
            print(f"Step {step_num} took: {duration:.2f} seconds")
            
            # Estimate tokens based on response (rough approximation)
            # Real token counting would require LLM response metadata
            emit_progress(step_num, max_rounds, tokens_this_round=500,
                         input_tokens_this_round=400, output_tokens_this_round=100)
        return result

    # Replace instance method
    server_instance.automate_step = timed_automate_step


class GELabEngine(EngineInterface):
    """
    GELab (General Element Lab) Automation Engine.
    Uses original gelab-zero flow for Android UI automation.
    
    Based on the working pattern from examples/run_single_task.py
    """
    
    def __init__(self):
        self.status = "IDLE"
        
    def start(self) -> bool:
        print_with_color("[GELab] Engine Initialized", "green")
        return True

    def stop(self) -> bool:
        print_with_color("[GELab] Engine Stopped", "yellow")
        self.status = "STOPPED"
        return True

    def execute_task(self, task: str, params=None) -> dict:
        """
        Execute a task using original gelab-zero flow.
        Based on examples/run_single_task.py which is verified to work.
        """
        global _cumulative_tokens, _cumulative_input_tokens, _cumulative_output_tokens, _step_times
        
        # Reset counters
        _cumulative_tokens = 0
        _cumulative_input_tokens = 0
        _cumulative_output_tokens = 0
        _step_times = []
        
        self.status = "RUNNING"
        print_with_color(f"[GELab] 🚀 Starting Task: {task}", "cyan")
        
        # Extract parameters
        params = params or {}
        default_task_dir = os.path.join(current_dir, 'running_log')
        task_dir = params.get('task_dir', default_task_dir)
        
        max_rounds = params.get('max_rounds', int(os.environ.get('MAX_ROUNDS', 20)))
        model_name = params.get('model_name', os.environ.get('MODEL_NAME', 'gpt-4.1-mini'))
        model_provider = params.get('model_provider', os.environ.get('MODEL_PROVIDER', 'openai'))
        
        # Get device and package info from Electron's prelaunch_app
        device_from_electron = params.get('device')
        package_name = params.get('package_name')
        
        # Ensure task directory exists
        os.makedirs(task_dir, exist_ok=True)
        log_dir = os.path.join(task_dir, 'traces')
        image_dir = os.path.join(task_dir, 'images')
        os.makedirs(log_dir, exist_ok=True)
        os.makedirs(image_dir, exist_ok=True)
        
        # Setup report path
        task_dir_name = os.path.basename(task_dir)
        report_path = os.path.join(task_dir, f"log_report_{task_dir_name}.md")
        print_with_color(f"[GELab] Report: {report_path}", "blue")
        os.environ["GELAB_REPORT_PATH"] = report_path
        
        start_time = time.time()
        
        try:
            # Import gelab-zero components (same as run_single_task.py)
            from copilot_agent_client.pu_client import evaluate_task_on_device
            from copilot_front_end.mobile_action_helper import (
                list_devices, get_device_wm_size
            )
            from copilot_agent_server.local_server import LocalServer
            
            # === Server Configuration (from run_single_task.py) ===
            server_config = {
                "log_dir": log_dir,
                "image_dir": image_dir,
                "debug": False  # Set to True for verbose logging
            }
            server = LocalServer(server_config)
            
            # === Device Detection ===
            devices = list_devices()
            if not devices:
                raise ValueError("No Android devices connected")
            device_id = devices[0]
            
            device_wm_size = get_device_wm_size(device_id)
            device_info = {
                "device_id": device_id,
                "device_wm_size": device_wm_size
            }
            print_with_color(f"[GELab] Device: {device_id}, Size: {device_wm_size}", "green")
            
            # If package_name is provided, reset to HOME then launch app
            # This ensures clean state + correct app
            if package_name:
                import subprocess
                # First, press HOME for clean state
                home_cmd = f"adb -s {device_id} shell input keyevent 3"
                print_with_color(f"[GELab] Pressing HOME for clean state", "green")
                subprocess.run(home_cmd, shell=True, capture_output=True, text=True)
                time.sleep(1)
                
                # Then launch the app
                print_with_color(f"[GELab] Launching app: {package_name}", "green")
                launch_cmd = f"adb -s {device_id} shell monkey -p {package_name} -c android.intent.category.LAUNCHER 1"
                subprocess.run(launch_cmd, shell=True, capture_output=True, text=True)
                time.sleep(2)  # Wait for app to fully launch
            
            # === Rollout Configuration (from run_single_task.py) ===
            # CRITICAL: task_type MUST match keys in copilot_agent_server/parser_factory.py
            rollout_config = {
                "task_type": "parser_0922_summary",
                "model_config": {
                    "model_name": model_name,
                    "model_provider": model_provider,
                    "args": {
                        "temperature": 0.1,
                        "top_p": 0.95,
                        "max_tokens": 4096,
                    },
                },
                "max_steps": max_rounds,
                "delay_after_capture": 2,  # Same as run_single_task.py
                "debug": False
            }
            
            # Inject timing and progress wrapper (from run_single_task.py)
            wrap_automate_step_with_timing(server, max_rounds)
            
            # Emit initial progress
            emit_progress(0, max_rounds)
            
            # === Execute Task ===
            # reset_environment=False: We already pressed HOME and launched app above
            result = evaluate_task_on_device(
                server,
                device_info,
                task,
                rollout_config,
                reflush_app=False,  # Don't force-stop app in AWAKE action
                reset_environment=False  # Don't press HOME again (already done above)
            )
            
            total_time = time.time() - start_time
            
            # Extract result info
            stop_reason = result.get('stop_reason', 'UNKNOWN')
            stop_steps = result.get('stop_steps', len(_step_times))
            session_id = result.get('session_id', '')
            
            # Emit final progress
            emit_progress(stop_steps, max_rounds)
            
            success = stop_reason == 'COMPLETE'
            
            self.status = "IDLE"
            
            final_result = {
                "success": success,
                "message": f"GELab execution {stop_reason}",
                "task": task,
                "total_steps": stop_steps,
                "total_tokens": _cumulative_tokens,
                "total_time": round(total_time, 2),
                "report_path": report_path,
                "session_id": session_id,
                "stop_reason": stop_reason
            }
            
            # Print execution time summary
            print(f"Total execution time: {total_time:.2f} seconds")
            print(json.dumps(final_result))
            return final_result
            
        except ImportError as e:
            print_with_color(f"[GELab] Import error: {e}", "red")
            import traceback
            traceback.print_exc()
            return self._return_error(task, str(e), report_path, time.time() - start_time)
            
        except Exception as e:
            print_with_color(f"[GELab] Error: {e}", "red")
            import traceback
            traceback.print_exc()
            total_time = time.time() - start_time
            self._append_error_to_report(report_path, task, str(e), total_time)
            return self._return_error(task, str(e), report_path, total_time)

    def _return_error(self, task: str, error_msg: str, report_path: str, total_time: float) -> dict:
        """Return error result."""
        self.status = "IDLE"
        result = {
            "success": False,
            "message": error_msg,
            "task": task,
            "total_time": round(total_time, 2),
            "report_path": report_path
        }
        print(json.dumps(result))
        return result

    def _append_error_to_report(self, report_path: str, task: str, error_msg: str, total_time: float):
        """Append error summary to existing report or create new if not exists."""
        error_content = f"""
## ⚠️ Error Occurred

**Error:** {error_msg}

**Time Elapsed:** {total_time:.2f}s

---
*Report generated by GELab Engine*
"""
        if os.path.exists(report_path):
            with open(report_path, 'a', encoding='utf-8') as f:
                f.write(error_content)
        else:
            content = f"""# GELab Execution Report

## Task
{task}

{error_content}
"""
            with open(report_path, 'w', encoding='utf-8') as f:
                f.write(content)

    def get_status(self) -> str:
        return self.status
