"""
Browser-Use wrapper for Klever Desktop.
Uses LiteLLM directly (no LangChain) implementing Browser-Use's BaseChatModel Protocol.
"""
from __future__ import annotations

import asyncio
import os
import time
import base64
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Optional, Any, TypeVar, overload

from pydantic import BaseModel
from core.utils import print_with_color

BROWSER_USE_AVAILABLE = False
BROWSER_USE_ERROR = None
LITELLM_AVAILABLE = False

# Global browser reference for cleanup on signal
_current_browser = None

# Cache Playwright Chromium path at module load time (before asyncio loop)
# This avoids the "Sync API inside asyncio loop" error
_PLAYWRIGHT_CHROMIUM_PATH = None

def _get_playwright_chromium_path():
    """Get Playwright Chromium executable path. Called once at module load."""
    global _PLAYWRIGHT_CHROMIUM_PATH
    if _PLAYWRIGHT_CHROMIUM_PATH is not None:
        return _PLAYWRIGHT_CHROMIUM_PATH
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            _PLAYWRIGHT_CHROMIUM_PATH = p.chromium.executable_path
            print(f"[wrapper.py] Cached Playwright Chromium path: {_PLAYWRIGHT_CHROMIUM_PATH}")
    except Exception as e:
        print(f"[wrapper.py] Warning: Could not get Playwright Chromium path: {e}")
        _PLAYWRIGHT_CHROMIUM_PATH = None
    return _PLAYWRIGHT_CHROMIUM_PATH

# Cache the path immediately at module load
_get_playwright_chromium_path()

# Fallback stub classes when browser_use is not available
Agent = None
Browser = None

class _ChatInvokeUsageStub:
    """Fallback stub for ChatInvokeUsage"""
    def __init__(self, prompt_tokens=0, completion_tokens=0, total_tokens=0,
                 prompt_tokens_details=None, completion_tokens_details=None):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens
        self.prompt_tokens_details = prompt_tokens_details
        self.completion_tokens_details = completion_tokens_details

class _ChatInvokeCompletionStub:
    """Fallback stub for ChatInvokeCompletion"""
    def __init__(self, completion, usage=None):
        self.completion = completion
        self.usage = usage

class _BaseMessageStub:
    """Fallback stub for BaseMessage"""
    pass

# Initialize with stubs (will be replaced if browser_use is available)
ChatInvokeCompletion = _ChatInvokeCompletionStub
ChatInvokeUsage = _ChatInvokeUsageStub
BaseMessage = _BaseMessageStub
SystemMessage = _BaseMessageStub
UserMessage = _BaseMessageStub
AssistantMessage = _BaseMessageStub
ContentPartTextParam = dict
ContentPartImageParam = dict

try:
    from browser_use import Agent, Browser
    from browser_use.llm.views import ChatInvokeCompletion, ChatInvokeUsage
    from browser_use.llm.messages import (
        BaseMessage, SystemMessage, UserMessage, AssistantMessage,
        ContentPartTextParam, ContentPartImageParam
    )
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    BROWSER_USE_ERROR = str(e)
except Exception as e:
    BROWSER_USE_ERROR = str(e)

try:
    import litellm
    LITELLM_AVAILABLE = True
except ImportError:
    pass


T = TypeVar('T', bound=BaseModel)


@dataclass
class ChatLiteLLM:
    """
    LiteLLM implementation of Browser-Use's BaseChatModel Protocol.
    No LangChain required - uses LiteLLM directly.
    """
    model: str
    api_key: str | None = None
    api_base: str | None = None
    temperature: float = 0.0
    _verified_api_keys: bool = field(default=False, repr=False)
    
    @property
    def provider(self) -> str:
        if "/" in self.model:
            return self.model.split("/")[0]
        elif self.model.startswith("gpt-") or self.model.startswith("o1"):
            return "openai"
        elif self.model.startswith("claude-"):
            return "anthropic"
        return "litellm"
    
    @property
    def name(self) -> str:
        return self.model
    
    @property
    def model_name(self) -> str:
        return self.model
    
    def _convert_messages(self, messages: list) -> list[dict]:
        """Convert Browser-Use messages to LiteLLM format."""
        converted = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                converted.append({"role": "system", "content": msg.content})
            elif isinstance(msg, UserMessage):
                if isinstance(msg.content, list):
                    content_parts = []
                    for part in msg.content:
                        if isinstance(part, ContentPartTextParam):
                            content_parts.append({"type": "text", "text": part.text})
                        elif isinstance(part, ContentPartImageParam):
                            content_parts.append({
                                "type": "image_url",
                                "image_url": {"url": part.image_url.url}
                            })
                    converted.append({"role": "user", "content": content_parts})
                else:
                    converted.append({"role": "user", "content": str(msg.content)})
            elif isinstance(msg, AssistantMessage):
                converted.append({"role": "assistant", "content": str(msg.content)})
            elif hasattr(msg, 'role') and hasattr(msg, 'content'):
                converted.append({"role": msg.role, "content": str(msg.content)})
        return converted
    
    def _fix_response_schema(self, content: str) -> str:
        """
        Fix common schema mismatches from smaller models.
        
        Some models (like gpt-4.1-mini) don't follow Browser-Use's schema precisely.
        This method transforms known field name mistakes to the correct format.
        
        Common fixes:
        - 'element' -> 'index' (for click, input actions)
        - 'extract.selector' -> 'extract.query' (for extract action)
        - Empty action[] -> inject fallback 'done' or 'wait' action
        - Remove extra unsupported fields
        """
        import json
        
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return content
        
        def fix_action(action: dict) -> dict:
            """Fix a single action's schema."""
            for key, value in list(action.items()):
                if isinstance(value, dict):
                    # Fix 'element' -> 'index' in action parameters
                    if 'element' in value and 'index' not in value:
                        value['index'] = value.pop('element')
                    
                    # Fix 'extract' action schema
                    # Model outputs: {'selector': '...', 'type': '...', 'limit': N}
                    # Expected: {'query': '...'}
                    if key == 'extract':
                        if 'selector' in value and 'query' not in value:
                            # Convert selector to query
                            selector = value.pop('selector')
                            value['query'] = f"Extract content from: {selector}"
                        # Remove unsupported fields
                        for unsupported in ['type', 'limit', 'format']:
                            value.pop(unsupported, None)
                    
                    # Recursively fix nested dicts
                    action[key] = fix_action(value)
            return action
        
        def fix_actions(obj) -> any:
            """Recursively fix actions in the response."""
            if isinstance(obj, dict):
                # Fix the current dict
                obj = fix_action(obj)
                # Process all nested values
                for key, value in obj.items():
                    obj[key] = fix_actions(value)
            elif isinstance(obj, list):
                return [fix_actions(item) for item in obj]
            return obj
        
        def should_finish(data: dict) -> bool:
            """Check if the model's response indicates task completion intent."""
            # Keywords indicating the model wants to finish (multi-language)
            finish_keywords = [
                # English
                'complete', 'done', 'finish', 'success', 'summarize', 'provide',
                'task is complete', 'task completed', 'successfully',
                # Korean
                '완료', '성공', '제공', '요약', '마무리', '끝', '달성',
                # Japanese
                '完了', '成功', '提供', '要約',
                # Chinese
                '完成', '成功', '提供', '总结',
            ]
            
            # Check memory, next_goal, and evaluation fields
            memory = str(data.get('memory', '')).lower()
            next_goal = str(data.get('next_goal', '')).lower()
            evaluation = str(data.get('evaluation_previous_goal', '')).lower()
            
            combined_text = f"{memory} {next_goal} {evaluation}"
            return any(keyword.lower() in combined_text for keyword in finish_keywords)
        
        def create_fallback_action(data: dict) -> list:
            """Create a fallback action based on context."""
            if should_finish(data):
                # Model wants to finish - create done action
                memory = data.get('memory', 'Task processing completed.')
                return [{"done": {"text": str(memory), "success": True}}]
            else:
                # Model is confused - create wait action to continue
                return [{"wait": {"seconds": 2}}]
        
        fixed_data = fix_actions(data)
        
        # Handle empty or missing action field
        if isinstance(fixed_data, dict):
            action = fixed_data.get('action', [])
            
            # Check if action is empty, None, or contains only empty/invalid items
            is_empty_action = (
                action is None or
                action == [] or
                (isinstance(action, list) and all(
                    item is None or item == {} or 
                    (isinstance(item, dict) and not any(item.values()))
                    for item in action
                ))
            )
            
            if is_empty_action:
                # Inject fallback action
                fixed_data['action'] = create_fallback_action(fixed_data)
        
        return json.dumps(fixed_data)
    
    @overload
    async def ainvoke(
        self, messages: list[BaseMessage], output_format: None = None, **kwargs: Any
    ) -> ChatInvokeCompletion[str]: ...
    
    @overload
    async def ainvoke(
        self, messages: list[BaseMessage], output_format: type[T], **kwargs: Any
    ) -> ChatInvokeCompletion[T]: ...
    
    async def ainvoke(
        self, messages: list[BaseMessage], output_format: type[T] | None = None, **kwargs: Any
    ) -> ChatInvokeCompletion[T] | ChatInvokeCompletion[str]:
        """Invoke LiteLLM with Browser-Use message format."""
        converted_messages = self._convert_messages(messages)
        
        llm_kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": converted_messages,
            "temperature": self.temperature,
        }
        
        if self.api_key:
            llm_kwargs["api_key"] = self.api_key
        if self.api_base:
            llm_kwargs["base_url"] = self.api_base
        
        # Handle structured output - use simple json_object mode
        # Avoid strict schema validation which has compatibility issues
        if output_format is not None:
            llm_kwargs["response_format"] = {"type": "json_object"}
        
        try:
            response = await litellm.acompletion(**llm_kwargs)
            content = response.choices[0].message.content
            
            # Parse structured output if requested
            if output_format is not None and content:
                try:
                    # First try direct parsing
                    completion = output_format.model_validate_json(content)
                except Exception as parse_error:
                    # Try fixing common schema mismatches from smaller models
                    try:
                        fixed_content = self._fix_response_schema(content)
                        completion = output_format.model_validate_json(fixed_content)
                    except Exception:
                        # Log parsing error and raise to trigger retry
                        raise ValueError(f"Failed to parse response as {output_format.__name__}: {parse_error}")
            else:
                completion = content or ""
            
            # Build usage info
            usage = None
            if response.usage:
                usage = ChatInvokeUsage(
                    prompt_tokens=response.usage.prompt_tokens or 0,
                    completion_tokens=response.usage.completion_tokens or 0,
                    total_tokens=response.usage.total_tokens or 0,
                    prompt_cached_tokens=None,
                    prompt_cache_creation_tokens=None,
                    prompt_image_tokens=None,
                )
            
            return ChatInvokeCompletion(
                completion=completion,
                usage=usage,
                stop_reason=response.choices[0].finish_reason
            )
            
        except Exception as e:
            raise RuntimeError(f"LiteLLM call failed: {str(e)}")


def create_llm(model_name: str, api_key: str = "", base_url: str = ""):
    """Create LiteLLM instance implementing Browser-Use Protocol."""
    if not LITELLM_AVAILABLE:
        raise ImportError("litellm required. Install: pip install litellm")
    
    return ChatLiteLLM(
        model=model_name,
        api_key=api_key or None,
        api_base=base_url or None
    )


class ProgressTracker:
    """Track and emit progress updates."""

    def __init__(self, max_rounds: int, emit_callback: Optional[Callable] = None):
        self.max_rounds = max_rounds
        self.emit_callback = emit_callback
        self.total_tokens = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_response_time = 0.0
        self.current_step = 0

    def update(self, step_number: int, input_tokens: int = 0, output_tokens: int = 0, response_time: float = 0.0):
        self.current_step = step_number
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_tokens = self.total_input_tokens + self.total_output_tokens
        self.total_response_time += response_time

        if self.emit_callback:
            self.emit_callback(
                round_num=step_number,
                max_rounds=self.max_rounds,
                tokens_this_round=input_tokens + output_tokens,
                response_time_this_round=response_time,
                input_tokens_this_round=input_tokens,
                output_tokens_this_round=output_tokens
            )

    def get_summary(self) -> dict:
        return {
            "total_tokens": self.total_tokens,
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "total_response_time": round(self.total_response_time, 2),
            "steps": self.current_step
        }


def _process_step(step, step_num: int, screenshots_dir: Path, save_screenshots: bool) -> dict:
    """Process a single step and extract info for reporting."""
    # Extract action from model_output
    action_str = "unknown"
    if hasattr(step, 'model_output') and step.model_output:
        if hasattr(step.model_output, 'action') and step.model_output.action:
            actions = step.model_output.action
            action_names = []
            for act in actions:
                try:
                    act_dict = act.model_dump()
                    for key, value in act_dict.items():
                        if value is not None:
                            action_names.append(key)
                            break
                except Exception:
                    action_names.append(type(act).__name__)
            action_str = ", ".join(action_names) if action_names else "unknown"
    
    # If no model_output, check result for error info
    if action_str == "unknown" and hasattr(step, 'result') and step.result:
        for result in step.result:
            if hasattr(result, 'error') and result.error:
                action_str = f"retry ({result.error[:50]}...)" if len(result.error) > 50 else f"retry ({result.error})"
                break
    
    step_info = {"step": step_num, "action": action_str}
    
    # Extract reasoning info from model_output (Eval/Memory/Next Goal)
    if hasattr(step, 'model_output') and step.model_output:
        model_out = step.model_output
        # Eval = evaluation_previous_goal (Observation)
        if hasattr(model_out, 'evaluation_previous_goal') and model_out.evaluation_previous_goal:
            step_info["observation"] = model_out.evaluation_previous_goal
        # Memory = thought process
        if hasattr(model_out, 'memory') and model_out.memory:
            step_info["thought"] = model_out.memory
        # Next goal = action plan
        if hasattr(model_out, 'next_goal') and model_out.next_goal:
            step_info["next_goal"] = model_out.next_goal
    
    # Extract state info
    if hasattr(step, 'state') and step.state:
        state = step.state
        step_info["url"] = getattr(state, 'url', '')
        step_info["title"] = getattr(state, 'title', '')
        
        # Save screenshots: original and action-highlighted version
        if save_screenshots and hasattr(state, 'screenshot_path') and state.screenshot_path:
            try:
                from PIL import Image, ImageDraw
                import shutil
                src_path = Path(state.screenshot_path)
                if src_path.exists():
                    # Save original screenshot
                    original_path = screenshots_dir / f"step_{step_num:03d}.png"
                    shutil.copy(src_path, original_path)
                    step_info["screenshot"] = str(original_path)
                    
                    # Check if there's an interacted element to highlight
                    interacted = getattr(state, 'interacted_element', None)
                    if interacted and len(interacted) > 0 and interacted[0] is not None:
                        elem = interacted[0]
                        bounds = getattr(elem, 'bounds', None)
                        if bounds:
                            # Save action-highlighted screenshot
                            action_path = screenshots_dir / f"step_{step_num:03d}_action.png"
                            img = Image.open(src_path)
                            draw = ImageDraw.Draw(img)
                            
                            # Get bounds in CSS pixels
                            x, y, w, h = bounds.x, bounds.y, bounds.width, bounds.height
                            
                            # Calculate device pixel ratio from image size
                            # Browser-Use default viewport is 1728x1117
                            img_w, img_h = img.size
                            viewport_width = 1728  # Browser-Use default
                            scale = img_w / viewport_width
                            
                            # Scale bounds to match screenshot resolution
                            x, y, w, h = x * scale, y * scale, w * scale, h * scale
                            
                            # Draw red rectangle (3px thick, scaled)
                            line_width = max(3, int(3 * scale))
                            for offset in range(line_width):
                                draw.rectangle(
                                    [x - offset, y - offset, x + w + offset, y + h + offset],
                                    outline='red'
                                )
                            img.save(action_path)
                            step_info["screenshot_action"] = str(action_path)
                            step_info["clicked_element"] = getattr(elem, 'node_name', '')
            except Exception:
                pass
    
    return step_info


# Import language instruction from prompts.py for reuse
try:
    from prompts import get_language_instruction
except ImportError:
    # Fallback if prompts.py is not available
    def get_language_instruction(language_code: str) -> str:
        if language_code == "en":
            return ""
        return f"IMPORTANT: You must respond in {language_code}."


async def run_web_task_with_browser_use(
    task_desc: str,
    url: str,
    model_name: str,
    api_key: str,
    base_url: str,
    max_rounds: int,
    task_dir: str,
    browser_type: str = "chromium",
    headless: bool = False,
    emit_progress: Optional[Callable] = None,
    save_screenshots: bool = True,
    cdp_url: Optional[str] = None,
    user_data_dir: Optional[str] = None,
    on_step_complete: Optional[Callable] = None,
    system_language: str = "en",
    storage_state_path: Optional[str] = None
) -> dict:
    """Execute web task using Browser-Use.
    
    Args:
        on_step_complete: Callback called after each step with step_info dict.
                         Signature: on_step_complete(step_info: dict) -> None
        system_language: Language code for report output (e.g., 'en', 'ko', 'ja').
                        The agent will respond in this language.
        storage_state_path: Path to storage_state.json file containing cookies/auth from Google Login.
    """
    if not BROWSER_USE_AVAILABLE:
        return {
            "success": False,
            "error": f"browser-use not available: {BROWSER_USE_ERROR}",
            "rounds": 0, "total_tokens": 0, "input_tokens": 0,
            "output_tokens": 0, "total_response_time": 0, "history": []
        }

    task_path = Path(task_dir)
    task_path.mkdir(parents=True, exist_ok=True)
    screenshots_dir = task_path / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)

    progress = ProgressTracker(max_rounds, emit_progress)
    history = []
    step_count = [0]  # Use list to allow modification in nested function

    try:
        llm = create_llm(model_name, api_key, base_url)
    except ImportError as e:
        return {
            "success": False, "error": str(e),
            "rounds": 0, "total_tokens": 0, "input_tokens": 0,
            "output_tokens": 0, "total_response_time": 0, "history": []
        }

    try:
        # Browser-Use Browser options
        # IMPORTANT: Browser-Use 0.11.2 ignores 'channel' param when is_local=True
        # We must use 'executable_path' to force use of Playwright bundled Chromium
        browser_options = {"disable_security": True}
        
        # DEBUG: Print received browser_type
        print(f"[DEBUG] wrapper.py received browser_type: '{browser_type}'")
        
        # Determine browser executable path based on browser_type
        if browser_type == "chromium" or browser_type is None or browser_type == "":
            # Use Playwright's bundled Chrome for Testing
            # Use cached path (obtained at module load time, before async loop)
            chromium_path = _PLAYWRIGHT_CHROMIUM_PATH
            if chromium_path:
                browser_options["executable_path"] = chromium_path
                print(f"[DEBUG] Using Playwright Chromium: {chromium_path}")
                print_with_color(f"   Browser: Playwright Chromium (Chrome for Testing)", "white")
            else:
                print("[DEBUG] Warning: Playwright Chromium path not cached, using channel fallback")
                browser_options["channel"] = "chromium"
        elif browser_type in ("chrome", "msedge", "chrome-beta", "msedge-beta", "msedge-dev"):
            # Use system browser via channel param
            browser_options["channel"] = browser_type
            print(f"[DEBUG] Using system browser channel: {browser_type}")
            print_with_color(f"   Browser: System {browser_type}", "white")
        else:
            # Unknown browser type, try as channel
            browser_options["channel"] = browser_type
            print(f"[DEBUG] Using unknown browser type as channel: {browser_type}")
        
        print(f"[DEBUG] Final browser_options: {browser_options}")
        
        # Storage state (cookies) takes priority over user_data_dir
        # Browser-Use warns about using both simultaneously
        if storage_state_path:
            browser_options["storage_state"] = storage_state_path
            print(f"[DEBUG] Using storage_state for auth: {storage_state_path}")
        elif user_data_dir:
            browser_options["user_data_dir"] = user_data_dir
            print(f"[DEBUG] Using user_data_dir for profile: {user_data_dir}")
        
        if cdp_url:
            browser = Browser(cdp_url=cdp_url, **browser_options)
        else:
            browser_options["headless"] = headless
            # IMPORTANT: is_local=True tells Browser-Use to launch browser locally
            browser_options["is_local"] = True
            print(f"[DEBUG] Creating local browser with options: {browser_options}")
            browser = Browser(**browser_options)
        
        # Store browser reference for cleanup on SIGTERM
        global _current_browser
        _current_browser = browser
    except Exception as e:
        return {
            "success": False, "error": f"Browser creation failed: {e}",
            "rounds": 0, "total_tokens": 0, "input_tokens": 0,
            "output_tokens": 0, "total_response_time": 0, "history": []
        }

    try:
        # Build task with URL and language instruction
        language_instruction = get_language_instruction(system_language)
        if url:
            full_task = f"First, go to {url}. Then: {task_desc}"
        else:
            full_task = task_desc
        if language_instruction:
            full_task = f"{full_task}\n\n{language_instruction}"
        
        progress.update(step_number=0, input_tokens=0, output_tokens=0, response_time=0)

        # Define step callback for real-time updates
        async def on_step_end(agent_instance):
            nonlocal history
            # Access history from agent_instance.history (AgentHistoryList)
            if hasattr(agent_instance, 'history') and agent_instance.history:
                current_history = agent_instance.history.history if hasattr(agent_instance.history, 'history') else []
                # Process only the latest step
                if len(current_history) > step_count[0]:
                    step = current_history[-1]
                    step_count[0] = len(current_history)
                    step_info = _process_step(step, step_count[0], screenshots_dir, save_screenshots)
                    history.append(step_info)
                    
                    # Try to extract token usage from step metadata
                    input_tokens_step = 0
                    output_tokens_step = 0
                    
                    # Check if step has metadata with token info
                    if hasattr(step, 'model_output') and step.model_output:
                        mo = step.model_output
                        # Some steps may have usage info in metadata
                        if hasattr(mo, 'usage') and mo.usage:
                            input_tokens_step = getattr(mo.usage, 'prompt_tokens', 0) or 0
                            output_tokens_step = getattr(mo.usage, 'completion_tokens', 0) or 0
                    
                    # Fallback: estimate based on typical usage (varies by model)
                    if input_tokens_step == 0 and output_tokens_step == 0:
                        # Vision models use more tokens due to screenshots
                        # GPT-4o: ~500-2000 input (with image), ~100-300 output per step
                        # Estimate conservatively
                        input_tokens_step = 800  # Vision prompt + screenshot
                        output_tokens_step = 150  # Action response
                    
                    # Update progress with token estimates
                    progress.update(step_number=step_count[0], input_tokens=input_tokens_step, output_tokens=output_tokens_step)
                    
                    # Call user callback for real-time report update
                    if on_step_complete:
                        on_step_complete(step_info)

        agent = Agent(task=full_task, llm=llm, browser=browser, max_steps=max_rounds, calculate_cost=True)

        start_time = time.time()
        result = await agent.run(on_step_end=on_step_end)
        total_time = time.time() - start_time

        # Update with actual token usage if available
        if result and hasattr(result, 'usage') and result.usage:
            usage = result.usage
            total_input = getattr(usage, 'total_prompt_tokens', 0) or 0
            total_output = getattr(usage, 'total_completion_tokens', 0) or 0
            # Reset and recalculate with actual tokens
            progress.total_input_tokens = total_input
            progress.total_output_tokens = total_output
            progress.total_tokens = total_input + total_output

        # If callback wasn't used, process history at the end (fallback)
        if not history and result and hasattr(result, 'history') and result.history:
            for i, step in enumerate(result.history):
                step_info = _process_step(step, i + 1, screenshots_dir, save_screenshots)
                history.append(step_info)
                
                # Call user callback for report update
                if on_step_complete:
                    on_step_complete(step_info)
            step_count[0] = len(result.history)
        
        # Handle empty result
        if not history:
            history.append({"step": 1, "action": str(result) if result else "no result", "result": "completed"})
            step_count[0] = 1

        summary = progress.get_summary()
        return {
            "success": True,
            "rounds": step_count[0],
            "total_tokens": summary["total_tokens"],
            "input_tokens": summary["input_tokens"],
            "output_tokens": summary["output_tokens"],
            "total_response_time": summary["total_response_time"],
            "history": history
        }

    except Exception as e:
        summary = progress.get_summary()
        return {
            "success": False, "error": str(e),
            "rounds": summary["steps"],
            "total_tokens": summary["total_tokens"],
            "input_tokens": summary["input_tokens"],
            "output_tokens": summary["output_tokens"],
            "total_response_time": summary["total_response_time"],
            "history": history
        }

    finally:
        # _current_browser is already declared global above
        try:
            if hasattr(browser, 'stop'):
                await browser.stop()
            elif hasattr(browser, 'close'):
                await browser.close()
        except Exception:
            pass
        finally:
            _current_browser = None


def run_web_task_sync(
    task_desc: str,
    url: str,
    model_name: str,
    api_key: str = "",
    base_url: str = "",
    max_rounds: int = 20,
    task_dir: str = "./output",
    browser_type: str = "chromium",
    headless: bool = False,
    emit_progress: Optional[Callable] = None,
    save_screenshots: bool = True,
    cdp_url: Optional[str] = None,
    user_data_dir: Optional[str] = None,
    on_step_complete: Optional[Callable] = None,
    system_language: str = "en",
    storage_state_path: Optional[str] = None
) -> dict:
    """Synchronous wrapper for run_web_task_with_browser_use.
    
    Args:
        on_step_complete: Callback called after each step with step_info dict.
                         Enables real-time report updates.
        system_language: Language code for report output (e.g., 'en', 'ko', 'ja').
        storage_state_path: Path to storage_state.json file containing cookies/auth from Google Login.
    """
    if not BROWSER_USE_AVAILABLE:
        return {
            "success": False, "error": f"Browser-Use not available: {BROWSER_USE_ERROR}",
            "rounds": 0, "total_tokens": 0, "input_tokens": 0,
            "output_tokens": 0, "total_response_time": 0, "history": []
        }

    try:
        return asyncio.run(
            run_web_task_with_browser_use(
                task_desc=task_desc, url=url, model_name=model_name,
                api_key=api_key, base_url=base_url, max_rounds=max_rounds,
                task_dir=task_dir, browser_type=browser_type, headless=headless,
                emit_progress=emit_progress, save_screenshots=save_screenshots,
                cdp_url=cdp_url, user_data_dir=user_data_dir,
                on_step_complete=on_step_complete,
                system_language=system_language,
                storage_state_path=storage_state_path
            )
        )
    except Exception as e:
        return {
            "success": False, "error": str(e),
            "rounds": 0, "total_tokens": 0, "input_tokens": 0,
            "output_tokens": 0, "total_response_time": 0, "history": []
        }


def is_browser_use_available() -> bool:
    return BROWSER_USE_AVAILABLE


def get_browser_use_status() -> dict:
    return {
        "available": BROWSER_USE_AVAILABLE,
        "error": BROWSER_USE_ERROR,
        "litellm_available": LITELLM_AVAILABLE
    }


async def _async_stop_browser():
    """Async helper to stop browser."""
    global _current_browser
    if _current_browser is not None:
        try:
            if hasattr(_current_browser, 'stop'):
                await _current_browser.stop()
            elif hasattr(_current_browser, 'close'):
                await _current_browser.close()
        except Exception:
            pass
        finally:
            _current_browser = None


def force_stop_browser():
    """Force stop the current browser. Call this on SIGTERM/SIGINT.
    
    Uses Browser-Use's built-in stop/close methods which are cross-platform.
    This is called when Electron sends SIGTERM to the Python process.
    """
    global _current_browser
    
    if _current_browser is None:
        print("[DEBUG] force_stop_browser: No browser to close")
        return True
    
    print("[DEBUG] force_stop_browser: Attempting to close browser...")
    
    try:
        # Run async cleanup in a new event loop
        # (We're in a sync context after receiving SIGTERM)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(_async_stop_browser())
        loop.close()
        print("[DEBUG] force_stop_browser: Browser closed successfully")
    except Exception as e:
        print(f"[DEBUG] force_stop_browser: Error closing browser: {e}")
    finally:
        _current_browser = None
    
    return True


if __name__ == "__main__":
    status = get_browser_use_status()
    print(f"Browser-Use: {status['available']}, LiteLLM: {status['litellm_available']}")

