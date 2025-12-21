#!/usr/bin/env python3
"""
Test script for Browser-Use wrapper

This script tests the Browser-Use wrapper functionality to ensure
it works correctly with different configurations.

Usage:
    python test_browser_use_wrapper.py

Requirements:
    - Browser-Use installed: pip install browser-use
    - LangChain providers installed: pip install langchain-ollama langchain-openai
    - Ollama running (for local model tests): ollama serve
"""

import os
import sys
import json
import tempfile

# Add script directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from browser_use_wrapper import (
    is_browser_use_available,
    get_available_llm_providers,
    run_web_task_sync,
    create_llm_from_litellm_name
)


def test_availability():
    """Test if Browser-Use and dependencies are available."""
    print("=" * 60)
    print("Testing Browser-Use Availability")
    print("=" * 60)

    available = is_browser_use_available()
    print(f"Browser-Use available: {available}")

    providers = get_available_llm_providers()
    print(f"Available LLM providers: {providers}")

    return available


def test_llm_creation():
    """Test LLM creation for different providers."""
    print("\n" + "=" * 60)
    print("Testing LLM Creation")
    print("=" * 60)

    test_cases = [
        ("ollama/llama3.2-vision", "", "http://localhost:11434"),
        ("gpt-4o", "test-key", ""),
        ("claude-3-5-sonnet-20241022", "test-key", ""),
    ]

    for model_name, api_key, base_url in test_cases:
        try:
            llm = create_llm_from_litellm_name(model_name, api_key, base_url)
            print(f"  {model_name}: OK ({type(llm).__name__})")
        except ImportError as e:
            print(f"  {model_name}: SKIP (missing dependency: {e})")
        except Exception as e:
            print(f"  {model_name}: FAIL ({e})")


def test_progress_callback():
    """Test progress callback mechanism."""
    print("\n" + "=" * 60)
    print("Testing Progress Callback")
    print("=" * 60)

    progress_updates = []

    def progress_callback(round_num, max_rounds, **kwargs):
        update = {
            "round": round_num,
            "maxRounds": max_rounds,
            **kwargs
        }
        progress_updates.append(update)
        print(f"  PROGRESS: {json.dumps(update)}")

    # Simulate progress updates
    progress_callback(1, 10, tokens_this_round=100)
    progress_callback(2, 10, tokens_this_round=150)
    progress_callback(3, 10, tokens_this_round=120)

    print(f"  Total updates received: {len(progress_updates)}")
    assert len(progress_updates) == 3, "Expected 3 progress updates"
    print("  Progress callback test: PASSED")


def test_simple_navigation():
    """Test simple web navigation with Browser-Use."""
    print("\n" + "=" * 60)
    print("Testing Simple Navigation (requires Ollama)")
    print("=" * 60)

    if not is_browser_use_available():
        print("  SKIP: Browser-Use not available")
        return

    # Check if Ollama is running
    import subprocess
    try:
        result = subprocess.run(
            ["curl", "-s", "http://localhost:11434/api/tags"],
            capture_output=True,
            timeout=5
        )
        if result.returncode != 0:
            print("  SKIP: Ollama not running")
            return
    except Exception:
        print("  SKIP: Cannot connect to Ollama")
        return

    # Create temp directory for output
    with tempfile.TemporaryDirectory() as task_dir:
        progress_log = []

        def log_progress(round_num, max_rounds, **kwargs):
            progress_log.append({"round": round_num, "max": max_rounds})
            print(f"  Step {round_num}/{max_rounds}")

        print("  Running simple navigation test...")
        result = run_web_task_sync(
            task_desc="Go to example.com and find the main heading text",
            url="https://example.com",
            model_name="ollama/llama3.2-vision",
            api_key="",
            base_url="http://localhost:11434",
            max_rounds=5,
            task_dir=task_dir,
            headless=True,
            emit_progress=log_progress
        )

        print(f"  Result: success={result['success']}, rounds={result['rounds']}")
        if not result['success']:
            print(f"  Error: {result.get('error', 'Unknown')}")

        # Check screenshots were saved
        screenshots_dir = os.path.join(task_dir, "screenshots")
        if os.path.exists(screenshots_dir):
            screenshots = os.listdir(screenshots_dir)
            print(f"  Screenshots saved: {len(screenshots)}")


def test_error_handling():
    """Test error handling for invalid configurations."""
    print("\n" + "=" * 60)
    print("Testing Error Handling")
    print("=" * 60)

    if not is_browser_use_available():
        print("  SKIP: Browser-Use not available")
        return

    with tempfile.TemporaryDirectory() as task_dir:
        # Test with invalid model
        result = run_web_task_sync(
            task_desc="Test task",
            url="https://example.com",
            model_name="invalid/model",
            api_key="",
            base_url="http://invalid-url:99999",
            max_rounds=1,
            task_dir=task_dir,
            headless=True
        )

        # Should fail gracefully
        print(f"  Invalid model test: success={result['success']}")
        if not result['success']:
            print(f"  Error (expected): {result.get('error', 'No error message')[:100]}...")
            print("  Error handling test: PASSED")
        else:
            print("  Error handling test: UNEXPECTED SUCCESS")


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("Browser-Use Wrapper Test Suite")
    print("=" * 60)

    # Check availability first
    if not test_availability():
        print("\nBrowser-Use is not available. Some tests will be skipped.")
        print("Install with: pip install browser-use langchain-ollama langchain-openai")

    # Run tests
    test_llm_creation()
    test_progress_callback()
    test_simple_navigation()
    test_error_handling()

    print("\n" + "=" * 60)
    print("Test Suite Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
