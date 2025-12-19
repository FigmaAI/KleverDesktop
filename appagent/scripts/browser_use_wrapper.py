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
import time
from pathlib import Path
from typing import Callable, Optional, Any

# Browser-Use imports
try:
    from browser_use import Agent, Browser, BrowserConfig
    from browser_use.browser.context import BrowserContext, BrowserContextConfig
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("[Warning] browser-use not installed. Web automation will fall back to legacy mode.")

# LangChain LLM imports
try:
    from langchain_openai import ChatOpenAI
    LANGCHAIN_OPENAI_AVAILABLE = True
except ImportError:
    LANGCHAIN_OPENAI_AVAILABLE = False

try:
    from langchain_anthropic import ChatAnthropic
    LANGCHAIN_ANTHROPIC_AVAILABLE = True
except ImportError:
    LANGCHAIN_ANTHROPIC_AVAILABLE = False

try:
    from langchain_ollama import ChatOllama
    LANGCHAIN_OLLAMA_AVAILABLE = True
except ImportError:
    LANGCHAIN_OLLAMA_AVAILABLE = False


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
        return {
            "success": False,
            "error": "browser-use is not installed. Install with: pip install browser-use",
            "rounds": 0,
            "total_tokens": 0
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
    except ImportError as e:
        return {
            "success": False,
            "error": str(e),
            "rounds": 0,
            "total_tokens": 0
        }

    # Configure browser
    browser_config = BrowserConfig(
        headless=headless,
        disable_security=True  # Allow cross-origin requests for testing
    )

    browser = Browser(config=browser_config)

    # Track step timing
    step_start_time = None

    async def on_step_start(step: Any):
        """Called when a new step starts."""
        nonlocal step_start_time
        step_start_time = time.time()

    async def on_step_end(step: Any):
        """Called when a step ends."""
        nonlocal step_start_time

        step_number = getattr(step, 'step_number', progress.current_step + 1)
        response_time = time.time() - step_start_time if step_start_time else 2.0

        # Extract token usage if available
        input_tokens = 0
        output_tokens = 0

        if hasattr(step, 'model_output') and step.model_output:
            model_output = step.model_output
            if hasattr(model_output, 'usage_metadata'):
                usage = model_output.usage_metadata
                input_tokens = usage.get('input_tokens', 0)
                output_tokens = usage.get('output_tokens', 0)
            elif hasattr(model_output, 'response_metadata'):
                metadata = model_output.response_metadata
                if 'token_usage' in metadata:
                    usage = metadata['token_usage']
                    input_tokens = usage.get('prompt_tokens', 0)
                    output_tokens = usage.get('completion_tokens', 0)

        # Update progress
        progress.update(
            step_number=step_number,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            response_time=response_time
        )

        # Save screenshot if enabled
        if save_screenshots:
            try:
                screenshot_path = screenshots_dir / f"step_{step_number:03d}.png"
                if hasattr(step, 'state') and hasattr(step.state, 'screenshot'):
                    # Save from step state
                    with open(screenshot_path, 'wb') as f:
                        f.write(step.state.screenshot)
            except Exception as e:
                print(f"[Warning] Failed to save screenshot: {e}")

    # Create browser context with viewport
    context_config = BrowserContextConfig(
        browser_window_size={'width': viewport_width, 'height': viewport_height},
        save_recording_path=str(task_path / "recording") if save_screenshots else None
    )

    history = []

    try:
        async with await browser.new_context(config=context_config) as context:
            # Navigate to initial URL
            page = await context.get_current_page()
            if url:
                print(f"[Browser-Use] Navigating to {url}")
                await page.goto(url, wait_until="domcontentloaded")

            # Create agent
            agent = Agent(
                task=task_desc,
                llm=llm,
                browser_context=context,
                max_steps=max_rounds
            )

            # Register callbacks if supported
            if hasattr(agent, 'register_new_step_callback'):
                agent.register_new_step_callback(on_step_end)

            # Run the agent
            print(f"[Browser-Use] Starting task: {task_desc}")
            result = await agent.run()

            # Process history
            if hasattr(result, 'history'):
                for i, step in enumerate(result.history):
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
            elif isinstance(result, list):
                for i, step in enumerate(result):
                    step_info = {
                        "step": i + 1,
                        "action": str(getattr(step, 'action', str(step))),
                    }
                    history.append(step_info)

            summary = progress.get_summary()

            return {
                "success": True,
                "rounds": len(history),
                "total_tokens": summary["total_tokens"],
                "input_tokens": summary["input_tokens"],
                "output_tokens": summary["output_tokens"],
                "total_response_time": summary["total_response_time"],
                "history": history
            }

    except Exception as e:
        import traceback
        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        print(f"[Browser-Use] Error: {error_msg}")

        summary = progress.get_summary()

        return {
            "success": False,
            "error": str(e),
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
        except Exception:
            pass


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


# Convenience function to check if Browser-Use is available
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


if __name__ == "__main__":
    # Simple test
    print(f"Browser-Use available: {is_browser_use_available()}")
    print(f"Available LLM providers: {get_available_llm_providers()}")

    if is_browser_use_available():
        def test_progress(round_num, max_rounds, **kwargs):
            print(f"PROGRESS: Step {round_num}/{max_rounds}")

        result = run_web_task_sync(
            task_desc="Go to example.com and find the main heading",
            url="https://example.com",
            model_name="ollama/llama3.2-vision",
            api_key="",
            base_url="http://localhost:11434",
            max_rounds=5,
            task_dir="/tmp/browser-use-test",
            emit_progress=test_progress
        )

        print(f"\nResult: {json.dumps(result, indent=2)}")
