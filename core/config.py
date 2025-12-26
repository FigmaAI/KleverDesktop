"""
Configuration loader for the common layer.

Follows the same pattern as appagent/scripts/config.py:
1. Environment variables (set by Electron via ModelSelector) - HIGHEST PRIORITY
2. engines/config.yaml (for defaults and standalone testing)
3. Default values - LOWEST PRIORITY

Environment variables set by Electron:
- MODEL_PROVIDER: Provider name (e.g., 'openai', 'ollama', 'anthropic')
- MODEL_NAME: Model identifier (e.g., 'gpt-4o', 'gelab-zero-4b-preview')
- API_KEY: API key for the provider
- API_BASE_URL: Custom API base URL (optional, mainly for Ollama)
"""
import os
import yaml
from typing import Dict, Any, Optional

# Default configuration
DEFAULT_CONFIG = {
    "model": {
        "provider": "ollama",
        "model_name": "gelab-zero-4b-preview",
        "api_base": "",
        "api_key": "",
        "temperature": 0.5,
        "max_tokens": 512,
    },
    "providers": {}
}


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from environment variables and config files.
    
    Priority (highest to lowest):
    1. Environment variables (MODEL_PROVIDER, MODEL_NAME, API_KEY, API_BASE_URL)
    2. engines/config.yaml file
    3. Default values
    
    This follows the same pattern as appagent/scripts/config.py,
    allowing Electron to pass configuration via environment variables.
    
    Returns:
        Configuration dictionary
    """
    # Start with defaults
    config = {
        "model": DEFAULT_CONFIG["model"].copy(),
        "providers": {}
    }
    
    # Try to load from config.yaml 
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    engines_config = os.path.join(parent_dir, "config.yaml")
    
    if os.path.exists(engines_config):
        with open(engines_config, 'r') as f:
            engines_cfg = yaml.safe_load(f) or {}
            
            # Store all providers for lookup
            config["providers"] = engines_cfg.get("providers", {})
            
            # Load default provider settings only as fallback
            default_provider = engines_cfg.get("default_provider", "ollama")
            providers = config["providers"]
            
            if default_provider in providers:
                provider_cfg = providers[default_provider]
                config["model"]["provider"] = default_provider
                # Only get api_key and model_name from provider config
                # api_base should only come from env var or explicit request
                config["model"]["api_key"] = provider_cfg.get("api_key", "")
                config["model"]["model_name"] = provider_cfg.get("default_model", "")
            
            # Load engine-specific settings
            if "gelab" in engines_cfg:
                gelab_cfg = engines_cfg["gelab"]
                config["model"]["temperature"] = gelab_cfg.get("temperature", 0.5)
                config["model"]["max_tokens"] = gelab_cfg.get("max_tokens", 512)
    
    # HIGHEST PRIORITY: Environment variables (set by Electron)
    # This is how ModelSelector.tsx passes config to Python scripts
    if os.environ.get("MODEL_PROVIDER"):
        provider = os.environ["MODEL_PROVIDER"]
        config["model"]["provider"] = provider
        
        # Also load API key for this provider from config if not in env
        if provider in config.get("providers", {}) and not os.environ.get("API_KEY"):
            provider_cfg = config["providers"][provider]
            config["model"]["api_key"] = provider_cfg.get("api_key", "")
    
    if os.environ.get("MODEL_NAME"):
        config["model"]["model_name"] = os.environ["MODEL_NAME"]
    
    if os.environ.get("API_KEY"):
        config["model"]["api_key"] = os.environ["API_KEY"]
    
    # api_base only from explicit environment variable
    # LiteLLM handles standard provider URLs automatically
    if os.environ.get("API_BASE_URL"):
        config["model"]["api_base"] = os.environ["API_BASE_URL"]
    else:
        config["model"]["api_base"] = ""  # Empty = let LiteLLM handle it
    
    # Additional env vars for compatibility
    if os.environ.get("TEMPERATURE"):
        config["model"]["temperature"] = float(os.environ["TEMPERATURE"])

    if os.environ.get("MAX_TOKENS"):
        config["model"]["max_tokens"] = int(os.environ["MAX_TOKENS"])

    # Android SDK Path (from Electron or config.yaml)
    if os.environ.get("ANDROID_SDK_PATH"):
        config["ANDROID_SDK_PATH"] = os.environ["ANDROID_SDK_PATH"]
    elif config_path is None and os.path.exists(engines_config):
        # Try to read from config.yaml
        with open(engines_config, 'r') as f:
            engines_cfg = yaml.safe_load(f) or {}
            if "ANDROID_SDK_PATH" in engines_cfg:
                config["ANDROID_SDK_PATH"] = engines_cfg["ANDROID_SDK_PATH"]

    return config


def get_config(section: Optional[str] = None) -> Dict[str, Any]:
    """
    Get configuration values.
    
    Args:
        section: Optional section name (e.g., 'model', 'providers')
    
    Returns:
        Configuration dictionary or section
    """
    config = load_config()
    
    if section:
        return config.get(section, {})
    return config


def get_provider_config(provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Get configuration for a specific provider.
    
    If provider is None, returns config for the current MODEL_PROVIDER.
    
    Args:
        provider: Provider name (e.g., 'openai', 'ollama')
    
    Returns:
        Provider configuration dict with api_key, api_base, default_model
    """
    config = load_config()
    
    if provider is None:
        # Use current model config (from env vars or defaults)
        return {
            "provider": config["model"]["provider"],
            "api_key": config["model"]["api_key"],
            "api_base": config["model"]["api_base"],
            "model_name": config["model"]["model_name"],
        }
    
    # Get specific provider from providers list
    providers = config.get("providers", {})
    if provider in providers:
        provider_cfg = providers[provider]
        return {
            "provider": provider,
            "api_key": provider_cfg.get("api_key", ""),
            "api_base": provider_cfg.get("api_base", ""),
            "model_name": provider_cfg.get("default_model", ""),
        }
    
    return {"provider": provider, "api_key": "", "api_base": "", "model_name": ""}
