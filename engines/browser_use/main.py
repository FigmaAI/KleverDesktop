"""
Browser-Use Engine for Klever Desktop.
Independent web automation engine using browser-use library.

This is a standalone engine that implements EngineInterface.
It does NOT depend on gelab or appagent_legacy.
"""

import os
import sys
import json
import time
import signal
import asyncio
import atexit

# Ensure project root is in path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from core.engine_interface import EngineInterface
from core.utils import print_with_color, append_to_log, append_images_as_table

# Global reference for cleanup on signal
_active_browser = None


def _cleanup_browser():
    """Cleanup function to ensure browser is closed."""
    print("[DEBUG] _cleanup_browser: Starting cleanup...", flush=True)
    try:
        # Use wrapper's cleanup function
        from .wrapper import force_stop_browser
        print("[DEBUG] _cleanup_browser: Calling force_stop_browser()...", flush=True)
        result = force_stop_browser()
        print(f"[DEBUG] _cleanup_browser: force_stop_browser returned: {result}", flush=True)
        print_with_color("✓ Browser closed", "green")
    except Exception as e:
        print(f"[DEBUG] _cleanup_browser: Error: {e}", flush=True)
        print_with_color(f"Browser cleanup error: {e}", "yellow")


def _signal_handler(signum, frame):
    """Handle SIGTERM/SIGINT gracefully."""
    sig_name = signal.Signals(signum).name
    print(f"\n[DEBUG] Signal handler called: {sig_name}", flush=True)
    print_with_color(f"\n🛑 {sig_name} received. Cleaning up browser...", "yellow")
    _cleanup_browser()
    print("[DEBUG] Signal handler: Cleanup complete, exiting...", flush=True)
    sys.exit(0)


# Register signal handlers
signal.signal(signal.SIGTERM, _signal_handler)
signal.signal(signal.SIGINT, _signal_handler)
atexit.register(_cleanup_browser)


class BrowserUseEngine(EngineInterface):
    """
    Browser-Use Engine for web automation.
    Standalone implementation - no dependency on other engines.
    """
    
    def __init__(self):
        self.status = "IDLE"
        self.browser_use_available = False
        self._check_availability()
        
    def _check_availability(self):
        """Check if browser-use library is available."""
        try:
            from .wrapper import is_browser_use_available, get_browser_use_status
            self.browser_use_available = is_browser_use_available()
            if not self.browser_use_available:
                status = get_browser_use_status()
                print_with_color(f"[Browser-Use] Not available: {status.get('error', 'Unknown')}", "yellow")
            else:
                print_with_color("[Browser-Use] Library loaded successfully", "green")
        except ImportError as e:
            print_with_color(f"[Browser-Use] Wrapper import failed: {e}", "red")
            self.browser_use_available = False
        
    def start(self) -> bool:
        print_with_color("[Browser-Use] Engine Initialized", "green")
        self.status = "READY"
        return True

    def stop(self) -> bool:
        print_with_color("[Browser-Use] Engine Stopped", "yellow")
        self.status = "STOPPED"
        return True

    def execute_task(self, task: str, params=None) -> dict:
        """
        Execute a web automation task using browser-use.
        
        Expected params:
        - url: Starting URL for the task
        - task_desc: Task description (uses 'task' if not provided)
        - task_dir: Directory to save screenshots and results
        - model_name: LLM model to use (default: gpt-4.1-mini)
        - max_rounds: Maximum steps (default: 20)
        """
        self.status = "RUNNING"
        print_with_color(f"[Browser-Use] 🌐 Starting Task: {task}", "cyan")
        
        if params:
            print_with_color(f"[Browser-Use] Params: {params}", "blue")
        
        if not self.browser_use_available:
            print_with_color("[Browser-Use] Library not available, cannot execute", "red")
            result = {
                "success": False,
                "error": "browser-use library not available",
                "task": task
            }
            print(json.dumps(result))
            self.status = "IDLE"
            return result
        
        try:
            result = self._run_browser_automation(task, params or {})
        except Exception as e:
            import traceback
            print_with_color(f"[Browser-Use] ❌ Error: {e}", "red")
            print_with_color(traceback.format_exc(), "red")
            result = {
                "success": False,
                "error": str(e),
                "task": task
            }
        
        self.status = "IDLE"
        return result

    def _run_browser_automation(self, task: str, params: dict) -> dict:
        """Run the actual browser automation using wrapper.py."""
        
        from .wrapper import run_web_task_sync
        
        # Extract parameters from params dict or environment variables
        # Priority: params > environment variables > defaults
        url = params.get('url', '')
        task_desc = params.get('task_desc', task)
        task_dir = params.get('task_dir', './output')
        
        # Model name: params > MODEL_NAME env > default
        model_name = params.get('model_name') or os.environ.get('MODEL_NAME', 'gpt-4.1-mini')
        
        # Max rounds: params > MAX_ROUNDS env > default
        max_rounds = params.get('max_rounds') or os.environ.get('MAX_ROUNDS', '20')
        if isinstance(max_rounds, str):
            max_rounds = int(max_rounds)
        
        # API credentials from environment (set by TypeScript config-env-builder)
        # TypeScript sends: API_KEY, API_BASE_URL (not OPENAI_API_KEY)
        api_key = os.environ.get('API_KEY', '') or os.environ.get('OPENAI_API_KEY', '')
        base_url = os.environ.get('API_BASE_URL', '') or os.environ.get('OPENAI_API_BASE', '')
        
        # Headless mode: params > WEB_HEADLESS env > default
        headless = params.get('headless')
        if headless is None:
            headless = os.environ.get('WEB_HEADLESS', 'false').lower() == 'true'
        elif isinstance(headless, str):
            headless = headless.lower() == 'true'
        
        # Browser type from environment
        browser_type = os.environ.get('WEB_BROWSER_TYPE', 'chromium')
        
        # User data directory for persistent login sessions (from Google Login)
        user_data_dir = os.environ.get('WEB_USER_DATA_DIR', None)
        
        # Storage state path (google-auth.json) for loading cookies/auth from Google Login
        storage_state_path = os.environ.get('WEB_STORAGE_STATE_PATH', None)
        # Only use storage_state if the file exists
        if storage_state_path and not os.path.exists(storage_state_path):
            print_with_color(f"   Storage state file not found: {storage_state_path}", "yellow")
            storage_state_path = None
        
        print_with_color(f"[Browser-Use] Configuration:", "white")
        print_with_color(f"   URL: {url}", "white")
        print_with_color(f"   Model: {model_name}", "white")
        print_with_color(f"   Max Rounds: {max_rounds}", "white")
        print_with_color(f"   Headless: {headless}", "white")
        print_with_color(f"   Browser: {browser_type}", "white")
        print_with_color(f"   User Data Dir: {user_data_dir or 'None (fresh profile)'}", "white")
        print_with_color(f"   API Key: {'✓ Set' if api_key else '✗ Not Set'}", "white")
        
        # Create report markdown file path
        task_name = os.path.basename(task_dir)
        app_name = params.get('app', 'Chrome')
        report_log_path = os.path.join(task_dir, f"log_report_{task_name}.md")
        
        # Write initial report header
        append_to_log(f"# User Testing Report for {app_name}", report_log_path)
        append_to_log(task_name, report_log_path)
        append_to_log(f"## Task Description", report_log_path)
        append_to_log(task_desc, report_log_path)
        append_to_log(f"\n## Execution Mode: Browser-Use\n", report_log_path)
        append_to_log(f"## Step History\n", report_log_path)
        
        # Progress callback for Electron
        # Field names must match task.ts parsing: round, maxRounds, totalTokens, inputTokens, outputTokens
        # ProgressTracker passes: input_tokens_this_round, output_tokens_this_round
        _cumulative_input_tokens = 0
        _cumulative_output_tokens = 0
        
        def emit_progress(round_num, max_rounds, tokens_this_round=0, 
                         input_tokens_this_round=0, output_tokens_this_round=0, **kwargs):
            nonlocal _cumulative_input_tokens, _cumulative_output_tokens
            _cumulative_input_tokens += input_tokens_this_round
            _cumulative_output_tokens += output_tokens_this_round
            
            progress_data = {
                "round": round_num,
                "maxRounds": max_rounds,
                "totalTokens": _cumulative_input_tokens + _cumulative_output_tokens,
                "inputTokens": _cumulative_input_tokens,
                "outputTokens": _cumulative_output_tokens,
                "action": "Browser automation"
            }
            print(f'PROGRESS:{json.dumps(progress_data)}')
        
        # Step callback for real-time updates and report generation
        def on_step_complete(step_info):
            step_num = step_info.get('step', 0)
            action = step_info.get('action', 'unknown')
            print_with_color(f"[Browser-Use] Step {step_num}: {action}", "white")
            
            # Write step to markdown report
            append_to_log(f"### Step {step_num}", report_log_path)
            append_to_log(f"**Action:** {action}", report_log_path)
            if step_info.get('url'):
                append_to_log(f"**URL:** {step_info['url']}", report_log_path)
            if step_info.get('title'):
                append_to_log(f"**Title:** {step_info['title']}", report_log_path)
            if step_info.get('clicked_element'):
                append_to_log(f"**Element:** {step_info['clicked_element']}", report_log_path)
            
            # Add reasoning info (Observation/Thought/Next Goal)
            if step_info.get('observation'):
                append_to_log(f"\n**Observation:** {step_info['observation']}\n", report_log_path)
                obs = step_info['observation']
                if len(obs) > 100:
                    obs = obs[:100] + "..."
                print_with_color(f"   Observation: {obs}", "white")
            if step_info.get('thought'):
                append_to_log(f"**Thought:** {step_info['thought']}\n", report_log_path)
            if step_info.get('next_goal'):
                append_to_log(f"**Next Goal:** {step_info['next_goal']}\n", report_log_path)
                goal = step_info['next_goal']
                if len(goal) > 100:
                    goal = goal[:100] + "..."
                print_with_color(f"   Next Goal: {goal}", "white")
            
            # Add screenshots as table (original + action highlighted)
            images = []
            if step_info.get('screenshot'):
                rel_path = "screenshots/" + os.path.basename(step_info['screenshot'])
                images.append(("Screenshot", rel_path))
            if step_info.get('screenshot_action'):
                rel_path = "screenshots/" + os.path.basename(step_info['screenshot_action'])
                images.append(("Action", rel_path))
            if images:
                append_images_as_table(images, report_log_path)
        
        # Determine system language from environment or default to Korean
        system_language = os.environ.get('SYSTEM_LANGUAGE', 'ko')
        
        # Run browser-use
        result = run_web_task_sync(
            task_desc=task_desc,
            url=url,
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
            max_rounds=max_rounds,
            task_dir=task_dir,
            browser_type=browser_type,
            headless=headless,
            emit_progress=emit_progress,
            save_screenshots=True,
            on_step_complete=on_step_complete,
            system_language=system_language,
            user_data_dir=user_data_dir,
            storage_state_path=storage_state_path  # Load cookies from Google Login
        )
        
        if result.get('success'):
            print_with_color(f"[Browser-Use] ✅ Task completed", "green")
            print_with_color(f"   Rounds: {result.get('rounds', 0)}", "white")
            print_with_color(f"   Tokens: {result.get('total_tokens', 0)}", "white")
            print_with_color(f"   Time: {result.get('total_response_time', 0)}s", "white")
            
            # Write execution summary to report
            append_to_log(f"\n## Execution Summary", report_log_path)
            append_to_log(f"- **Platform:** Web (Browser-Use)", report_log_path)
            append_to_log(f"- **Steps:** {result.get('rounds', 0)}", report_log_path)
            append_to_log(f"- **Total Tokens:** {result.get('total_tokens', 0)}", report_log_path)
            append_to_log(f"- **Input Tokens:** {result.get('input_tokens', 0)}", report_log_path)
            append_to_log(f"- **Output Tokens:** {result.get('output_tokens', 0)}", report_log_path)
            append_to_log(f"- **Response Time:** {result.get('total_response_time', 0)}s", report_log_path)
            append_to_log(f"- **Status:** ✅ Success", report_log_path)
        else:
            print_with_color(f"[Browser-Use] ❌ Task failed: {result.get('error', 'Unknown')}", "red")
            
            # Write failure summary to report
            append_to_log(f"\n## Execution Summary", report_log_path)
            append_to_log(f"- **Platform:** Web (Browser-Use)", report_log_path)
            append_to_log(f"- **Steps:** {result.get('rounds', 0)}", report_log_path)
            append_to_log(f"- **Status:** ❌ Failed", report_log_path)
            append_to_log(f"- **Error:** {result.get('error', 'Unknown')}", report_log_path)
        
        # Output result as JSON for Electron to parse
        print(json.dumps(result))
        
        return result

    def get_status(self) -> str:
        return self.status
