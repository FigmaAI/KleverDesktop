"""
GELab Connector - Adapter for GELab-Zero-4B-preview model.

UNIFIED LABEL-BASED APPROACH:
This connector has been updated to use label-based UI element identification
instead of coordinate-based output. This provides:
1. Consistent behavior with other VLM models (GPT, Gemini, Claude)
2. Simpler execution flow (no coordinate conversion needed)
3. Better accuracy through explicit UI element labeling

The model receives labeled screenshots and outputs tap(n) style actions.
"""

import re
from typing import Dict, Any, List, Optional

from .base import BaseConnector


class GELabConnector(BaseConnector):
    """
    Connector for GELab-Zero-4B-preview and similar GUI-specialized models.
    
    Updated to use label-based approach:
    - Screenshots WITH numbered UI element labels
    - Outputs element IDs like tap(5), not coordinates
    - Same format as DefaultConnector for unified execution
    """
    
    SYSTEM_PROMPT = """You are a mobile GUI-Agent automation expert. Based on the user's task, mobile screen screenshots, and interaction history, you need to interact with the phone using the defined action space.

IMPORTANT: The screenshot shows numbered labels on interactive UI elements. Each number is displayed at the CENTER of the UI element. Use these NUMBERS in your actions, NOT pixel coordinates.

# Action Space:

1. tap(element: int)
   Tap the UI element with the given number.
   Example: tap(5) - taps the element labeled "5"

2. text(text_input: str)
   Type text into the currently focused input field.
   Example: text("Hello world")

3. long_press(element: int)
   Long press the UI element with the given number.
   Example: long_press(3)

4. swipe(element: int, direction: str, dist: str)
   Swipe on the element. direction: "up", "down", "left", "right". dist: "short", "medium", "long"
   Example: swipe(7, "up", "medium")

5. FINISH
   Report when the task is complete.
"""

    OUTPUT_INSTRUCTION = """Before executing any action, think step by step:
1. Look at the numbered labels on the screenshot
2. Identify which labeled element to interact with
3. Choose the appropriate action

Output format (JSON):
{
    "Observation": "What you see on the screen, including the numbered labels",
    "Thought": "Your reasoning about which labeled element to interact with",
    "Action": "tap(5) or text(...) or swipe(...) or FINISH",
    "Summary": "Brief summary of your action"
}

CRITICAL: Use element NUMBERS like tap(3), NOT coordinates like tap(500, 200)!
"""

    @property
    def name(self) -> str:
        return "gelab"
    
    @property
    def action_format(self) -> str:
        # Changed from "coords" to "label"
        return "label"
    
    def make_prompt(
        self,
        task: str,
        image_path: str,
        history: str = "",
        ui_elements: Optional[List[Dict]] = None,
        **kwargs
    ) -> str:
        """
        Generate label-based prompt for GELab model.
        
        Note: Now expects labeled screenshots (same as DefaultConnector).
        """
        history_display = history if history.strip() else "No previous actions"
        
        prompt = f"""{self.SYSTEM_PROMPT}

User instruction: {task}
Previously executed actions: {history_display}
Current mobile screen screenshot (with numbered element labels):
[IMAGE]

{self.OUTPUT_INSTRUCTION}"""
        
        return prompt
    
    def parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse GELab response - now supports both legacy and new format.
        
        New format (JSON with label-based actions):
        {"Observation": "...", "Thought": "...", "Action": "tap(5)", "Summary": "..."}
        
        Legacy format (for backward compatibility):
        <THINK>thinking</THINK>
        explain:xxx\taction:CLICK\tpoint:500,300\tsummary:xxx
        """
        import json
        response = response.strip()
        
        # Try JSON format first (new label-based format)
        try:
            data = self._extract_json(response)
            return self._json_to_standard(data)
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Fallback to legacy coordinate format (for backward compatibility)
        # This path will be removed once we confirm label-based works
        return self._parse_legacy_format(response)
    
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
        
        # Parse label-based action
        action_parsed = self._parse_label_action(action)
        result.update(action_parsed)
        
        return result
    
    def _parse_label_action(self, action: str) -> Dict[str, Any]:
        """Parse label-based action string like 'tap(5)'."""
        action = action.strip()
        
        if "FINISH" in action.upper():
            return {'action_type': 'FINISH'}
        
        action_name = action.split("(")[0].strip().lower()
        
        try:
            if action_name == "tap":
                element = int(re.findall(r"tap\((\d+)\)", action)[0])
                return {'action_type': 'tap', 'target': element}
            elif action_name == "text":
                text = re.findall(r'text\(["\'](.+?)["\']\)', action)[0]
                return {'action_type': 'text', 'value': text}
            elif action_name == "long_press":
                element = int(re.findall(r"long_press\((\d+)\)", action)[0])
                return {'action_type': 'long_press', 'target': element}
            elif action_name == "swipe":
                params = re.findall(r"swipe\((.+?)\)", action)[0]
                parts = [p.strip().strip('"\'') for p in params.split(",")]
                return {
                    'action_type': 'swipe',
                    'target': int(parts[0]),
                    'direction': parts[1],
                    'distance': parts[2]
                }
            else:
                return {'action_type': 'ERROR', 'value': f'Unknown action: {action_name}'}
        except (IndexError, ValueError) as e:
            return {'action_type': 'ERROR', 'value': str(e)}
    
    def _parse_legacy_format(self, response: str) -> Dict[str, Any]:
        """
        Parse legacy GELab coordinate format (for backward compatibility).
        
        Format:
        <THINK>thinking content</THINK>
        explain:xxx\taction:CLICK\tpoint:500,300\tsummary:xxx
        """
        from collections import OrderedDict
        
        # Normalize THINK tags
        response = self._normalize_think_tags(response)
        
        # Extract CoT and key-value parts
        try:
            cot_part = response.split("<THINK>")[1].split("</THINK>")[0].strip()
            kv_part = response.split("</THINK>")[1].strip()
        except IndexError:
            kv_part = response
            cot_part = ""
        
        # Parse key-value pairs
        action = OrderedDict()
        action['cot'] = cot_part
        
        kvs = [kv.strip() for kv in kv_part.split("\t") if kv.strip()]
        
        for kv in kvs:
            if ":" not in kv:
                continue
            
            key = kv.split(":", 1)[0].strip()
            value = kv.split(":", 1)[1].strip()
            
            if key == "action":
                action['action'] = value
            elif key == "summary":
                action['summary'] = value
            elif key == "explain":
                action['explain'] = value
            elif "point" in key:
                try:
                    coords = value.replace(",", " ").split()
                    if len(coords) >= 2:
                        x, y = int(coords[0]), int(coords[1])
                        action[key] = [x, y]
                except (ValueError, IndexError):
                    action[key] = value
            elif key == "value" or key == "return":
                action[key] = value
        
        return self._legacy_to_standard(action)
    
    def _normalize_think_tags(self, text: str) -> str:
        """Normalize various THINK tag formats."""
        text = (
            text
            .replace("<TINK>", "<THINK>").replace("</TINK>", "</THINK>")
            .replace("<think>", "<THINK>").replace("</think>", "</THINK>")
        )
        text = re.sub(
            r"<\s*/?THINK\s*>", 
            lambda m: "<THINK>" if "/" not in m.group() else "</THINK>", 
            text, 
            flags=re.IGNORECASE
        )
        return text
    
    def _legacy_to_standard(self, parsed: Dict) -> Dict[str, Any]:
        """Convert parsed legacy GELab action to standardized format."""
        action_type = parsed.get('action', '').upper()
        
        result = {
            'observation': parsed.get('explain', ''),
            'thought': parsed.get('cot', ''),
            'summary': parsed.get('summary', 'No summary available'),
            'raw_action': f"action:{action_type}",
        }
        
        # Legacy format uses coordinates - convert to tap_coords for compatibility
        if action_type == 'CLICK':
            result['action_type'] = 'tap_coords'
            result['target'] = parsed.get('point', [0, 0])
        elif action_type == 'TYPE':
            result['action_type'] = 'text'
            result['value'] = parsed.get('value', '')
            result['target'] = parsed.get('point', [0, 0])
        elif action_type == 'SLIDE':
            result['action_type'] = 'swipe_coords'
            result['target'] = parsed.get('point1', [0, 0])
            result['end_point'] = parsed.get('point2', [0, 0])
        elif action_type == 'LONGPRESS':
            result['action_type'] = 'long_press_coords'
            result['target'] = parsed.get('point', [0, 0])
        elif action_type == 'COMPLETE':
            result['action_type'] = 'FINISH'
            result['value'] = parsed.get('return', '')
        elif action_type == 'ABORT':
            result['action_type'] = 'FINISH'
            result['value'] = parsed.get('value', 'Task aborted')
        elif action_type == 'WAIT':
            result['action_type'] = 'wait'
            result['value'] = parsed.get('value', '1')
        elif action_type == 'AWAKE':
            result['action_type'] = 'launch_app'
            result['value'] = parsed.get('value', '')
        elif action_type == 'INFO':
            result['action_type'] = 'ask_user'
            result['value'] = parsed.get('value', '')
        else:
            result['action_type'] = 'ERROR'
            result['value'] = f"Unknown action: {action_type}"
        
        return result
