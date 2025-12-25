"""
LLM Service using LiteLLM - Unified LLM interface for GELab-Zero

This module replaces the legacy openai==0.28.0 SDK with LiteLLM,
enabling support for 100+ LLM providers while maintaining the same interface.

Original file backed up as: ask_llm_v2.py.backup_original
"""
import sys
import os
if "." not in sys.path:
    sys.path.append(".")

# Try to import from megfile, fallback to standard open
try:
    from megfile import smart_open
except ImportError:
    smart_open = open

import base64
import yaml
import json
import time

# Import LiteLLM instead of legacy openai
try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False
    print("[WARNING] LiteLLM not available. Install with: pip install litellm")


def ask_llm_anything(model_provider, model_name, messages, args={
    "max_tokens": 256,
    "temperature": 0.5,
    "top_p": 1.0,
    "frequency_penalty": 0.0,
}, resize_config=None):
    """
    Send messages to LLM and get response.
    
    Args:
        model_provider: Provider name (e.g., 'local' for ollama, 'openai', 'anthropic')
        model_name: Model identifier (e.g., 'gelab-zero-4b-preview', 'gpt-4o')
        messages: List of message dicts in OpenAI format
        args: LLM parameters (max_tokens, temperature, top_p, frequency_penalty)
        resize_config: Optional image resize configuration
    
    Returns:
        str: Model response text
    """
    if not LITELLM_AVAILABLE:
        raise ImportError("LiteLLM is required. Install with: pip install litellm")
    
    # Load model config
    config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model_config.yaml")
    if os.path.exists(config_path):
        with smart_open(config_path, "r") as f:
            model_config = yaml.safe_load(f)
    else:
        model_config = {}
    
    # Get API configuration from model_config or environment
    api_base = None
    api_key = None
    
    if model_provider in model_config:
        api_base = model_config[model_provider].get("api_base")
        api_key = model_config[model_provider].get("api_key", "")
    
    # Environment variable overrides
    if os.environ.get("API_BASE_URL"):
        api_base = os.environ["API_BASE_URL"]
    if os.environ.get("API_KEY"):
        api_key = os.environ["API_KEY"]
    
    # Build the LiteLLM model name with provider prefix
    litellm_model = model_name
    if model_provider == "local" and not model_name.startswith("ollama/"):
        litellm_model = f"ollama/{model_name}"
    elif model_provider == "openai" and not model_name.startswith("openai/"):
        # OpenAI models don't need prefix for LiteLLM by default
        litellm_model = model_name
    elif model_provider == "anthropic" and not model_name.startswith("anthropic/"):
        litellm_model = f"anthropic/{model_name}"
    
    # Preprocess messages (convert image paths to base64)
    def preprocess_messages(messages):
        for msg in messages:
            if type(msg['content']) == str:
                continue
            assert type(msg['content']) == list
            for content in msg['content']:
                if content['type'] == "text":
                    continue
                assert content['type'] == "image_url" or content['type'] == "image_b64"
                if content['type'] == "image_url":
                    url = content['image_url']['url']
                    # Check if the image is already in base64 format
                    if url.startswith("data:image/"):
                        continue
                    else:
                        with smart_open(url, mode="rb") as f:
                            image_bytes = f.read()
                        b64 = base64.b64encode(image_bytes).decode('utf-8')

                        # Detect image format
                        if image_bytes[0:4] == b"\x89PNG":
                            content['image_url']['url'] = "data:image/png;base64," + b64
                        elif image_bytes[0:2] == b"\xff\xd8":
                            content['image_url']['url'] = "data:image/jpeg;base64," + b64
                        else:
                            content['image_url']['url'] = "data:image/png;base64," + b64

                else:
                    assert content['type'] == "image_b64"
                    b64 = content['image_b64']['b64_json']
                    del content['image_b64']
                    content['image_url'] = {"url": "data:image/png;base64," + b64}
                    content['type'] = "image_url"
                
                # Resize image if configured
                if resize_config is not None and resize_config.get("is_resize", False):
                    image_url = content['image_url']['url']
                    image_b64_url = image_url.split(",", 1)[1]
                    image_data = base64.b64decode(image_b64_url)
                    from PIL import Image
                    import io
                    image = Image.open(io.BytesIO(image_data))
                    image = image.resize(size=resize_config['target_image_size'])
                    image_data = io.BytesIO()
                    image = image.convert('RGB')
                    image.save(image_data, format="JPEG", quality=85)
                    image_data = image_data.getvalue()
                    b64_image = base64.b64encode(image_data).decode('utf-8')
                    content['image_url']['url'] = f"data:image/jpeg;base64,{b64_image}"

        return messages
    
    messages = preprocess_messages(messages)

    # Build LiteLLM kwargs
    litellm_kwargs = {
        "model": litellm_model,
        "messages": messages,
        "temperature": args.get("temperature", 0.5),
        "top_p": args.get("top_p", 1.0),
        "frequency_penalty": args.get("frequency_penalty", 0.0),
        "max_tokens": args.get("max_tokens", 256),
    }
    
    # Add API base and key if available
    if api_base:
        litellm_kwargs["api_base"] = api_base
    if api_key:
        litellm_kwargs["api_key"] = api_key
    
    # Make the API call
    start_time = time.time()
    response = completion(**litellm_kwargs)
    end_time = time.time()
    
    print(f"LLM {model_name} inference time: {end_time - start_time:.2f} seconds")
    
    # Extract result from LiteLLM response (OpenAI-compatible format)
    result = response.choices[0].message.content
    
    print("llm ask id:", response.id)
    
    # Handle reasoning content (for models that support it)
    reasoning = getattr(response.choices[0].message, 'reasoning_content', None)
    if not reasoning:
        # Try model_extra for some providers
        model_extra = getattr(response.choices[0].message, 'model_extra', {})
        reasoning = model_extra.get('reasoning_content', '') if model_extra else ''
    
    if reasoning:
        result = "<think>" + reasoning + "</think>" + "\n" + result

    return result


# Keep backward compatibility - allow direct import
__all__ = ['ask_llm_anything', 'LITELLM_AVAILABLE']
