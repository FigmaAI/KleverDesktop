#!/usr/bin/env python3
"""
LLM Service - Unified LLM interface using LiteLLM
This script provides a simple request-response interface for LLM calls.
Used by Electron for translation and other LLM tasks.

Usage:
    echo '{"action": "translate", "text": "Hello", "target_lang": "ko", ...}' | python llm_service.py
    
    Or with args:
    python llm_service.py --action translate --text "Hello" --target_lang ko --provider openrouter --model openrouter/openai/gpt-4.1-mini --api_key xxx
"""

import argparse
import json
import sys
import os

# Add current script directory to sys.path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False


def log_debug(msg: str):
    """Print debug message to stderr (so it doesn't interfere with JSON output)"""
    print(f"[llm_service] {msg}", file=sys.stderr, flush=True)


def translate_text(text: str, target_lang: str, model: str, api_key: str = "", base_url: str = "") -> dict:
    """
    Translate text to target language using LiteLLM.
    
    Args:
        text: Text to translate
        target_lang: Target language code ('ko', 'ja', 'en')
        model: LiteLLM model name (e.g., 'openrouter/openai/gpt-4.1-mini')
        api_key: API key for the provider
        base_url: Optional custom base URL
    
    Returns:
        dict with 'success', 'translated_text' or 'error'
    """
    if not LITELLM_AVAILABLE:
        return {"success": False, "error": "LiteLLM not installed"}
    
    log_debug(f"Translating to {target_lang}, model: {model}")
    log_debug(f"Text length: {len(text)} chars")
    
    lang_names = {
        "en": "English",
        "ko": "Korean", 
        "ja": "Japanese",
    }
    target_lang_name = lang_names.get(target_lang, target_lang)
    
    prompt = f"""Translate the following text to {target_lang_name}. Respond with ONLY the translation, without any explanation or additional text.

Text to translate:
{text}"""

    try:
        # Prepare completion parameters
        completion_params = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3,
            "max_tokens": 4096,
            "timeout": 60,  # Increased timeout for large texts
        }
        
        # Add API key if provided (skip for Ollama which doesn't need auth)
        # Detect Ollama from model name
        is_ollama = model.startswith("ollama/")
        if api_key and api_key.strip() and not is_ollama:
            completion_params["api_key"] = api_key
            log_debug("API key provided")
        
        # Add base URL if provided
        if base_url and base_url.strip():
            completion_params["api_base"] = base_url
            log_debug(f"Using base URL: {base_url}")
        
        log_debug("Calling LiteLLM completion...")
        
        # Make the API call via LiteLLM
        response = completion(**completion_params)
        
        log_debug("Response received")
        
        # Extract response content
        translated_text = response.choices[0].message.content.strip()
        
        if not translated_text:
            return {"success": False, "error": "Empty response from model"}
        
        log_debug(f"Translation successful, {len(translated_text)} chars")
        
        return {
            "success": True,
            "translated_text": translated_text,
        }
        
    except Exception as e:
        log_debug(f"Error: {str(e)}")
        return {"success": False, "error": str(e)}


def chat_completion(prompt: str, model: str, api_key: str = "", base_url: str = "",
                    temperature: float = 0.7, max_tokens: int = 4096) -> dict:
    """
    Generic chat completion using LiteLLM.

    Args:
        prompt: User prompt
        model: LiteLLM model name
        api_key: API key for the provider
        base_url: Optional custom base URL
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response

    Returns:
        dict with 'success', 'content' or 'error'
    """
    if not LITELLM_AVAILABLE:
        return {"success": False, "error": "LiteLLM not installed"}

    try:
        completion_params = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "timeout": 60,
        }

        # Add API key if provided (skip for Ollama which doesn't need auth)
        is_ollama = model.startswith("ollama/")
        if api_key and api_key.strip() and not is_ollama:
            completion_params["api_key"] = api_key

        if base_url and base_url.strip():
            completion_params["api_base"] = base_url

        response = completion(**completion_params)
        content = response.choices[0].message.content.strip()

        # Extract token usage if available
        usage = {}
        if hasattr(response, 'usage') and response.usage:
            usage = {
                "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
                "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
                "total_tokens": getattr(response.usage, 'total_tokens', 0),
            }

        return {
            "success": True,
            "content": content,
            "usage": usage,
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


def test_connection(model: str, api_key: str = "", base_url: str = "") -> dict:
    """
    Test model connection by sending a simple prompt.

    This uses LiteLLM which automatically handles:
    - Provider detection from model name prefix (e.g., 'openrouter/', 'ollama/')
    - Model name transformation for each provider
    - API routing and authentication

    Args:
        model: LiteLLM model name (e.g., 'openrouter/openai/gpt-4o-mini', 'ollama/llama3.2-vision')
        api_key: API key for the provider
        base_url: Optional custom base URL (not needed for most providers)

    Returns:
        dict with 'success', 'message', and optionally 'response_time'
    """
    import time
    import litellm

    # Suppress LiteLLM's verbose output that interferes with JSON parsing
    litellm.suppress_debug_info = True

    if not LITELLM_AVAILABLE:
        return {"success": False, "message": "LiteLLM not installed"}

    log_debug(f"Testing connection to model: {model}")

    start_time = time.time()

    try:
        completion_params = {
            "model": model,
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 20,  # Minimum 16 required by some providers (Azure/OpenRouter)
            "timeout": 30,
        }

        # Add API key if provided (skip for Ollama which doesn't need auth)
        is_ollama = model.startswith("ollama/")
        if api_key and api_key.strip() and not is_ollama:
            completion_params["api_key"] = api_key
            log_debug("API key provided")

        # Note: For providers like OpenRouter, do NOT set api_base
        # LiteLLM automatically routes based on the model prefix (e.g., 'openrouter/')
        # Setting api_base causes the model name to be sent as-is without transformation
        if base_url and base_url.strip():
            # Only set api_base for providers that need custom endpoints (e.g., Ollama with non-default port)
            # Skip for OpenRouter - LiteLLM handles it automatically
            if not model.startswith("openrouter/"):
                completion_params["api_base"] = base_url
                log_debug(f"Using custom base URL: {base_url}")
            else:
                log_debug("OpenRouter detected: skipping api_base (LiteLLM handles routing)")

        log_debug("Sending test request...")

        response = completion(**completion_params)

        response_time = time.time() - start_time

        # Check if we got a valid response
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


def main():
    parser = argparse.ArgumentParser(description="LLM Service using LiteLLM")
    parser.add_argument("--action", choices=["translate", "chat", "test"], help="Action to perform")
    parser.add_argument("--text", help="Text to translate or prompt for chat")
    parser.add_argument("--target_lang", help="Target language for translation (ko, ja, en)")
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
            action = input_data.get("action", "translate")
            text = input_data.get("text", "")
            target_lang = input_data.get("target_lang", "en")
            model = input_data.get("model", args.model)
            api_key = input_data.get("api_key", args.api_key)
            base_url = input_data.get("base_url", args.base_url)
            temperature = input_data.get("temperature", args.temperature)
            max_tokens = input_data.get("max_tokens", args.max_tokens)
            log_debug(f"Parsed action: {action}, target_lang: {target_lang}")
        except json.JSONDecodeError as e:
            log_debug(f"JSON decode error: {e}")
            print(json.dumps({"success": False, "error": f"Invalid JSON input: {e}"}))
            sys.exit(1)
    else:
        action = args.action
        text = args.text
        target_lang = args.target_lang
        model = args.model
        api_key = args.api_key
        base_url = args.base_url
        temperature = args.temperature
        max_tokens = args.max_tokens
    
    # Perform action
    if action == "translate":
        if not text:
            result = {"success": False, "error": "No text provided for translation"}
        elif not target_lang:
            result = {"success": False, "error": "No target language specified"}
        else:
            result = translate_text(text, target_lang, model, api_key, base_url)
    elif action == "chat":
        if not text:
            result = {"success": False, "error": "No prompt provided"}
        else:
            result = chat_completion(text, model, api_key, base_url, temperature, max_tokens)
    elif action == "test":
        result = test_connection(model, api_key, base_url)
    else:
        result = {"success": False, "error": f"Unknown action: {action}"}
    
    # Output JSON result
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()

