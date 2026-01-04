# Model Connectors
# Provides prompt templates and response parsers for different model types

from .base import (
    BaseConnector,
    get_connector,
    is_coordinate_based_model,
    COORDINATE_BASED_MODELS,
    LABEL_BASED_MODELS,
)
from .default import DefaultConnector
from .gelab import GELabConnector

__all__ = [
    'BaseConnector',
    'DefaultConnector',
    'GELabConnector',
    'get_connector',
    'is_coordinate_based_model',
    'COORDINATE_BASED_MODELS',
    'LABEL_BASED_MODELS',
]
