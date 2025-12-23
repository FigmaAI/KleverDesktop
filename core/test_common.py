#!/usr/bin/env python3
"""
Test script for common layer - Can be called from Electron or terminal.

Usage:
    # Test with default Ollama model
    python test_common.py
    
    # Test with specific model
    python test_common.py ollama/llama3.2-vision
    
    # Test with OpenAI
    API_KEY=sk-xxx python test_common.py gpt-4o
"""
import os
import sys
import json

# Add parent directory to path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from core.llm_adapter import test_llm_connection, LLMAdapter
from core.config import get_config, load_config


def main():
    print("=" * 60)
    print("Common Layer Test")
    print("=" * 60)
    
    # Show current config
    config = get_config()
    print("\n📋 Current Configuration:")
    print(f"   Default Provider: {config.get('model', {}).get('provider', 'N/A')}")
    print(f"   Default Model: {config.get('model', {}).get('model_name', 'N/A')}")
    
    # Get model from command line if provided
    model = None
    api_key = None
    api_base = None
    provider = None
    
    if len(sys.argv) > 1:
        model = sys.argv[1]
        print(f"\n🔧 Using model from argument: {model}")
        
        # Auto-detect provider from model name
        providers = config.get("providers", {})
        model_lower = model.lower()
        
        if model_lower.startswith("ollama/") or "gelab" in model_lower or "qwen" in model_lower or "llama" in model_lower:
            provider = "ollama"
        elif model_lower.startswith("gpt") or model_lower.startswith("o1") or model_lower.startswith("o3"):
            provider = "openai"
        elif model_lower.startswith("claude") or model_lower.startswith("anthropic/"):
            provider = "anthropic"
        elif model_lower.startswith("gemini"):
            provider = "gemini"
        elif "/" in model_lower:  # e.g., "openrouter/..."
            provider = model_lower.split("/")[0]
        
        if provider and provider in providers:
            provider_cfg = providers[provider]
            api_key = provider_cfg.get("api_key", "")
            api_base = provider_cfg.get("api_base")  # None if not specified
            print(f"   Auto-detected provider: {provider}")
            print(f"   API Key: {'[SET]' if api_key else '[NOT SET]'}")
    
    # Environment variable overrides
    if os.environ.get("API_KEY"):
        api_key = os.environ["API_KEY"]
        print("   API Key (from env): [SET]")
    
    if os.environ.get("API_BASE_URL"):
        api_base = os.environ["API_BASE_URL"]
        print(f"   API Base (from env): {api_base}")
    
    # Run test
    print("\n🔄 Testing LLM connection...")
    result = test_llm_connection(model=model, api_base=api_base, api_key=api_key)
    
    print("\n" + "=" * 60)
    print("📊 Test Result:")
    print("=" * 60)
    
    # Pretty print result
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    if result["success"]:
        print("\n" + "=" * 60)
        print("✅ CONNECTION SUCCESSFUL!")
        print("=" * 60)
        print(f"   Model: {result['model']}")
        print(f"   Response: {result['message']}")
        print(f"   Time: {result.get('elapsed_seconds', 0):.2f}s")
        if result.get("usage"):
            print(f"   Tokens: {result['usage'].get('total_tokens', 0)}")
        return 0
    else:
        print("\n" + "=" * 60)
        print("❌ CONNECTION FAILED!")
        print("=" * 60)
        print(f"   Error: {result['error']}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
