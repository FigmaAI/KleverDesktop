"""
Browser-Use wrapper for Klever Desktop

This module provides a wrapper around Browser-Use for web automation,
maintaining identical interface to existing code while leveraging
Browser-Use's improved DOM serialization and LLM-driven navigation.

Features:
- Maintains identical interface to existing code
- Uses Browser-Use for web automation
- Sends PROGRESS: messages in same format as existing code
- Supports multiple LLM providers via LangChain

Usage:
    from browser_use_wrapper import run_web_task_sync

    result = run_web_task_sync(
        task_desc="Go to Google and search for 'test'",
        url="https://google.com",
        model_name="ollama/llama3.2-vision",
        api_key="",
        base_url="http://localhost:11434",
        max_rounds=10,
        task_dir="./output"
    )
"""

import asyncio
import json
import os
import sys
import time
import base64
from pathlib import Path
from typing import Callable, Optional, Any

# Browser-Use imports
BROWSER_USE_AVAILABLE = False
BROWSER_USE_ERROR = None

try:
    from browser_use import Agent, Browser, BrowserConfig
    BROWSER_USE_AVAILABLE = True
except ImportError as e:
    BROWSER_USE_ERROR = str(e)
    print(f"[Warning] browser-use not installed: {e}")
except Exception as e:
    BROWSER_USE_ERROR = str(e)
    print(f"[Warning] browser-use import error: {e}")

# LangChain LLM imports
LANGCHAIN_OPENAI_AVAILABLE = False
LANGCHAIN_ANTHROPIC_AVAILABLE = False
LANGCHAIN_OLLAMA_AVAILABLE = False

try:
    from langchain_openai import ChatOpenAI
    LANGCHAIN_OPENAI_AVAILABLE = True
except ImportError:
    pass

try:
    from langchain_anthropic import ChatAnthropic
    LANGCHAIN_ANTHROPIC_AVAILABLE = True
except ImportError:
    pass

try:
    from langchain_ollama import ChatOllama
    LANGCHAIN_OLLAMA_AVAILABLE = True
except ImportError:
    pass


def create_llm_from_litellm_name(model_name: str, api_key: str, base_url: str):
    """
    Convert LiteLLM model name to LangChain LLM instance.

    Supported formats:
    - ollama/model → ChatOllama
    - gpt-* or openai/* → ChatOpenAI
    - claude-* or anthropic/* → ChatAnthropic
    - Other → ChatOpenAI with custom base_url (LiteLLM compatible)

    Args:
        model_name: LiteLLM format model name
        api_key: API key for the provider
        base_url: Base URL for API calls

    Returns:
        LangChain LLM instance

    Raises:
        ImportError: If required LangChain provider is not installed
    """
    # Ollama
    if model_name.startswith("ollama/"):
        if not LANGCHAIN_OLLAMA_AVAILABLE:
            raise ImportError(
                "langchain-ollama is required for Ollama models. "
                "Install with: pip install langchain-ollama"
            )
        actual_model = model_name.replace("ollama/", "")
        return ChatOllama(
            model=actual_model,
            base_url=base_url or "http://localhost:11434"
        )

    # OpenAI
    elif model_name.startswith("gpt-") or model_name.startswith("openai/"):
        if not LANGCHAIN_OPENAI_AVAILABLE:
            raise ImportError(
                "langchain-openai is required for OpenAI models. "
                "Install with: pip install langchain-openai"
            )
        actual_model = model_name.replace("openai/", "")
        return ChatOpenAI(
            model=actual_model,
            api_key=api_key,
            base_url=base_url if base_url else None
        )

    # Anthropic
    elif model_name.startswith("claude-") or model_name.startswith("anthropic/"):
        if not LANGCHAIN_ANTHROPIC_AVAILABLE:
            raise ImportError(
                "langchain-anthropic is required for Anthropic models. "
                "Install with: pip install langchain-anthropic"
            )
        actual_model = model_name.replace("anthropic/", "")
        return ChatAnthropic(
            model=actual_model,
            api_key=api_key
        )

    # Fallback: Use ChatOpenAI with custom base_url (LiteLLM compatible)
    else:
        if not LANGCHAIN_OPENAI_AVAILABLE:
            raise ImportError(
                "langchain-openai is required for custom providers. "
                "Install with: pip install langchain-openai"
            )
        return ChatOpenAI(
            model=model_name,
            api_key=api_key or "dummy",
            base_url=base_url
        )


class ProgressTracker:
    """Track and emit progress updates in the format expected by Electron."""

    def __init__(self, max_rounds: int, emit_callback: Optional[Callable] = None):
        self.max_rounds = max_rounds
        self.emit_callback = emit_callback
        self.total_tokens = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_response_time = 0.0
        self.current_step = 0

    def update(
        self,
        step_number: int,
        input_tokens: int = 0,
        output_tokens: int = 0,
        response_time: float = 0.0
    ):
        """Update progress and emit to callback."""
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
        """Get summary of progress tracking."""
        return {
            "total_tokens": self.total_tokens,
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "total_response_time": round(self.total_response_time, 2),
            "steps": self.current_step
        }


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
    viewport_width: int = 1280,
    viewport_height: int = 720,
    emit_progress: Optional[Callable] = None,
    save_screenshots: bool = True
) -> dict:
    """
    Execute web task using Browser-Use.

    This function replaces the legacy WebController approach with Browser-Use,
    providing improved DOM serialization and LLM-driven navigation while
    maintaining the same interface and progress reporting format.

    Args:
        task_desc: Task description for the AI agent
        url: Starting URL
        model_name: LiteLLM format model name (e.g., "ollama/llama3.2-vision")
        api_key: API key for the provider
        base_url: API base URL
        max_rounds: Maximum number of steps
        task_dir: Directory to save results and screenshots
        browser_type: Browser type ("chromium", "firefox", "webkit")
        headless: Run browser in headless mode
        viewport_width: Browser viewport width
        viewport_height: Browser viewport height
        emit_progress: Callback for progress updates (round, max_rounds, tokens, ...)
        save_screenshots: Whether to save screenshots of each step

    Returns:
        dict: {
            "success": bool,
            "rounds": int,
            "total_tokens": int,
            "input_tokens": int,
            "output_tokens": int,
            "total_response_time": float,
            "history": list,
            "error": str (if failed)
        }
    """
    if not BROWSER_USE_AVAILABLE:
        error_msg = BROWSER_USE_ERROR or "browser-use is not installed"
        return {
            "success": False,
            "error": f"browser-use is not available: {error_msg}. Install with: pip install browser-use",
            "rounds": 0,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_response_time": 0,
            "history": []
        }

    # Create task directory if needed
    task_path = Path(task_dir)
    task_path.mkdir(parents=True, exist_ok=True)
    screenshots_dir = task_path / "screenshots"
    screenshots_dir.mkdir(exist_ok=True)

    # Initialize progress tracker
    progress = ProgressTracker(max_rounds, emit_progress)

    # Create LLM
    try:
        llm = create_llm_from_litellm_name(model_name, api_key, base_url)
        print(f"[Browser-Use] LLM created: {type(llm).__name__} with model {model_name}")
    except ImportError as e:
        return {
            "success": False,
            "error": str(e),
            "rounds": 0,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_response_time": 0,
            "history": []
        }

    # Configure browser
    try:
        browser_config = BrowserConfig(
            headless=headless,
            disable_security=True
        )
        browser = Browser(config=browser_config)
        print(f"[Browser-Use] Browser configured: headless={headless}")
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to create browser: {str(e)}",
            "rounds": 0,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_response_time": 0,
            "history": []
        }

    history = []
    step_count = 0

    try:
        # Prepend URL navigation to task if URL is provided
        full_task = task_desc
        if url:
            full_task = f"First, go to {url}. Then: {task_desc}"

        print(f"[Browser-Use] Starting task: {full_task}")
        print(f"[Browser-Use] Max steps: {max_rounds}")

        # Emit initial progress
        progress.update(step_number=0, input_tokens=0, output_tokens=0, response_time=0)

        # Create and run agent
        agent = Agent(
            task=full_task,
            llm=llm,
            browser=browser,
            max_steps=max_rounds
        )

        # Run the agent
        start_time = time.time()
        result = await agent.run()
        total_time = time.time() - start_time

        # Process result - handle different return types
        if result is None:
            history = []
            step_count = 0
        elif isinstance(result, list):
            step_count = len(result)
            for i, step in enumerate(result):
                step_info = {
                    "step": i + 1,
                    "action": str(getattr(step, 'action', str(step))),
                    "result": str(getattr(step, 'result', ''))
                }
                # Try to get URL from step state
                if hasattr(step, 'state'):
                    state = step.state
                    step_info["url"] = getattr(state, 'url', '')
                    step_info["title"] = getattr(state, 'title', '')

                    # Save screenshot if available
                    if save_screenshots and hasattr(state, 'screenshot') and state.screenshot:
                        try:
                            screenshot_path = screenshots_dir / f"step_{i+1:03d}.png"
                            screenshot_data = state.screenshot
                            if isinstance(screenshot_data, str):
                                # Base64 encoded
                                screenshot_data = base64.b64decode(screenshot_data)
                            with open(screenshot_path, 'wb') as f:
                                f.write(screenshot_data)
                        except Exception as e:
                            print(f"[Browser-Use] Failed to save screenshot: {e}")

                history.append(step_info)

                # Emit progress for each step
                progress.update(
                    step_number=i + 1,
                    input_tokens=100,  # Estimated
                    output_tokens=50,  # Estimated
                    response_time=total_time / max(step_count, 1)
                )
        elif hasattr(result, 'history'):
            # Result object with history attribute
            step_count = len(result.history) if result.history else 0
            for i, step in enumerate(result.history or []):
                step_info = {
                    "step": i + 1,
                    "action": str(getattr(step, 'action', 'unknown')),
                    "result": str(getattr(step, 'result', ''))
                }
                if hasattr(step, 'state'):
                    state = step.state
                    step_info["url"] = getattr(state, 'url', '')
                    step_info["title"] = getattr(state, 'title', '')
                history.append(step_info)

                progress.update(
                    step_number=i + 1,
                    input_tokens=100,
                    output_tokens=50,
                    response_time=total_time / max(step_count, 1)
                )
        else:
            # Single result or unknown type
            step_count = 1
            history.append({
                "step": 1,
                "action": str(result),
                "result": "completed"
            })
            progress.update(step_number=1, input_tokens=100, output_tokens=50, response_time=total_time)

        summary = progress.get_summary()
        print(f"[Browser-Use] Task completed in {step_count} steps, {total_time:.2f}s")

        return {
            "success": True,
            "rounds": step_count,
            "total_tokens": summary["total_tokens"],
            "input_tokens": summary["input_tokens"],
            "output_tokens": summary["output_tokens"],
            "total_response_time": summary["total_response_time"],
            "history": history
        }

    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"[Browser-Use] Error: {error_msg}")
        print(traceback.format_exc())

        summary = progress.get_summary()

        return {
            "success": False,
            "error": error_msg,
            "rounds": summary["steps"],
            "total_tokens": summary["total_tokens"],
            "input_tokens": summary["input_tokens"],
            "output_tokens": summary["output_tokens"],
            "total_response_time": summary["total_response_time"],
            "history": history
        }

    finally:
        # Clean up browser
        try:
            await browser.close()
            print("[Browser-Use] Browser closed")
        except Exception as e:
            print(f"[Browser-Use] Error closing browser: {e}")


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
    viewport_width: int = 1280,
    viewport_height: int = 720,
    emit_progress: Optional[Callable] = None,
    save_screenshots: bool = True
) -> dict:
    """
    Synchronous wrapper for run_web_task_with_browser_use.

    This is the main entry point for self_explorer.py to call.

    Args:
        task_desc: Task description for the AI agent
        url: Starting URL
        model_name: LiteLLM format model name
        api_key: API key for the provider
        base_url: API base URL
        max_rounds: Maximum number of steps
        task_dir: Directory to save results
        browser_type: Browser type
        headless: Run in headless mode
        viewport_width: Browser viewport width
        viewport_height: Browser viewport height
        emit_progress: Callback for progress updates
        save_screenshots: Whether to save screenshots

    Returns:
        dict: Result dictionary with success status and execution details
    """
    print(f"[Browser-Use] run_web_task_sync called")
    print(f"[Browser-Use] Task: {task_desc}")
    print(f"[Browser-Use] URL: {url}")
    print(f"[Browser-Use] Model: {model_name}")
    print(f"[Browser-Use] Available: {BROWSER_USE_AVAILABLE}")

    if not BROWSER_USE_AVAILABLE:
        error_msg = BROWSER_USE_ERROR or "browser-use not installed"
        print(f"[Browser-Use] Not available: {error_msg}")
        return {
            "success": False,
            "error": f"Browser-Use not available: {error_msg}",
            "rounds": 0,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_response_time": 0,
            "history": []
        }

    try:
        return asyncio.run(
            run_web_task_with_browser_use(
                task_desc=task_desc,
                url=url,
                model_name=model_name,
                api_key=api_key,
                base_url=base_url,
                max_rounds=max_rounds,
                task_dir=task_dir,
                browser_type=browser_type,
                headless=headless,
                viewport_width=viewport_width,
                viewport_height=viewport_height,
                emit_progress=emit_progress,
                save_screenshots=save_screenshots
            )
        )
    except Exception as e:
        import traceback
        print(f"[Browser-Use] Sync wrapper error: {e}")
        print(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "rounds": 0,
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_response_time": 0,
            "history": []
        }


def is_browser_use_available() -> bool:
    """Check if Browser-Use and required dependencies are available."""
    return BROWSER_USE_AVAILABLE


def get_available_llm_providers() -> list:
    """Get list of available LLM providers based on installed packages."""
    providers = []
    if LANGCHAIN_OLLAMA_AVAILABLE:
        providers.append("ollama")
    if LANGCHAIN_OPENAI_AVAILABLE:
        providers.append("openai")
    if LANGCHAIN_ANTHROPIC_AVAILABLE:
        providers.append("anthropic")
    return providers


def get_browser_use_status() -> dict:
    """Get detailed status of Browser-Use availability."""
    return {
        "available": BROWSER_USE_AVAILABLE,
        "error": BROWSER_USE_ERROR,
        "llm_providers": get_available_llm_providers()
    }


if __name__ == "__main__":
    # Simple test
    print("=" * 60)
    print("Browser-Use Wrapper Status")
    print("=" * 60)

    status = get_browser_use_status()
    print(f"Browser-Use available: {status['available']}")
    if status['error']:
        print(f"Error: {status['error']}")
    print(f"Available LLM providers: {status['llm_providers']}")

    if is_browser_use_available():
        print("\n" + "=" * 60)
        print("Running simple test...")
        print("=" * 60)

        def test_progress(round_num, max_rounds, **kwargs):
            print(f"PROGRESS: Step {round_num}/{max_rounds}")

        result = run_web_task_sync(
            task_desc="Find the main heading on the page",
            url="https://example.com",
            model_name="ollama/llama3.2-vision",
            api_key="",
            base_url="http://localhost:11434",
            max_rounds=5,
            task_dir="/tmp/browser-use-test",
            headless=True,
            emit_progress=test_progress
        )

        print(f"\nResult: {json.dumps(result, indent=2)}")
    else:
        print("\nBrowser-Use is not available. Install with:")
        print("  pip install browser-use langchain-ollama langchain-openai")
