# Scripts

This directory contains utility scripts for the Klever Desktop project.

## appagent-sync.js

Synchronizes changes from the local `appagent/` folder to the original [AppAgent repository](https://github.com/FigmaAI/AppAgent).

### Usage

**Interactive mode** (prompts for commit message):
```bash
npm run appagent:sync
```

**With commit message as argument**:
```bash
npm run appagent:sync -- --message "fix: update llm_service.py"
# or
npm run appagent:sync -- -m "feat: add new feature"
```

### How it works

1. Checks if git is installed
2. Creates a temporary directory
3. Clones the AppAgent repository
4. Copies `appagent/` folder contents (excluding `.git`, `__pycache__`, etc.)
5. Checks for changes with `git status`
6. If changes exist:
   - Prompts for commit message (if not provided)
   - Stages all changes
   - Creates a commit
   - Pushes to `origin/main`
7. Cleans up temporary directory

### Excluded files/directories

The following patterns are excluded from sync:
- `.git`
- `__pycache__`
- `*.pyc`
- `.DS_Store`
- `.pytest_cache`
- `*.egg-info`
- `node_modules`
- `.venv`
- `venv`

### Requirements

- Git must be installed and configured with credentials
- Write access to the AppAgent repository
- Git credentials (SSH key or credential helper) must be configured

### Error handling

- If git is not installed, the script will exit with instructions
- If no changes are detected, the script will exit gracefully
- If the push fails (e.g., network error, permission denied), the script will show the error
- Temporary directory is always cleaned up, even on errors

---

## python-sync.js

Synchronizes Python dependencies by installing packages from `appagent/requirements.txt` into the virtual environment.

### Usage

```bash
npm run python:sync
```

---

## python-refresh.js

Recreates the Python virtual environment and installs all dependencies from scratch.

### Usage

```bash
npm run python:sync:all
```

---

## verify-bundle.js

Verifies that all required files are properly bundled in the production build.

### Usage

```bash
npm run python:verify
```
