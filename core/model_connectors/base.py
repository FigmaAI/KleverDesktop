"""
Base Connector - Abstract interface for model-specific prompt/parser connectors.

Each connector handles:
1. Prompt generation for a specific model type
2. Response parsing to extract actions
3. Action format normalization for AppAgent compatibility
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


# =============================================================================
# Model Categories - Determines which connector and prompt style to use
# =============================================================================

# Models that naturally think in pixel coordinates rather than UI element labels
# These models will receive unlabeled screenshots and coordinate-based prompts
COORDINATE_BASED_MODELS = [
    # GELab models - designed for coordinate-based GUI automation
    "gelab",
    
    # Note: Claude models removed - they work better with labeled UI elements
    # Coordinate-based approach had issues with image resizing in API
]

# Models that work well with labeled UI elements (default behavior)
# No need to list - all models not in COORDINATE_BASED_MODELS use labels
LABEL_BASED_MODELS = [
    "gpt-",
    "gemini-",
    "grok-",  # Grok works well with labeled screenshots
]


def is_coordinate_based_model(model_name: str) -> bool:
    """
    Check if a model prefers coordinate-based interaction.
    
    Args:
        model_name: Full model name (e.g., 'openrouter/anthropic/claude-sonnet-4.5')
        
    Returns:
        True if model should use coordinate-based prompts
    """
    model_lower = model_name.lower()
    return any(coord_model in model_lower for coord_model in COORDINATE_BASED_MODELS)


class BaseConnector(ABC):
    """
    Abstract base class for model-specific connectors.
    
    Each connector adapts a specific model's prompt format and response parsing
    to work with AppAgent's execution layer.
    """
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Connector name (e.g., 'gelab', 'default')"""
        pass
    
    @property
    @abstractmethod
    def action_format(self) -> str:
        """
        Action format this connector produces.
        
        Returns:
            'label': Uses element IDs (e.g., tap(5))
            'coords': Uses pixel coordinates (e.g., tap_coords(x, y))
        """
        pass
    
    @abstractmethod
    def make_prompt(
        self,
        task: str,
        image_path: str,
        history: str = "",
        ui_elements: Optional[List[Dict]] = None,
        **kwargs
    ) -> str:
        """
        Generate model-specific prompt.
        
        Args:
            task: Task description
            image_path: Path to screenshot
            history: Action history summary
            ui_elements: Optional list of detected UI elements (for label-based)
            **kwargs: Additional model-specific parameters
            
        Returns:
            Formatted prompt string
        """
        pass
    
    @abstractmethod
    def parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse model response into standardized action format.
        
        Args:
            response: Raw model response string
            
        Returns:
            Standardized action dict with keys:
                - action_type: str (tap, tap_coords, text, swipe, etc.)
                - target: element ID or (x, y) coords depending on action_format
                - value: Optional value (for text input)
                - summary: Action summary for history
                - observation: What the model observed
                - thought: Model's reasoning
                - raw_action: Original action string
        """
        pass
    
    def convert_coords_to_pixels(
        self,
        point: List[int],
        device_size: tuple
    ) -> tuple:
        """
        Convert model-output coordinates to device pixels.
        
        Override this in subclasses for model-specific coordinate systems:
        - GELab uses 0-1000 normalized range
        - Claude/Grok use actual pixel coordinates
        
        Default behavior: normalize from 0-1000 range.
        
        Args:
            point: [x, y] coordinates from model
            device_size: (width, height) in pixels
            
        Returns:
            (x, y) pixel coordinates
        """
        # Default: assume 0-1000 normalized coordinates (GELab style)
        x = int(point[0] / 1000 * device_size[0])
        y = int(point[1] / 1000 * device_size[1])
        return (x, y)


def get_connector(model_name: str) -> BaseConnector:
    """
    Get appropriate connector for a model.
    
    Routes models to the correct connector based on their interaction style:
    - GELab models → GELabConnector (action:CLICK\tpoint:x,y format)
    - Coordinate-based models (Claude, Grok) → ClaudeConnector (tap(x, y) format)
    - Others → DefaultConnector (tap(element_id) label format)
    
    Args:
        model_name: Model name (e.g., 'openrouter/anthropic/claude-sonnet-4.5')
        
    Returns:
        Connector instance
    """
    model_lower = model_name.lower()
    
    # GELab uses its own special format (action:CLICK\tpoint:x,y)
    if "gelab" in model_lower:
        from .gelab import GELabConnector
        return GELabConnector()
    
    # Check if model is in coordinate-based list (excluding gelab which has its own format)
    # These models prefer tap(x, y) coordinate format
    coord_models = [m for m in COORDINATE_BASED_MODELS if m != "gelab"]
    if any(coord_model in model_lower for coord_model in coord_models):
        from .claude import ClaudeConnector
        return ClaudeConnector()
    
    # Default: label-based approach (GPT, Gemini, etc.)
    from .default import DefaultConnector
    return DefaultConnector()
