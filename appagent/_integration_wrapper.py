import sys
import os

# Add scripts directory to sys.path for imports
scripts_dir = os.path.join(os.path.dirname(__file__), 'scripts')
sys.path.insert(0, scripts_dir)

# Change to scripts directory and execute self_explorer
os.chdir(scripts_dir)
with open('self_explorer.py', 'r', encoding='utf-8') as f:
    code = compile(f.read(), 'self_explorer.py', 'exec')
    exec(code, {'__name__': '__main__', '__file__': os.path.join(scripts_dir, 'self_explorer.py')})
