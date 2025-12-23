import sys
import json
import os
import re

from collections import OrderedDict

import jsonlines
from megfile import smart_open

current_file = os.path.abspath(__file__)
current_dir = os.path.dirname(current_file)
sys.path.append(current_dir)

if "." not in sys.path:
    sys.path.append(".")

# from tools.prompt_tools import messages2sft

from copy import deepcopy


task_define_prompt = """You are a mobile GUI-Agent automation expert. Based on the user's task, mobile screen screenshots, and interaction history, you need to interact with the phone using the defined action space to complete the user's task.
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

def make_status_prompt(task, current_image, hints, summary_history="", user_comment=""):

    if len(hints) == 0:
        hint_str = ""
    else:
        hint_str = "\n".join([f"- {hint}" for hint in hints])
        hint_str = f"### HINT：\n{hint_str}\n"

    if user_comment == "":
        history_display = summary_history if summary_history.strip() else "No previous actions"
    else:
        history_display = summary_history + user_comment if summary_history.strip() else "No previous actions"

    user_instruction = f'''\n\n{user_comment}\n\n''' if user_comment != "" else ""
    task = task + user_instruction + "End of instructions\n\n"

    
    status_conversation = [
        {
            "type": "text",
            "text": f'''
User instruction: {task}
Previously executed actions: {history_display}
Current mobile screen screenshot:
'''
        },
        {
            "type": "image_url",
            "image_url": {"url": current_image}
        },
        {
            "type": "text",
            "text": f'''

Before executing any action, please review your action history and the defined action space. First think and explain, then output the action and corresponding parameters:
1. Thinking (THINK): Between <THINK> and </THINK> tags.
2. Explanation (explain): In the action format, use explain: prefix to briefly describe the purpose and execution method of the current action.
After executing the action, output a new history summary including the current step.
Output format example:
<THINK> thinking content </THINK>
explain:explanation content\taction:action and parameters\tsummary:new history summary after current step
'''
        }
    ]

    return status_conversation


class Parser0920Summary():
    def __init__(self, *args, **kwargs):
        # super().__init__(*args, **kwargs)
        pass

    def action2action(self, action):
        # assert single actions
        assert "action" in action or "action_type" in action, f"action {action} should have action or action_type field"
        assert "explain" in action, f"action {action} should have explain field"
        assert "cot" in action, f"action {action} should have cot field"

        explain = action['explain']
        cot = action['cot']
        summary = action.get('summary', '')  
        action_type = action.get('action_type', action.get('action', None))

        return_action = OrderedDict(
            {
                "cot": cot,
                "explain": explain,
                "action": action_type,
                "summary": summary
            }
        )


        if action_type == "TYPE":
            # assert "is_keyboard" in action or "keyboard_exists" in action, f"action {action} should have is_keyboard or keyboard_exists field"
            assert "value" in action, f"action {action} should have value field"
            # assert "point" in action, f"action {action} should have point field"
            
            keyboard_exists = action.get("is_keyboard", action.get("keyboard_exists", False))
            if type(keyboard_exists) == str:
                keyboard_exists = keyboard_exists.lower() == "true"

            # point = action['point'] 
            value = action['value']

            return_action.update({
                "value": value, 
                # "point": point, 
                # "keyboard_exists": keyboard_exists
            })

        elif action_type == "CLICK":
            assert "point" in action, f"action {action} should have point field"
            point = action['point']
            
            return_action.update({
                "point": point
            })

        elif action_type == "AWAKE":
            assert "value" in action, f"action {action} should have value field"
            value = action['value']

            return_action.update({
                "value": value
            })

        elif action_type == "INFO":
            assert "value" in action, f"action {action} should have value field"
            value = action['value']

            return_action.update({
                "value": value
            })

        elif action_type == "WAIT":
            assert "value" in action, f"action {action} should have value field"
            value = action['value']

            return_action.update({
                "value": value
            })

        elif action_type == "COMPLETE":
            assert "return" in action, f"action {action} should have return field"
            return_value = action['return']

            return_action.update({
                "return": return_value
            })

        
        elif action_type == "ABORT":

            pass

        
        elif action_type == "SLIDE":
            assert "point1" in action, f"action {action} should have point1 field"
            assert "point2" in action, f"action {action} should have point2 field"
            point1 = action['point1']
            point2 = action['point2']

            return_action.update({
                "point1": point1, 
                "point2": point2
            })


        elif action_type == "LONGPRESS":
            assert "point" in action, f"action {action} should have point field"
            point = action['point']

            return_action.update({
                "point": point
            })
        
        else:
            raise ValueError(f"Unknown action type {action_type} in action {action}")

        return return_action

    def action2str(self, actions):
        assert (type(actions) == list and len(actions) == 0) or type(actions) == dict or type(actions) == OrderedDict, f"actions {actions} should be a list or a dict; only one action is supported"

        if type(actions) == dict or type(actions) == OrderedDict:
            actions = [actions]
        # action = actions[0]
        action = deepcopy(actions[0])

        # assert action type field
        if "action" in action and "action_type" in action:
            assert action['action'] == action['action_type'], f"action {action} should have same action and action_type field"
            assert len(action['action']) > 0, f"action {action} should have non-empty action and action_type field"
            del action['action_type']

        action = self.action2action(action)

        kvs = []
        for key, value in action.items():
            key = key.strip()

            if key in ['cot']:
                continue
        
            if type(value) == list:
                value = ",".join([str(v).strip() for v in value])
            elif type(value) == bool:
                value = str(value).lower()
            elif type(value) == int or type(value) == float:
                value = str(value)
            else:
                value = value.replace("\n", "").replace("\t", "").strip()

            kvs.append(f"{key}:{value}")

        action_str = f"<THINK> {action['cot']} </THINK>\n" + "\t".join(kvs) + "\n"
        return action_str
    

    def str2action(self, command_str):
        command_str = command_str.strip()
        
        # Normalize THINK tags: fix typos, case, and spacing
        command_str = (
            command_str
            .replace("<TINK>", "<THINK>").replace("</TINK>", "</THINK>")
            .replace("<think>", "<THINK>").replace("</think>", "</THINK>")
        )
        command_str = re.sub(r"<\s*/?THINK\s*>", lambda m: "<THINK>" if "/" not in m.group() else "</THINK>", command_str, flags=re.IGNORECASE)
        
        # Extract CoT and key-value parts
        # Expected format: <THINK> cot </THINK>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx
        try:
            cot_part = command_str.split("<THINK>")[1].split("</THINK>")[0].strip()
            kv_part = command_str.split("</THINK>")[1].strip()
        except IndexError:
            print(f"[Parser Warning] Missing <THINK> tags, treating entire response as kv")
            kv_part = command_str
            cot_part = ""

        action = OrderedDict()
        action['cot'] = cot_part
        
        # FIX:issue 13
        # Error split by \n, should split by tab separator 
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
            elif "point" in key:
                # Parse point format: "x,y" or "x y"
                try:
                    # Replace comma with space for unified processing
                    coords = value.replace(",", " ").split()
                    if len(coords) < 2:
                        raise ValueError(f"Expected 2 coordinates, got {len(coords)}")
                    
                    x, y = int(coords[0]), int(coords[1])
                    action[key] = [x, y]
                    
                except (ValueError, IndexError) as e:
                    raise ValueError(
                        f"[Parser Error] Failed to parse point '{value}' for key '{key}': {str(e)}. "
                        f"Expected format: 'x,y' or 'x y' with integer values"
                    ) from e
            else:
                action[key] = value

        return action

    def env2messages4ask(self, task, environments, actions, markov_mode=False, return_sft = False, hints = [], ) -> list:

        assert len(environments) > 0, f"environments {environments} should not be empty"
        assert len(environments) - 1 == len(actions), f"environments {environments} should be one more than actions {actions}"
        
        # Use the summary of the last action as the historical summary
        summary_history = ""
        if len(actions) > 0:
            last_action = self.action2action(actions[-1])
            summary_history = last_action.get('summary', '')

        current_env = environments[-1]

        # user_comment = ""
        # if len(current_env['user_comment']) > 0:
            # user_comment = "用户回复说： "+ current_env['user_comment'].strip()

        historica_qa = []

        for idx in range(1, len(environments)):
            prev_act = actions[idx - 1]
            current_env = environments[idx]

            if prev_act['action'] == "INFO":
                q = prev_act['value']
                a = current_env['user_comment'].strip()
                historica_qa.append((q, a))
            elif current_env['user_comment'].strip() != "":
                q = "Instruction:"
                a = current_env['user_comment'].strip()
                historica_qa.append((q, a))

        if len(historica_qa) > 0:
            qa_prompt = "This is your conversation history with the user: " + "\n" + "\n".join([f"Your previous question: {qa[0]}\n\nUser's instruction to you: {qa[1]}" for qa in historica_qa]) + "\n\n Pay more attention to the user's latest instruction. " if len(historica_qa) > 0 else ""
        else:
            qa_prompt = ""


        conversations = [
            {
                "type": "text",
                "text": task_define_prompt
            }
        ] + make_status_prompt(
            task, 
            current_env['image'], 
            hints,
            summary_history,
            qa_prompt
        )

        messages = [
            {
                "role": "user",
                "content": conversations
            }
        ]
        # print(f"=============================================messages: \n\n{messages}\n=============================================")
        # print(f"{'='*45}\nmessages:\n{messages}\n{'='*45}")

        if return_sft:
            sft = messages2sft(messages)
            return messages, sft
        else:
            return messages

def tkj_action_transformer(action, width: int, height: int):
    ret_dict = {}

    assert "action_type" in action or "action" in action, f"action {action} should have action_type or action field"

    if "action_type" in action:
        action_type = action['action_type']
    if "action" in action:
        action_type = action['action']
    
    action['action_type'] = action_type
    action['action'] = action_type
        
    # try:
    if True:
        ret_dict['explain'] = action['explain']
        ret_dict['cot'] = action.get('cot', '')
        
        # compatible with new and old field names
        ret_dict['action_type'] = action.get('action_type') or action.get('action')
        if "search_type" in action:
            ret_dict['search_type'] = action['search_type']

        # compatible with different field names of keyboard
        if "keyboard_exists" in action:
            ret_dict['keyboard_exists'] = action['keyboard_exists']
        elif "is_keyboard" in action:
            ret_dict['keyboard_exists'] = action['is_keyboard']

        if "is_auto_close" in action:
            ret_dict["is_auto_close"] = action["is_auto_close"]

        if "point" in action:
            ret_dict['coordinates'] = action['point']

        for key in ["point", "point1", "point2"]:
            if key in action:
                ret_dict[key] = action[key]

        if "value" in action:
            ret_dict['text'] = action['value']
        if action['action_type'] == "WAIT":
            ret_dict['duration'] = action['value']
            if "functional" in action['explain'].lower():
                ret_dict["is_auto_close"] = True

            if "close_reasons" in action:
                ret_dict["close_reasons"] = [{
                    "reason": reason["reason"],
                    "bbox": reason["bbox"],
                } for reason in action["close_reasons"]]
            else:
                ret_dict["close_reasons"] = []
        if action['action_type'] == "TYPE":
            if "point" in action:
                ret_dict['coordinates'] = action['point']
            else:
                ret_dict['coordinates'] = action['point']
        # if ['action_type'] == "SCROLL":
        #     ret_dict['point1'] = denormalize_point(action['point1'], width, height)
        #     ret_dict['point2'] = denormalize_point(action['point2'], width, height)
        # if action['action_type'] == "LONGPRESS":
        #     ret_dict['point'] = denormalize_point(action['point'], width, height)
    # except Exception as e:
        # ret_dict["action_type"] = "ABORT"
        # ret_dict["abort_reason"] = "operation parameter parsing exception"

    return ret_dict


if __name__ == "__main__":
    # test_case = [
    #     "<think>xxx</think>",
    #     "<think>xxx</think>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    #     "<think>xxx</think>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    #     "<think>xxx</think>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    #     "< think>xxx</think>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    #     "</THINK>xxx</THINK>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    #     "<THINK>xxx</THINK>\nexplain:xxx\taction:xx\tvalue:xxx\tsummary:xxx",
    # ]
    # for command_str in test_case:
    #     action = str2action(command_str)
    #     print(f"action: {action}")
    pass
            
