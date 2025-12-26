"""
Default Connector - Adapter for standard VLM models (GPT-4, Gemini, etc.)

This connector uses the original AppAgent prompt format:
- Label-based UI element identification
- Observation/Thought/Action/Summary output format
"""

import re
import json
from typing import Dict, Any, List, Optional

from .base import BaseConnector


class DefaultConnector(BaseConnector):
    """
    Default connector for general-purpose VLMs (GPT-4, Gemini, Qwen, etc.)
    
    Uses AppAgent's original label-based approach:
    - Screenshots with numbered UI element labels
    - tap(5), swipe(21, "up", "medium") style actions
    """
    
    @property
    def name(self) -> str:
        return "default"
    
    @property
    def action_format(self) -> str:
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
        Generate AppAgent-style prompt.
        
        This is a simplified version - the full prompts are in 
        engines/appagent/scripts/prompts.py
        """
        # For now, return a basic prompt - the full implementation
        # uses the templates from prompts.py
        ui_doc = kwargs.get('ui_document', '')
        
        prompt = f"""You are an agent that is trained to perform some basic tasks on a smartphone. You will be given a smartphone screenshot. The interactive UI elements on the screenshot are labeled with numeric tags starting from 1.

You can call the following functions to control the smartphone:

1. tap(element: int) - tap(5) taps the UI element labeled with number 5
2. text(text_input: str) - text("Hello") inserts text
3. long_press(element: int) - long_press(5) long presses element 5
4. swipe(element: int, direction: str, dist: str) - swipe(21, "up", "medium")
5. grid() - Show grid overlay for precise interaction

{ui_doc}
The task you need to complete is to {task}. Your past actions: {history if history else 'None'}

Your output should include:
Observation: <What you observe>
Thought: <What you should do next>
Action: <Function call or FINISH>
Summary: <Summarize your actions>

Respond with valid JSON:
{{"Observation": "...", "Thought": "...", "Action": "...", "Summary": "..."}}
"""
        return prompt
    
    def parse_response(self, response: str) -> Dict[str, Any]:
        """
        Parse AppAgent format response.
        
        Supports both JSON and text formats.
        """
        # Try JSON first
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
        # Find JSON object
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
        action_parsed = self._parse_action_string(action)
        result.update(action_parsed)
        
        return result
    
    def _regex_parse(self, response: str) -> Dict[str, Any]:
        """Parse response using regex."""
        observation = re.findall(r"Observation: (.*?)$", response, re.MULTILINE)
        thought = re.findall(r"Thought: (.*?)$", response, re.MULTILINE)
        action = re.findall(r"Action: (.*?)$", response, re.MULTILINE)
        summary = re.findall(r"Summary: (.*?)$", response, re.MULTILINE)
        
        result = {
            'observation': observation[0].strip() if observation else '',
            'thought': thought[0].strip() if thought else '',
            'summary': summary[0].strip() if summary else 'No summary',
            'raw_action': action[0].strip() if action else '',
        }
        
        if action:
            action_parsed = self._parse_action_string(action[0].strip())
            result.update(action_parsed)
        else:
            result['action_type'] = 'ERROR'
        
        return result
    
    def _parse_action_string(self, action: str) -> Dict[str, Any]:
        """Parse action string like 'tap(5)' into structured format."""
        if "FINISH" in action:
            return {'action_type': 'FINISH'}
        
        action_name = action.split("(")[0].strip()
        
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
            elif action_name == "grid":
                return {'action_type': 'grid'}
            else:
                return {'action_type': 'ERROR', 'value': f'Unknown action: {action_name}'}
        except (IndexError, ValueError) as e:
            return {'action_type': 'ERROR', 'value': str(e)}
