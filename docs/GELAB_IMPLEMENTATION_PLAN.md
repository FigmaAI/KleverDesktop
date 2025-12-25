# GELab Engine Implementation Plan
**Date:** 2025-12-25  
**Status:** Planning Phase

## 🎯 Objective
Implement **gelab-zero** - a new, clean Android automation engine that:
- Leverages `core/` modules for shared functionality (device control, LLM, utilities)
- Focuses purely on **automation logic**
- Does NOT copy appagent_legacy structure

---

## 🏗️ Architecture

### Core Layer (Already Implemented)
```
core/
├── android.py          # Device control, ADB, emulator, APK install (35KB)
├── llm_adapter.py      # LLM interface via LiteLLM (15KB)
├── utils.py            # print_with_color, append_to_log, draw_bbox_multi
├── config.py           # Configuration loading
└── engine_interface.py # EngineInterface base class
```

### GELab Engine (New - Minimalist)
```
engines/gelab/
├── main.py             # GELabEngine(EngineInterface) - entry point
└── (automation logic inside main.py or separate agent.py if needed)
```

> **Key Principle:** gelab imports from `core/`, focusing ONLY on automation orchestration.
> No duplicate utilities, no copied files from appagent_legacy.

---

## 🔄 Responsibility Division

### GELab Engine (Already Has)
| Component | File | Description |
|-----------|------|-------------|
| LLM Integration | `tools/ask_llm_v2.py` | LiteLLM already integrated! |
| Action Types | `copilot_tools/action_tools.py` | CLICK, TYPE, SLIDE, HOT_KEY, etc. |
| Response Parser | `copilot_tools/parser_0920_summary.py` | Parse LLM response to actions |
| Automation Server | `copilot_agent_server/local_server.py` | Session management, automate_step() |
| Image Tools | `tools/image_tools.py` | Screenshot processing |
| Prompts | `tools/prompt_tools.py` | Prompt construction |

### Core Layer (Shared Utilities)
| Component | File | Description |
|-----------|------|-------------|
| Report Generation | `core/utils.py` | `append_to_log()`, `append_images_as_table()` |
| Colored Logging | `core/utils.py` | `print_with_color()` |
| Config Loading | `core/config.py` | Environment variable handling |
| Android ADB (optional) | `core/android.py` | Can be used if needed, but gelab may have its own |

> **Key Insight:** GELab-zero already has a complete toolchain!
> The main task is to **wire up main.py** to use existing gelab tools + core utilities for Electron integration.



### 1. Electron → Python (Environment Variables from task.ts)
Set by `config-env-builder.ts`:
- `MODEL_NAME` - LLM model (e.g., "gpt-4o", "claude-3-5-sonnet")
- `API_KEY` - API key
- `API_BASE_URL` - Base URL for API
- `MAX_ROUNDS` - Maximum steps (passed as max_rounds parameter)
- `ANDROID_SDK_PATH` - Android SDK path
- `SYSTEM_LANGUAGE` - Output language (ko, en, ja, etc.)

### 2. Python → Electron (stdout PROGRESS JSON)
Format matching task.ts parsing (line 313):
```python
print(f'PROGRESS:{json.dumps({
    "round": round_num,           # Current step
    "maxRounds": max_rounds,      # Total steps
    "totalTokens": cumulative,    # Total tokens used
    "inputTokens": input_total,   # Input tokens
    "outputTokens": output_total  # Output tokens
})}')
```

### 3. Markdown Report Generation
File: `{task_dir}/log_report_{task_name}.md`
```markdown
# User Testing Report for {app_name}
{task_name}

## Task Description
{task_desc}

## Execution Mode: GELab (Android)

## Step History

### Step 1
**Action:** tap
**Element:** Button "Login"

**Observation:** Login button is visible at bottom of screen
**Thought:** Need to click login to proceed
**Next Goal:** Enter credentials

| Before | After |
|--------|-------|
| ![](screenshots/1_before.png) | ![](screenshots/1_after.png) |

## Execution Summary
- **Platform:** Android (GELab)
- **Steps:** 5
- **Total Tokens:** 12500
- **Status:** ✅ Success
```

---

## 🔧 Implementation Details

### 1. main.py - Engine Entry Point

```python
class GELabEngine(EngineInterface):
    def execute_task(self, task: str, params=None) -> dict:
        # 1. Initialize device (start emulator if needed)
        # 2. Setup task directory and report
        # 3. Run automation loop
        # 4. Return result with metrics
```

Key responsibilities:
- Parse params (task_dir, device, apk_source)
- Initialize `core.android` device control
- Call `wrapper.run_android_task_sync()`
- Handle cleanup on SIGTERM

### 2. wrapper.py - Android Automation Core

```python
async def run_android_task_with_gelab(
    task_desc: str,
    device_serial: str,
    model_name: str,
    api_key: str,
    max_rounds: int,
    task_dir: str,
    emit_progress: Callable,
    on_step_complete: Callable,
    system_language: str = "en"
) -> dict:
    """
    Main Android automation loop.
    Equivalent to self_explorer.py while loop (line 497-998).
    """
```

#### Automation Loop Steps:
1. **Capture State**
   - `controller.get_screenshot()` → PNG file
   - `controller.get_xml()` → UI hierarchy XML

2. **Parse Elements**
   - `traverse_tree()` → Extract clickable/focusable elements
   - `draw_bbox_multi()` → Create labeled screenshot

3. **LLM Decision**
   - Send labeled screenshot + prompt to LLM
   - Parse response (action, element, reasoning)

4. **Execute Action**
   - `controller.tap()`, `controller.text()`, `controller.long_press()`, etc.
   - Capture after-state screenshot

5. **Update Progress**
   - Call `emit_progress()` with token counts
   - Call `on_step_complete()` for report update

6. **Check Completion**
   - If `FINISH` action → end loop
   - If max_rounds reached → end loop

### 3. Progress Tracking

```python
class ProgressTracker:
    def __init__(self, max_rounds: int, emit_callback: Callable):
        self.max_rounds = max_rounds
        self.emit_callback = emit_callback
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.current_step = 0
    
    def update(self, step: int, input_tokens: int, output_tokens: int):
        self.current_step = step
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        
        if self.emit_callback:
            self.emit_callback(
                round_num=step,
                max_rounds=self.max_rounds,
                tokens_this_round=input_tokens + output_tokens,
                input_tokens_this_round=input_tokens,
                output_tokens_this_round=output_tokens
            )
```

### 4. Report Generation

Reuse existing `core.utils` functions:
- `append_to_log(text, filepath)` - Append markdown text
- `append_images_as_table(images, filepath)` - Add image table

```python
def on_step_complete(step_info: dict):
    """Called after each step for real-time report update."""
    append_to_log(f"### Step {step_info['step']}", report_path)
    append_to_log(f"**Action:** {step_info['action']}", report_path)
    
    if step_info.get('observation'):
        append_to_log(f"\n**Observation:** {step_info['observation']}", report_path)
    if step_info.get('thought'):
        append_to_log(f"**Thought:** {step_info['thought']}", report_path)
    if step_info.get('next_goal'):
        append_to_log(f"**Next Goal:** {step_info['next_goal']}", report_path)
    
    # Add screenshots
    images = [
        ("Before", step_info.get('screenshot_before')),
        ("After", step_info.get('screenshot_after'))
    ]
    append_images_as_table(images, report_path)
```

---

## 📁 Implementation Scope

### GELab Engine (Single File Focus)
| File | Action |
|------|--------|
| `engines/gelab/main.py` | **Replace stub** with real automation using core imports |

### Core Modules (Already Done)
| Module | Status |
|--------|--------|
| `core/android.py` | ✅ Complete - device control, screenshots, XML, actions |
| `core/llm_adapter.py` | ✅ Complete - LiteLLM integration |
| `core/utils.py` | ✅ Complete - logging, report, bbox drawing |

---

## 🔄 Implementation Strategy

### Phase 1: Replace Stub in main.py
Replace `execute_task()` stub with:
```python
def execute_task(self, task: str, params=None) -> dict:
    from core.android import (
        list_all_devices, start_emulator, execute_adb,
        get_screenshot, get_xml
    )
    from core.llm_adapter import LLMAdapter
    from core.utils import (
        append_to_log, append_images_as_table, 
        draw_bbox_multi, print_with_color
    )
    
    # 1. Device setup
    # 2. Automation loop (screenshot → parse → LLM → action)
    # 3. Progress/report updates
    # 4. Return metrics
```

### Phase 2: Verify Integration
1. Android task runs via gelab engine
2. PROGRESS JSON in console
3. Markdown report generated
4. TaskContentArea shows live progress

### Phase 3: Deprecate Legacy
1. Mark appagent_legacy as archive
2. Update migration_status.md

---

## ✅ Success Criteria

| Feature | Requirement |
|---------|-------------|
| Device Control | Connect to device/emulator via ADB |
| UI Parsing | Extract clickable elements from XML |
| Screenshot | Capture and label screenshots |
| LLM Integration | Use LiteLLM with any provider |
| Action Execution | tap, text, swipe, long_press, back, home |
| Progress Tracking | Real-time round/token updates in UI |
| Cost Calculation | Estimated cost via task.ts calculateEstimatedCost |
| Report Generation | Markdown with screenshots and reasoning |
| Signal Handling | Clean shutdown on SIGTERM |

---

## 📝 Notes

### Differences from Browser-Use
| Aspect | Browser-Use | GELab |
|--------|-------------|-------|
| Platform | Web (Playwright) | Android (ADB) |
| Element Detection | DOM inspection | XML hierarchy |
| Screenshot | Playwright capture | ADB screencap |
| Actions | Click, Type, Navigate | Tap, Text, Swipe, Back |
| Library | browser-use package | Custom implementation |

### Shared Components
- `core/utils.py` - Logging, image utilities
- `core/android.py` - Device management
- `core/llm_adapter.py` - LLM interface
- Progress JSON format
- Report markdown format
