"""
Common Layer - Unified LLM and Utility Interface

This package provides a unified interface for:
- LLM calls via LiteLLM (supports 100+ providers)
- Android device control
- Shared utilities

Used by Electron handlers to communicate with agent engines.
"""

from .llm_adapter import LLMAdapter, test_llm_connection
from .config import load_config, get_config

__all__ = [
    'LLMAdapter',
    'test_llm_connection',
    'load_config',
    'get_config',
]
