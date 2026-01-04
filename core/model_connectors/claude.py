"""
Claude Connector - Adapter for Anthropic Claude models (Sonnet, Haiku).

Claude Sonnet and Haiku models tend to output pixel coordinates rather than
UI element labels. This connector:
1. Uses coordinate-based prompts (no element labeling on screenshots)
2. Parses tap(x, y) style coordinate responses
3. Normalizes to AppAgent compatible format

IMPORTANT: Claude outputs ACTUAL PIXEL coordinates (not 0-1000 normalized).
The prompt tells Claude the actual screen size, so it returns actual pixel coords.
"""

import re
from typing import Dict, Any, List, Optional

from .base import BaseConnector


class ClaudeConnector(BaseConnector):
    """
    Connector for Claude Sonnet and Haiku models.
    
    These models naturally think in visual coordinates rather than UI element
    labels. Instead of fighting this behavior, we embrace it:
    - Screenshots are sent WITHOUT numeric element labels
    - Prompts instruct the model to output pixel coordinates
    - Responses in tap(x, y) format are parsed and converted
    """
    
    @property
    def name(self) -> str:
        return "claude"
    
    @property
    def action_format(self) -> str:
        return "coords"
    
    def make_prompt(
        self,
        task: str,
        image_path: str,
        history: str = "",
        ui_elements: Optional[List[Dict]] = None,
        **kwargs
    ) -> str:
        """
        Generate coordinate-based prompt for Claude models.
        
        Note: ui_elements is ignored as we use unlabeled screenshots.
        """
        prompt = f"""You are an AI agent that controls a smartphone. You will be given a screenshot of a smartphone app.

## Coordinate System (IMPORTANT!)
- Use NORMALIZED coordinates from 0 to 1000
- Origin (0, 0) at top-left corner
- X-axis: Left (0) to Right (1000)
- Y-axis: Top (0) to Bottom (1000)
- Example: tap(500, 500) = center of screen
- Example: tap(950, 50) = top-right corner
- Example: tap(50, 950) = bottom-left corner

## Available Actions

1. tap(x, y)
   Tap at normalized coordinates (0-1000 range).
   Example: tap(500, 100) - taps center-top area
   Example: tap(900, 50) - taps top-right corner

2. text(content)
   Type text. Only use when a text field is focused and keyboard is visible.
   Example: text("Hello world")

3. long_press(x, y)
   Long press at normalized coordinates.
   Example: long_press(500, 500) - long press center

4. swipe(x1, y1, x2, y2)
   Swipe from start to end using normalized coordinates.
   Example: swipe(500, 700, 500, 300) - swipe up

5. FINISH
   Report when the task is complete.

## Task
{task}

## Previous Actions
{history if history else 'None'}

## Instructions
Look at the screenshot and determine what action to take next.

Your output MUST be in this exact JSON format:
{{
    "Observation": "What you see on the screen",
    "Thought": "Your reasoning about what to do next",
    "Action": "tap(x, y) or text(...) or swipe(...) or FINISH",
    "Summary": "Brief summary of your action"
}}

CRITICAL: All coordinates MUST be in 0-1000 normalized range!
- To tap something on the RIGHT side of screen, use x close to 1000
- To tap something on the LEFT side of screen, use x close to 0
- To tap something at the TOP of screen, use y close to 0
- To tap something at the BOTTOM of screen, use y close to 1000
"""
        return prompt
    
    def parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse Claude's coordinate-based response.
        
        Handles formats like:
        - tap(672, 150)
        - tap(672,150)
        - tap(672)  (single coordinate - likely an error, but handle it)
        """
        import json
        
        # Try JSON parsing first
        try:
            data = self._extract_json(response)
            return self._json_to_standard(data)
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Fallback to regex
        try:
            return self._regex_parse(response)
        except Exception:
            return {
                'action_type': 'ERROR',
                'observation': '',
                'thought': '',
                'summary': '',
                'raw_action': response,
                'value': 'Failed to parse response'
            }
    
    def _extract_json(self, response: str) -> Dict:
        """Extract JSON from response."""
        import json
        start = response.find('{')
        end = response.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
        raise ValueError("No JSON found")
    
    def _json_to_standard(self, data: Dict) -> Dict[str, Any]:
        """Convert JSON response to standard format."""
        observation = data.get('Observation') or data.get('observation', '')
        thought = data.get('Thought') or data.get('thought', '')
        action = data.get('Action') or data.get('action', '')
        summary = data.get('Summary') or data.get('summary', 'No summary')
        
        result = {
            'observation': observation,
            'thought': thought,
            'summary': summary,
            'raw_action': action,
        }
        
        # Parse action
        action_parsed = self._parse_coordinate_action(action)
        result.update(action_parsed)
        
        return result
    
    def _regex_parse(self, response: str) -> Dict[str, Any]:
        """Parse response using regex."""
        observation = re.findall(r"Observation:\s*(.*?)(?=Thought:|$)", response, re.DOTALL | re.IGNORECASE)
        thought = re.findall(r"Thought:\s*(.*?)(?=Action:|$)", response, re.DOTALL | re.IGNORECASE)
        action = re.findall(r"Action:\s*(.*?)(?=Summary:|$)", response, re.DOTALL | re.IGNORECASE)
        summary = re.findall(r"Summary:\s*(.*?)$", response, re.DOTALL | re.IGNORECASE)
        
        result = {
            'observation': observation[0].strip() if observation else '',
            'thought': thought[0].strip() if thought else '',
            'summary': summary[0].strip() if summary else 'No summary',
            'raw_action': action[0].strip() if action else '',
        }
        
        if action:
            action_parsed = self._parse_coordinate_action(action[0].strip())
            result.update(action_parsed)
        else:
            result['action_type'] = 'ERROR'
        
        return result
    
    def _parse_coordinate_action(self, action: str) -> Dict[str, Any]:
        """
        Parse coordinate-based action string.
        
        Handles:
        - tap(672, 150)
        - tap(672,150)
        - tap(672)  (single value - treat as x-coordinate only, use center y)
        - text("hello")
        - swipe(100, 200, 100, 800)
        - long_press(500, 500)
        - FINISH
        """
        action = action.strip()
        
        if "FINISH" in action.upper():
            return {'action_type': 'FINISH'}
        
        # Extract action name
        action_name = action.split("(")[0].strip().lower()
        
        try:
            if action_name == "tap":
                coords = self._extract_coords(action, "tap")
                if len(coords) == 1:
                    # Single coordinate - might be x only, assume center y
                    # This handles Claude's tap(665) style output
                    return {
                        'action_type': 'tap_coords',
                        'target': [coords[0], 1496],  # Default to vertical center
                        'partial_coords': True  # Flag that we guessed y
                    }
                return {
                    'action_type': 'tap_coords',
                    'target': [coords[0], coords[1]]
                }
                
            elif action_name == "text":
                text_match = re.search(r'text\(["\'](.+?)["\']\)', action)
                if text_match:
                    return {'action_type': 'text', 'value': text_match.group(1)}
                return {'action_type': 'ERROR', 'value': 'Could not parse text action'}
                
            elif action_name == "long_press":
                coords = self._extract_coords(action, "long_press")
                return {
                    'action_type': 'long_press_coords',
                    'target': [coords[0], coords[1]]
                }
                
            elif action_name == "swipe":
                coords = self._extract_coords(action, "swipe")
                if len(coords) >= 4:
                    return {
                        'action_type': 'swipe_coords',
                        'target': [coords[0], coords[1]],
                        'end_point': [coords[2], coords[3]]
                    }
                return {'action_type': 'ERROR', 'value': 'Swipe requires 4 coordinates'}
                
            else:
                return {'action_type': 'ERROR', 'value': f'Unknown action: {action_name}'}
                
        except (IndexError, ValueError) as e:
            return {'action_type': 'ERROR', 'value': f'Parse error: {str(e)}'}
    
    def _extract_coords(self, action: str, action_name: str) -> List[int]:
        """
        Extract coordinates from action string.
        
        Handles various formats:
        - tap(672, 150)
        - tap(672,150)
        - tap(672)
        """
        # Match content inside parentheses
        match = re.search(rf'{action_name}\s*\(([^)]+)\)', action, re.IGNORECASE)
        if not match:
            return []
        
        content = match.group(1)
        # Split by comma or space, filter empty, convert to int
        parts = re.split(r'[,\s]+', content.strip())
        coords = []
        for part in parts:
            part = part.strip()
            if part:
                try:
                    coords.append(int(float(part)))
                except ValueError:
                    continue
        return coords
    
    def convert_coords_to_pixels(
        self,
        point: List[int],
        device_size: tuple
    ) -> tuple:
        """
        Convert Claude's normalized coordinates (0-1000) to device pixels.
        
        Claude is instructed to output coordinates in 0-1000 normalized range.
        This makes the coordinates independent of image size/resizing.
        
        Args:
            point: [x, y] normalized coordinates (0-1000 range)
            device_size: (width, height) in pixels
            
        Returns:
            (x, y) pixel coordinates
        """
        # Convert from 0-1000 normalized to device pixels
        x = int(point[0] / 1000 * device_size[0])
        y = int(point[1] / 1000 * device_size[1])
        
        # Clamp to screen bounds
        x = max(0, min(x, device_size[0] - 1))
        y = max(0, min(y, device_size[1] - 1))
        return (x, y)

