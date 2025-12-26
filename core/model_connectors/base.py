"""
Base Connector - Abstract interface for model-specific prompt/parser connectors.

Each connector handles:
1. Prompt generation for a specific model type
2. Response parsing to extract actions
3. Action format normalization for AppAgent compatibility
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional


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
        Convert normalized coordinates (0-1000) to device pixels.
        
        Args:
            point: [x, y] normalized coordinates (0-1000 range)
            device_size: (width, height) in pixels
            
        Returns:
            (x, y) pixel coordinates
        """
        x = int(point[0] / 1000 * device_size[0])
        y = int(point[1] / 1000 * device_size[1])
        return (x, y)


def get_connector(model_name: str) -> BaseConnector:
    """
    Get appropriate connector for a model.
    
    Args:
        model_name: Model name (e.g., 'ollama/gelab-zero-4b-preview')
        
    Returns:
        Connector instance
    """
    model_lower = model_name.lower()
    
    if "gelab" in model_lower:
        from .gelab import GELabConnector
        return GELabConnector()
    else:
        from .default import DefaultConnector
        return DefaultConnector()
