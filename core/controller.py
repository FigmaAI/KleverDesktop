import sys
import os
import argparse
import json
import traceback

# Add project root to sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from core.utils import print_with_color

def load_engine(engine_name):
    """Dynamically load the requested engine"""
    try:
        if engine_name == 'appagent':
            from engines.appagent.wrapper import LegacyEngineWrapper
            return LegacyEngineWrapper()
        elif engine_name == 'gelab':
            from engines.gelab.main import GELabEngine
            return GELabEngine()
        elif engine_name == 'browser_use':
            # Independent web automation engine
            from engines.browser_use.main import BrowserUseEngine
            return BrowserUseEngine()
        else:
            print_with_color(f"[CONTROLLER] Unknown engine: {engine_name}", "red")
            print_with_color("[CONTROLLER] Available engines: appagent, gelab, browser_use", "yellow")
            return None
    except ImportError as e:
        print_with_color(f"[CONTROLLER] Failed to load engine '{engine_name}'. Module not found.", "red")
        print_with_color(f"Debug: {traceback.format_exc()}", "yellow")
        return None
    except Exception as e:
        print_with_color(f"[CONTROLLER] Error initializing engine '{engine_name}': {e}", "red")
        print_with_color(f"Debug: {traceback.format_exc()}", "yellow")
        return None

def main():
    parser = argparse.ArgumentParser(description="Klever Desktop Engine Controller")
    parser.add_argument("--engine", default="appagent", help="Target engine (appagent, gelab, browser_use)")
    parser.add_argument("--action", required=True, choices=['start', 'stop', 'execute', 'status'])
    parser.add_argument("--task", help="Task description or ID")
    parser.add_argument("--params", help="JSON string of additional parameters")
    
    args = parser.parse_args()
    
    print_with_color(f"[CONTROLLER] Starting... Engine: {args.engine}, Action: {args.action}", "cyan")
    
    engine = load_engine(args.engine)
    if not engine:
        sys.exit(1)
        
    try:
        if args.action == "start":
            success = engine.start()
            sys.exit(0 if success else 1)
            
        elif args.action == "stop":
            success = engine.stop()
            sys.exit(0 if success else 1)
            
        elif args.action == "execute":
            if not args.task:
                print_with_color("[CONTROLLER] Error: Task is required for execute action", "red")
                sys.exit(1)
                
            params = {}
            if args.params:
                try:
                    params = json.loads(args.params)
                except json.JSONDecodeError:
                    print_with_color("[CONTROLLER] Warning: Invalid JSON in params", "yellow")
            
            result = engine.execute_task(args.task, params)
            print(json.dumps(result)) # Output result as JSON for Electron to parse
            sys.exit(0)
            
        elif args.action == "status":
            status = engine.get_status()
            print(status)
            sys.exit(0)
            
    except Exception as e:
        print_with_color(f"[CONTROLLER] Critical Execution Error: {e}", "red")
        print_with_color(traceback.format_exc(), "red")
        sys.exit(1)

if __name__ == "__main__":
    main()
