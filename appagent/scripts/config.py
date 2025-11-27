import os
import yaml


def load_config(config_path=None):
    if config_path is None:
        # Default to config.yaml in the parent directory of this script
        # appagent/scripts/config.py -> appagent/config.yaml
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        config_path = os.path.join(parent_dir, "config.yaml")

    # Load YAML first as defaults
    with open(config_path, "r") as file:
        configs = yaml.safe_load(file)

    # Override with environment variables (higher priority)
    # Convert string 'true'/'false' to boolean for specific keys
    bool_keys = ['WEB_HEADLESS', 'OPTIMIZE_IMAGES', 'DOC_REFINE', 'DARK_MODE', 'USE_JSON_MODE', 'USE_STREAMING']
    int_keys = ['MAX_TOKENS', 'REQUEST_INTERVAL', 'WEB_VIEWPORT_WIDTH', 'WEB_VIEWPORT_HEIGHT',
                'IMAGE_MAX_WIDTH', 'IMAGE_MAX_HEIGHT', 'IMAGE_QUALITY', 'MAX_ROUNDS', 'MIN_DIST',
                'REQUEST_TIMEOUT', 'QWEN3_TIMEOUT']
    float_keys = ['TEMPERATURE']

    for key in configs.keys():
        if key in os.environ:
            value = os.environ[key]
            # Type conversion
            if key in bool_keys:
                configs[key] = value.lower() in ('true', '1', 'yes')
            elif key in int_keys:
                configs[key] = int(value)
            elif key in float_keys:
                configs[key] = float(value)
            else:
                configs[key] = value

    # New unified model configuration (from Electron app)
    # These override the legacy MODEL/API_MODEL/LOCAL_MODEL settings
    if 'MODEL_PROVIDER' in os.environ:
        configs['MODEL_PROVIDER'] = os.environ['MODEL_PROVIDER']
    if 'MODEL_NAME' in os.environ:
        configs['MODEL_NAME'] = os.environ['MODEL_NAME']
    if 'API_KEY' in os.environ:
        configs['API_KEY'] = os.environ['API_KEY']
    if 'API_BASE_URL' in os.environ:
        configs['API_BASE_URL'] = os.environ['API_BASE_URL']

    return configs
