from core.engine_interface import EngineInterface
from core.utils import print_with_color
import os
import sys
import subprocess
import json

class LegacyEngineWrapper(EngineInterface):
    """
    Wrapper for the legacy AppAgent scripts.
    Calls self_explorer.py via subprocess to execute tasks.
    """
    
    def __init__(self):
        self.status = "IDLE"
        self.process = None
        
    def start(self) -> bool:
        print_with_color("[AppAgent] Engine initialized", "green")
        self.status = "READY"
        return True

    def stop(self) -> bool:
        print_with_color("[AppAgent] Engine stopped", "yellow")
        if self.process and self.process.poll() is None:
            self.process.terminate()
        self.status = "IDLE"
        return True

    def execute_task(self, task: str, params=None) -> dict:
        """
        Execute a task using self_explorer.py via subprocess.

        Args:
            task: Task description
            params: Dictionary containing:
                - platform: 'android'
                - app: App name
                - task_dir: Directory for task output
                - root_dir: Root directory for apps
                - model_name: Model to use
        """
        params = params or {}
        
        print_with_color(f"[AppAgent] Starting task: {task}", "cyan")
        self.status = "RUNNING"
        
        try:
            # Get path to self_explorer.py
            current_dir = os.path.dirname(os.path.abspath(__file__))
            script_path = os.path.join(current_dir, "scripts", "self_explorer.py")
            
            if not os.path.exists(script_path):
                return {
                    "success": False,
                    "error": f"self_explorer.py not found at {script_path}"
                }
            
            # Build command arguments
            cmd = [
                sys.executable, "-u",
                script_path,
                "--app", params.get("app", "UnknownApp"),
                "--task_desc", task,
            ]
            
            # Add optional parameters
            if params.get("task_dir"):
                cmd.extend(["--task_dir", params["task_dir"]])
            if params.get("root_dir"):
                cmd.extend(["--root_dir", params["root_dir"]])
            if params.get("platform"):
                cmd.extend(["--platform", params["platform"]])
            if params.get("model_name"):
                cmd.extend(["--model_name", params["model_name"]])
            
            print_with_color(f"[AppAgent] Running: {' '.join(cmd)}", "blue")
            
            # Run subprocess with real-time output
            project_root = os.path.dirname(os.path.dirname(current_dir))
            scripts_dir = os.path.join(current_dir, "scripts")
            
            # Set PYTHONPATH to include both project root and scripts dir
            env = os.environ.copy()
            pythonpath = env.get("PYTHONPATH", "")
            env["PYTHONPATH"] = f"{project_root}:{scripts_dir}:{pythonpath}"
            
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                env=env,
                cwd=scripts_dir  # Run from scripts directory for relative imports
            )
            
            # Stream output in real-time
            output_lines = []
            for line in self.process.stdout:
                print(line, end='', flush=True)  # Forward to Electron
                output_lines.append(line)
            
            # Wait for process to complete
            self.process.wait()
            exit_code = self.process.returncode
            
            self.status = "IDLE"
            
            if exit_code == 0:
                return {
                    "success": True,
                    "message": "Task completed successfully",
                    "task": task
                }
            else:
                return {
                    "success": False,
                    "error": f"Task failed with exit code {exit_code}",
                    "output": "".join(output_lines[-20:])  # Last 20 lines
                }
                
        except Exception as e:
            self.status = "ERROR"
            return {
                "success": False,
                "error": str(e)
            }

    def get_status(self) -> str:
        return self.status
