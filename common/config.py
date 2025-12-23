"""
Configuration loader for the common layer.

Reads configuration from:
1. Environment variables (set by Electron)
2. config.yaml file
"""
import os
import yaml
from typing import Dict, Any, Optional

# Default configuration
DEFAULT_CONFIG = {
    "model": {
        "provider": "ollama",
        "model_name": "gelab-zero-4b-preview",
        "api_base": "http://localhost:11434",
        "api_key": "",
        "temperature": 0.5,
        "max_tokens": 512,
    },
    "android": {
        "screenshot_dir": "/sdcard/klever",
        "xml_dir": "/sdcard/klever",
        "sdk_path": "",
    },
    "image": {
        "max_width": 1080,
        "max_height": 1920,
        "quality": 85,
        "optimize": True,
    }
}

_config: Dict[str, Any] = {}


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from file and environment variables.
    
    Priority:
    1. Environment variables (highest)
    2. config.yaml file
    3. Default values (lowest)
    
    Args:
        config_path: Optional path to config.yaml
    
    Returns:
        Configuration dictionary
    """
    global _config
    
    # Start with defaults
    config = DEFAULT_CONFIG.copy()
    
    # Try to load from file
    if config_path and os.path.exists(config_path):
        with open(config_path, 'r') as f:
            file_config = yaml.safe_load(f) or {}
            _deep_update(config, file_config)
    
    # Override with environment variables (set by Electron)
    env_mappings = {
        "API_BASE_URL": ("model", "api_base"),
        "API_KEY": ("model", "api_key"),
        "MODEL_PROVIDER": ("model", "provider"),
        "MODEL_NAME": ("model", "model_name"),
        "TEMPERATURE": ("model", "temperature"),
        "MAX_TOKENS": ("model", "max_tokens"),
        "ANDROID_SDK_PATH": ("android", "sdk_path"),
        "ANDROID_SCREENSHOT_DIR": ("android", "screenshot_dir"),
        "ANDROID_XML_DIR": ("android", "xml_dir"),
    }
    
    for env_key, config_path_tuple in env_mappings.items():
        env_value = os.environ.get(env_key)
        if env_value:
            section, key = config_path_tuple
            if section not in config:
                config[section] = {}
            # Type conversion
            if key in ("temperature",):
                config[section][key] = float(env_value)
            elif key in ("max_tokens", "max_width", "max_height", "quality"):
                config[section][key] = int(env_value)
            else:
                config[section][key] = env_value
    
    _config = config
    return config


def get_config(section: Optional[str] = None) -> Dict[str, Any]:
    """
    Get configuration values.
    
    Args:
        section: Optional section name (e.g., 'model', 'android')
    
    Returns:
        Configuration dictionary or section
    """
    global _config
    if not _config:
        load_config()
    
    if section:
        return _config.get(section, {})
    return _config


def _deep_update(base: dict, update: dict) -> dict:
    """Deep update a dictionary."""
    for key, value in update.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_update(base[key], value)
        else:
            base[key] = value
    return base


# Load config on import
load_config()
