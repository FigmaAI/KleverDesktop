"""
LLM Adapter - Unified interface for all LLM calls.

This module provides a unified LLM interface using LiteLLM,
supporting 100+ providers including Ollama, OpenAI, Anthropic, etc.

Usage:
    from core.llm_adapter import LLMAdapter, test_llm_connection

    # Test connection
    result = test_llm_connection("ollama/gelab-zero-4b-preview")
    print(result)

    # Full usage
    adapter = LLMAdapter()
    response = adapter.chat("Hello, how are you?")
"""
import os
import sys
import time
import base64
from typing import Dict, List, Any, Optional, Union

# Add parent directory to path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import LiteLLM
try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("[WARNING] LiteLLM not available. Install with: pip install litellm")

try:
    from .config import get_config
except ImportError:
    from config import get_config


class LLMAdapter:
    """
    Unified LLM adapter using LiteLLM.
    
    Supports all LiteLLM-compatible providers:
    - Ollama (local models): ollama/model-name
    - OpenAI: gpt-4o, gpt-4-turbo
    - Anthropic: anthropic/claude-3-opus
    - And 100+ more providers
    """
    
    def __init__(
        self,
        model: Optional[str] = None,
        api_base: Optional[str] = None,
        api_key: Optional[str] = None,
        temperature: float = 0.5,
        max_tokens: int = 512,
    ):
        """
        Initialize LLM adapter.
        
        Args:
            model: Model name (e.g., 'ollama/gelab-zero-4b-preview')
            api_base: API base URL (e.g., 'http://localhost:11434')
            api_key: API key (optional for Ollama)
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
        """
        config = get_config("model")
        
        self.model = model or config.get("model_name", "ollama/gelab-zero-4b-preview")
        self.api_base = api_base or config.get("api_base", "http://localhost:11434")
        self.api_key = api_key or config.get("api_key", "")
        self.temperature = temperature or config.get("temperature", 0.5)
        self.max_tokens = max_tokens or config.get("max_tokens", 512)
        
        # Add provider prefix if needed
        if not "/" in self.model and not self.model.startswith("gpt"):
            provider = config.get("provider", "ollama")
            self.model = f"{provider}/{self.model}"
    
    def chat(
        self,
        message: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send a chat message to the LLM.
        
        Args:
            message: User message
            system_prompt: Optional system prompt
            images: Optional list of image paths or base64 strings
            **kwargs: Additional LiteLLM parameters
        
        Returns:
            Dict with 'success', 'content', 'usage', 'error'
        """
        if not LITELLM_AVAILABLE:
            return {
                "success": False,
                "content": None,
                "error": "LiteLLM not available. Install with: pip install litellm"
            }
        
        try:
            # Build messages
            messages = []
            
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            # Build user message content
            if images:
                content = [{"type": "text", "text": message}]
                for img in images:
                    content.append(self._format_image(img))
                messages.append({"role": "user", "content": content})
            else:
                messages.append({"role": "user", "content": message})
            
            return self._call_llm(messages, **kwargs)
            
        except Exception as e:
            return {
                "success": False,
                "content": None,
                "error": str(e)
            }
    
    def chat_with_messages(
        self,
        messages: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send pre-formatted messages to the LLM.
        
        Args:
            messages: List of message dicts in OpenAI format
            **kwargs: Additional LiteLLM parameters
        
        Returns:
            Dict with 'success', 'content', 'usage', 'error'
        """
        if not LITELLM_AVAILABLE:
            return {
                "success": False,
                "content": None,
                "error": "LiteLLM not available"
            }
        
        try:
            return self._call_llm(messages, **kwargs)
        except Exception as e:
            return {
                "success": False,
                "content": None,
                "error": str(e)
            }
    
    def _call_llm(self, messages: List[Dict], **kwargs) -> Dict[str, Any]:
        """Internal method to call LiteLLM."""
        start_time = time.time()
        
        # Build kwargs
        litellm_kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", self.temperature),
            "max_tokens": kwargs.get("max_tokens", self.max_tokens),
        }
        
        # Only add api_base for Ollama or custom endpoints
        # Standard providers (OpenAI, Anthropic, etc.) don't need it - LiteLLM handles their URLs
        model_lower = self.model.lower()
        needs_api_base = (
            model_lower.startswith("ollama/") or
            "localhost" in self.api_base or
            (self.api_base and not any(std in self.api_base for std in [
                "openai.com", "anthropic.com", "googleapis.com", "openrouter.ai"
            ]))
        )
        
        if self.api_base and needs_api_base:
            litellm_kwargs["api_base"] = self.api_base
        
        # Always pass API key if available
        if self.api_key:
            litellm_kwargs["api_key"] = self.api_key
        
        # Add any extra kwargs
        for key in ["top_p", "frequency_penalty", "presence_penalty", "stop"]:
            if key in kwargs:
                litellm_kwargs[key] = kwargs[key]
        
        # Call LiteLLM
        response = completion(**litellm_kwargs)
        
        elapsed = time.time() - start_time
        
        # Extract content
        content = response.choices[0].message.content
        
        # Handle reasoning content (for reasoning models)
        reasoning = getattr(response.choices[0].message, 'reasoning_content', None)
        if not reasoning:
            model_extra = getattr(response.choices[0].message, 'model_extra', {})
            reasoning = model_extra.get('reasoning_content', '') if model_extra else ''
        
        if reasoning:
            content = f"<think>{reasoning}</think>\n{content}"
        
        return {
            "success": True,
            "content": content,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                "total_tokens": response.usage.total_tokens if response.usage else 0,
            },
            "elapsed_seconds": elapsed,
            "model": self.model,
            "error": None
        }
    
    def _format_image(self, image: str) -> Dict[str, Any]:
        """Format image for LLM input."""
        # Already base64
        if image.startswith("data:image/"):
            return {
                "type": "image_url",
                "image_url": {"url": image}
            }
        
        # File path - convert to base64
        if os.path.exists(image):
            with open(image, "rb") as f:
                image_bytes = f.read()
            b64 = base64.b64encode(image_bytes).decode('utf-8')
            
            # Detect format
            if image_bytes[0:4] == b"\x89PNG":
                mime = "image/png"
            elif image_bytes[0:2] == b"\xff\xd8":
                mime = "image/jpeg"
            else:
                mime = "image/png"
            
            return {
                "type": "image_url",
                "image_url": {"url": f"data:{mime};base64,{b64}"}
            }
        
        # Assume it's a URL
        return {
            "type": "image_url",
            "image_url": {"url": image}
        }


def test_llm_connection(
    model: Optional[str] = None,
    api_base: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Test LLM connection with a simple prompt.
    
    This function is designed to be called from Electron to verify
    that the LLM connection is working.
    
    Args:
        model: Model name (uses config default if not specified)
        api_base: API base URL
        api_key: API key
    
    Returns:
        Dict with 'success', 'message', 'model', 'elapsed_seconds', 'error'
    """
    try:
        adapter = LLMAdapter(
            model=model,
            api_base=api_base,
            api_key=api_key,
            max_tokens=50  # Small for test
        )
        
        result = adapter.chat("Say 'Hello from LLM!' in exactly 5 words.")
        
        if result["success"]:
            return {
                "success": True,
                "message": result["content"],
                "model": adapter.model,
                "elapsed_seconds": result.get("elapsed_seconds", 0),
                "usage": result.get("usage", {}),
                "error": None
            }
        else:
            return {
                "success": False,
                "message": None,
                "model": adapter.model,
                "elapsed_seconds": 0,
                "error": result["error"]
            }
    
    except Exception as e:
        return {
            "success": False,
            "message": None,
            "model": model or "unknown",
            "elapsed_seconds": 0,
            "error": str(e)
        }


def log_debug(msg: str):
    """Print debug message to stderr (so it doesn't interfere with JSON output)"""
    print(f"[llm_service] {msg}", file=sys.stderr, flush=True)


def chat_completion_cli(text: str, model: str, api_key: str = "", base_url: str = "",
                        temperature: float = 0.7, max_tokens: int = 4096) -> dict:
    """
    Chat completion for CLI usage (matches appagent interface).
    """
    adapter = LLMAdapter(
        model=model,
        api_base=base_url if base_url else None,
        api_key=api_key if api_key else None,
        temperature=temperature,
        max_tokens=max_tokens
    )
    
    result = adapter.chat(text)
    
    if result["success"]:
        return {
            "success": True,
            "content": result["content"],
            "usage": result.get("usage", {}),
        }
    else:
        return {"success": False, "error": result["error"]}


def test_connection_cli(model: str, api_key: str = "", base_url: str = "") -> dict:
    """
    Test model connection for CLI usage (matches appagent interface).
    """
    import litellm
    litellm.suppress_debug_info = True
    
    log_debug(f"Testing connection to model: {model[:50]}...")
    
    start_time = time.time()
    
    try:
        completion_params = {
            "model": model,
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 20,
            "timeout": 30,
        }
        
        # Add API key if provided (skip for Ollama)
        is_ollama = model.startswith("ollama/")
        if api_key and api_key.strip() and not is_ollama:
            completion_params["api_key"] = api_key
            log_debug("API key provided")
        
        # Only set api_base for non-standard providers
        if base_url and base_url.strip():
            if not model.startswith("openrouter/"):
                completion_params["api_base"] = base_url
                log_debug(f"Using custom base URL: {base_url}")
            else:
                log_debug("OpenRouter detected: skipping api_base")
        
        log_debug("Sending test request...")
        
        response = completion(**completion_params)
        
        response_time = time.time() - start_time
        
        if response.choices and response.choices[0].message.content:
            log_debug(f"Connection successful in {response_time:.2f}s")
            return {
                "success": True,
                "message": f"Connection successful! Response time: {response_time:.2f}s",
                "response_time": response_time,
            }
        else:
            return {
                "success": False,
                "message": "Empty response from model",
            }
    
    except Exception as e:
        response_time = time.time() - start_time
        error_msg = str(e)
        log_debug(f"Connection failed after {response_time:.2f}s: {error_msg}")
        return {
            "success": False,
            "message": error_msg,
            "response_time": response_time,
        }


# CLI interface matching appagent/scripts/llm_service.py
if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="LLM Service using LiteLLM (Common Layer)")
    parser.add_argument("--action", choices=["chat", "test"], help="Action to perform")
    parser.add_argument("--text", help="Prompt for chat")
    parser.add_argument("--model", required=True, help="LiteLLM model name")
    parser.add_argument("--api_key", default="", help="API key for the provider")
    parser.add_argument("--base_url", default="", help="Custom base URL")
    parser.add_argument("--temperature", type=float, default=0.7, help="Sampling temperature")
    parser.add_argument("--max_tokens", type=int, default=4096, help="Max tokens")
    parser.add_argument("--stdin", action="store_true", help="Read JSON input from stdin")
    
    args = parser.parse_args()
    
    # Read from stdin if specified
    if args.stdin:
        log_debug("Reading JSON from stdin...")
        try:
            stdin_data = sys.stdin.read()
            log_debug(f"Received {len(stdin_data)} bytes from stdin")
            input_data = json.loads(stdin_data)
            action = input_data.get("action", "chat")
            text = input_data.get("text", "")
            model = input_data.get("model", args.model)
            api_key = input_data.get("api_key", args.api_key)
            base_url = input_data.get("base_url", args.base_url)
            temperature = input_data.get("temperature", args.temperature)
            max_tokens = input_data.get("max_tokens", args.max_tokens)
            log_debug(f"Parsed action: {action}")
        except json.JSONDecodeError as e:
            log_debug(f"JSON decode error: {e}")
            print(json.dumps({"success": False, "error": f"Invalid JSON input: {e}"}))
            sys.exit(1)
    else:
        action = args.action
        text = args.text
        model = args.model
        api_key = args.api_key
        base_url = args.base_url
        temperature = args.temperature
        max_tokens = args.max_tokens
    
    # Perform action
    if action == "chat":
        if not text:
            result = {"success": False, "error": "No prompt provided"}
        else:
            result = chat_completion_cli(text, model, api_key, base_url, temperature, max_tokens)
    elif action == "test":
        result = test_connection_cli(model, api_key, base_url)
    else:
        result = {"success": False, "error": f"Unknown action: {action}"}
    
    # Output JSON result
    print(json.dumps(result, ensure_ascii=False))
