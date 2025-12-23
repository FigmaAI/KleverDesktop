"""
JSON Response Schemas for AppAgent

Pydantic models defining structured output formats for LLM responses.
Used with LiteLLM's JSON mode (response_format parameter) for reliable parsing.
"""
from typing import Literal, Union, Optional
from pydantic import BaseModel, Field


# =============================================================================
# Action Types for Exploration Stage
# =============================================================================

class TapAction(BaseModel):
    """Tap on a UI element"""
    action_type: Literal["tap"] = "tap"
    element: int = Field(..., description="UI element number to tap")


class TextAction(BaseModel):
    """Enter text input"""
    action_type: Literal["text"] = "text"
    text_input: str = Field(..., description="Text to input")


class LongPressAction(BaseModel):
    """Long press on a UI element"""
    action_type: Literal["long_press"] = "long_press"
    element: int = Field(..., description="UI element number to long press")


class SwipeAction(BaseModel):
    """Swipe on a UI element"""
    action_type: Literal["swipe"] = "swipe"
    element: int = Field(..., description="UI element number to swipe")
    direction: Literal["up", "down", "left", "right"] = Field(..., description="Swipe direction")
    dist: Literal["short", "medium", "long"] = Field(..., description="Swipe distance")


class GridAction(BaseModel):
    """Activate grid mode for precise positioning"""
    action_type: Literal["grid"] = "grid"


class FinishAction(BaseModel):
    """Task completed"""
    action_type: Literal["FINISH"] = "FINISH"


# Union type for all exploration actions
ExploreAction = Union[TapAction, TextAction, LongPressAction, SwipeAction, GridAction, FinishAction]


# =============================================================================
# Exploration Stage Response Schema
# =============================================================================

class ExploreResponse(BaseModel):
    """Response schema for exploration stage"""
    observation: str = Field(..., description="What is observed in the image")
    thought: str = Field(..., description="Reasoning about the next step")
    action: ExploreAction = Field(..., description="The action to perform")
    summary: str = Field(..., description="Summary of past actions including the latest")


# =============================================================================
# Action Types for Grid Mode
# =============================================================================

SUBAREA_OPTIONS = Literal[
    "center", "top-left", "top", "top-right", 
    "left", "right", 
    "bottom-left", "bottom", "bottom-right"
]


class TapGridAction(BaseModel):
    """Tap on a grid area"""
    action_type: Literal["tap"] = "tap"
    area: int = Field(..., description="Grid area number")
    subarea: SUBAREA_OPTIONS = Field(..., description="Position within the grid area")


class LongPressGridAction(BaseModel):
    """Long press on a grid area"""
    action_type: Literal["long_press"] = "long_press"
    area: int = Field(..., description="Grid area number")
    subarea: SUBAREA_OPTIONS = Field(..., description="Position within the grid area")


class SwipeGridAction(BaseModel):
    """Swipe from one grid area to another"""
    action_type: Literal["swipe"] = "swipe"
    start_area: int = Field(..., description="Starting grid area number")
    start_subarea: SUBAREA_OPTIONS = Field(..., description="Starting position within grid area")
    end_area: int = Field(..., description="Ending grid area number")
    end_subarea: SUBAREA_OPTIONS = Field(..., description="Ending position within grid area")


# Union type for all grid mode actions
GridModeAction = Union[TapGridAction, LongPressGridAction, SwipeGridAction, FinishAction]


# =============================================================================
# Grid Mode Response Schema
# =============================================================================

class GridResponse(BaseModel):
    """Response schema for grid mode"""
    observation: str = Field(..., description="What is observed in the image")
    thought: str = Field(..., description="Reasoning about the next step")
    action: GridModeAction = Field(..., description="The grid-based action to perform")
    summary: str = Field(..., description="Summary of past actions including the latest")


# =============================================================================
# Reflection Stage Response Schema
# =============================================================================

class ReflectResponse(BaseModel):
    """Response schema for reflection stage (comparing before/after screenshots)"""
    decision: Literal["BACK", "INEFFECTIVE", "CONTINUE", "SUCCESS"] = Field(
        ..., 
        description="Decision about the action's effectiveness"
    )
    thought: str = Field(..., description="Reasoning about the decision")
    documentation: Optional[str] = Field(
        None, 
        description="Documentation of the UI element's function (required for BACK, CONTINUE, SUCCESS)"
    )


# =============================================================================
# Helper Functions
# =============================================================================

def get_schema_for_stage(stage: str) -> type[BaseModel]:
    """Get the appropriate schema class for a given stage"""
    schemas = {
        "explore": ExploreResponse,
        "grid": GridResponse,
        "reflect": ReflectResponse,
    }
    return schemas.get(stage, ExploreResponse)


def parse_action_to_function_call(action: ExploreAction) -> str:
    """Convert structured action to function call string (for backward compatibility)"""
    if isinstance(action, TapAction):
        return f"tap({action.element})"
    elif isinstance(action, TextAction):
        return f'text("{action.text_input}")'
    elif isinstance(action, LongPressAction):
        return f"long_press({action.element})"
    elif isinstance(action, SwipeAction):
        return f'swipe({action.element}, "{action.direction}", "{action.dist}")'
    elif isinstance(action, GridAction):
        return "grid()"
    elif isinstance(action, FinishAction):
        return "FINISH"
    else:
        return str(action)


def parse_grid_action_to_function_call(action: GridModeAction) -> str:
    """Convert structured grid action to function call string (for backward compatibility)"""
    if isinstance(action, TapGridAction):
        return f'tap({action.area}, "{action.subarea}")'
    elif isinstance(action, LongPressGridAction):
        return f'long_press({action.area}, "{action.subarea}")'
    elif isinstance(action, SwipeGridAction):
        return f'swipe({action.start_area}, "{action.start_subarea}", {action.end_area}, "{action.end_subarea}")'
    elif isinstance(action, FinishAction):
        return "FINISH"
    else:
        return str(action)

