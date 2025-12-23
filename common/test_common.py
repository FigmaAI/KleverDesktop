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

from common.llm_adapter import test_llm_connection, LLMAdapter
from common.config import get_config, load_config


def main():
    print("=" * 60)
    print("Common Layer Test")
    print("=" * 60)
    
    # Show current config
    config = get_config()
    print("\n📋 Current Configuration:")
    print(f"   Provider: {config.get('model', {}).get('provider', 'N/A')}")
    print(f"   Model: {config.get('model', {}).get('model_name', 'N/A')}")
    print(f"   API Base: {config.get('model', {}).get('api_base', 'N/A')}")
    
    # Get model from command line if provided
    model = None
    api_base = None
    api_key = None
    
    if len(sys.argv) > 1:
        model = sys.argv[1]
        print(f"\n🔧 Using model from argument: {model}")
    
    if len(sys.argv) > 2:
        api_base = sys.argv[2]
        print(f"   API Base: {api_base}")
    
    # Check environment
    if os.environ.get("API_KEY"):
        api_key = os.environ["API_KEY"]
        print("   API Key: [SET FROM ENV]")
    
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
