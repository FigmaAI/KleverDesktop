"""
GELab Connector - Adapter for GELab-Zero-4B-preview model.

This connector handles:
1. GELab-style prompts (coordinate-based, 0-1000 normalized)
2. Response parsing (<THINK> tags + tab-separated key-values)
3. Action normalization to AppAgent compatible format
"""

import re
from typing import Dict, Any, List, Optional
from collections import OrderedDict

from .base import BaseConnector


class GELabConnector(BaseConnector):
    """
    Connector for GELab-Zero-4B-preview and similar GUI-specialized models.
    
    Key differences from default AppAgent models:
    - Uses raw screenshots (no UI element labeling)
    - Outputs coordinates in 0-1000 normalized range
    - Uses <THINK> tags for chain-of-thought
    - Tab-separated key-value output format
    """
    
    SYSTEM_PROMPT = """You are a mobile GUI-Agent automation expert. Based on the user's task, mobile screen screenshots, and interaction history, you need to interact with the phone using the defined action space to complete the user's task.
Remember, the phone screen coordinate system has the origin at the top-left corner, with the x-axis pointing right and y-axis pointing down. The value range is 0-1000 for both axes.

# Action Principles:

1. You must clearly track your previous action. If it's a swipe, do not exceed 5 consecutive swipes.
2. You must strictly follow the user's instructions. If you have had a conversation with the user, pay more attention to the latest instruction.

# Action Space:

In the Android phone scenario, your action space includes the following 9 types of operations. All outputs must follow the corresponding parameter requirements:
1. CLICK: Click on screen coordinates. Requires the click position point.
Example: action:CLICK\tpoint:x,y
2. TYPE: Input text in a text field. Requires the input content value and input field position point.
Example: action:TYPE\tvalue:input content\tpoint:x,y
3. COMPLETE: Report results to user after task completion. Requires the report content value.
Example: action:COMPLETE\treturn:content to report to user after completing the task
4. WAIT: Wait for a specified duration. Requires wait time value (in seconds).
Example: action:WAIT\tvalue:wait time
5. AWAKE: Wake up/launch a specified app. Requires the app name value.
Example: action:AWAKE\tvalue:app name
6. INFO: Ask user questions or request detailed information. Requires question content value.
Example: action:INFO\tvalue:question content
7. ABORT: Terminate current task. Use only when task cannot continue. Requires value explaining the reason.
Example: action:ABORT\tvalue:reason for terminating task
8. SLIDE: Swipe on mobile screen. Any direction allowed. Requires start point point1 and end point point2.
Example: action:SLIDE\tpoint1:x1,y1\tpoint2:x2,y2
9. LONGPRESS: Long press on screen coordinates. Requires the long press position point.
Example: action:LONGPRESS\tpoint:x,y
"""

    OUTPUT_INSTRUCTION = """Before executing any action, please review your action history and the defined action space. First think and explain, then output the action and corresponding parameters:
1. Thinking (THINK): Between <THINK> and </THINK> tags.
2. Explanation (explain): In the action format, use explain: prefix to briefly describe the purpose and execution method of the current action.
After executing the action, output a new history summary including the current step.
Output format example:
<THINK>thinking content</THINK>
explain:explanation content\taction:action and parameters\tsummary:new history summary after current step
"""

    @property
    def name(self) -> str:
        return "gelab"
    
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
        Generate GELab-style prompt.
        
        Note: ui_elements is ignored as GELab uses raw screenshots.
        """
        history_display = history if history.strip() else "No previous actions"
        
        prompt = f"""{self.SYSTEM_PROMPT}

User instruction: {task}
Previously executed actions: {history_display}
Current mobile screen screenshot:
[IMAGE]

{self.OUTPUT_INSTRUCTION}"""
        
        return prompt
    
    def parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse GELab format response.
        
        Expected format:
        <THINK>thinking content</THINK>
        explain:xxx\taction:CLICK\tpoint:500,300\tsummary:xxx
        """
        response = response.strip()
        
        # Normalize THINK tags
        response = self._normalize_think_tags(response)
        
        # Extract CoT and key-value parts
        try:
            cot_part = response.split("<THINK>")[1].split("</THINK>")[0].strip()
            kv_part = response.split("</THINK>")[1].strip()
        except IndexError:
            # No THINK tags, treat entire response as kv
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
                # Parse point format: "x,y" or "x y"
                try:
                    coords = value.replace(",", " ").split()
                    if len(coords) >= 2:
                        x, y = int(coords[0]), int(coords[1])
                        action[key] = [x, y]
                except (ValueError, IndexError):
                    action[key] = value
            elif key == "value" or key == "return":
                action[key] = value
        
        # Convert to standardized format
        return self._to_standard_format(action)
    
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
    
    def _to_standard_format(self, parsed: Dict) -> Dict[str, Any]:
        """Convert parsed GELab action to standardized AppAgent format."""
        action_type = parsed.get('action', '').upper()
        
        result = {
            'observation': parsed.get('explain', ''),
            'thought': parsed.get('cot', ''),
            'summary': parsed.get('summary', 'No summary available'),
            'raw_action': f"action:{action_type}",
        }
        
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
