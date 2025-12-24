"""
Core Layer - Unified LLM, Android, and Utility Interface

This package provides a unified interface for:
- LLM calls via LiteLLM (supports 100+ providers)
- Android device control (core/android.py)
- Shared utilities (logging, image processing)

Used by Electron handlers to communicate with agent engines.

Modules:
- llm_adapter: LLM/AI model interface
- config: Configuration management
- utils: Logging, image utilities
- android: Android device management (adb, emulator, APK)
"""

from .llm_adapter import LLMAdapter, test_llm_connection
from .config import load_config, get_config

__all__ = [
    'LLMAdapter',
    'test_llm_connection',
    'load_config',
    'get_config',
]

