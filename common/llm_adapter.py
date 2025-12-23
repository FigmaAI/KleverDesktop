"""
LLM Adapter - Unified interface for all LLM calls.

This module provides a unified LLM interface using LiteLLM,
supporting 100+ providers including Ollama, OpenAI, Anthropic, etc.

Usage:
    from common.llm_adapter import LLMAdapter, test_llm_connection
    
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

from .config import get_config


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
        
        # Add API base and key if available
        if self.api_base:
            litellm_kwargs["api_base"] = self.api_base
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


# CLI interface for testing from terminal
if __name__ == "__main__":
    import json
    
    print("=" * 50)
    print("LLM Adapter Test")
    print("=" * 50)
    
    # Check if model is specified via command line
    model = None
    if len(sys.argv) > 1:
        model = sys.argv[1]
        print(f"Using model: {model}")
    
    # Run test
    result = test_llm_connection(model=model)
    
    print("\nResult:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result["success"]:
        print(f"\n✓ Connection successful!")
        print(f"  Model: {result['model']}")
        print(f"  Response: {result['message']}")
        print(f"  Time: {result['elapsed_seconds']:.2f}s")
    else:
        print(f"\n✗ Connection failed: {result['error']}")
