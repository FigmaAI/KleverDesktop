# complete
# click
# long_press
# type
# hot_key
# slide
# awake
# wait
# info
# call_user
# double_tap

_ACTION_TYPE_ENUM = [
    "COMPLETE",
    "CLICK",
    "LONG_PRESS",
    "TYPE",
    "HOT_KEY",
    "SLIDE",
    "AWAKE",
    "WAIT",
    "INFO",
    "CALL_USER",
    "DOUBLE_CLICK",
    "ABORT",
]

_DIRECTION_TYPE_ENUM = [
    "UP",
    "DOWN",
    "LEFT",
    "RIGHT",
]

_HOT_KEY_TYPE_ENUM = [
    "ENTER",
    "BACK",
    "HOME",
]

_COMPLETE_STATUS_ENUM = [
    "SUCCESS",
    "FAILURE",
]

def action_assertion(action: dict):
    assert type(action) == dict, "action must be a dict"
    assert "action_type" in action, "action must contain 'action_type'"

    action_type = action["action_type"]
    assert action_type in _ACTION_TYPE_ENUM, f"action_type {action_type} not in {_ACTION_TYPE_ENUM}"

    # force to include minimal fields
    if action_type in ["CLICK", "LONG_PRESS", "DOUBLE_TAP"]:
        # 0-1k rangeint
        assert "point" in action and (isinstance(action["point"], list) or isinstance(action["point"], tuple)) and len(action["point"]) == 2, "point must be a list or tuple of two elements"
        assert all(isinstance(x, int) and 0 <= x <= 1000 for x in action["point"]), "point values must be integers in the range [0, 1000]"

    if action_type in ["TYPE", "AWAKE", "INFO"]:
        assert "value" in action and isinstance(action["value"], str), "value must be a string"

    if action_type == "HOT_KEY":
        assert "key" in action and action["key"] in _HOT_KEY_TYPE_ENUM, f"key must be in {_HOT_KEY_TYPE_ENUM}"

    if action_type == "SLIDE":
        assert ("point1" and "point2" in action) or ("point" and "direction" in action), "SLIDE action must contain either point1 and point2 or point and direction"
        if "point1" and "point2" in action:
            assert (isinstance(action["point1"], list) or isinstance(action["point1"], tuple)) and len(action["point1"]) == 2, "point1 must be a list or tuple of two elements"
            assert all(isinstance(x, int) and 0 <= x <= 1000 for x in action["point1"]), "point1 values must be integers in the range [0, 1000]"
            assert (isinstance(action["point2"], list) or isinstance(action["point2"], tuple)) and len(action["point2"]) == 2, "point2 must be a list or tuple of two elements"
            assert all(isinstance(x, int) and 0 <= x <= 1000 for x in action["point2"]), "point2 values must be integers in the range [0, 1000]"
        if "point" and "direction" in action:
            assert (isinstance(action["point"], list) or isinstance(action["point"], tuple)) and len(action["point"]) == 2, "point must be a list or tuple of two elements"
            assert all(isinstance(x, int) and 0 <= x <= 1000 for x in action["point"]), "point values must be integers in the range [0, 1000]"
            assert action["direction"] in _DIRECTION_TYPE_ENUM, f"direction must be in {_DIRECTION_TYPE_ENUM}"

    if action_type in ["COMPLETE", "WAIT", "CALL_USER"]:
        # no mandatory fields
        pass

    # extra fields check
    if action_type == "COMPLETE" and "status" in action:
        assert action["status"] in _COMPLETE_STATUS_ENUM, f"status must be in {_COMPLETE_STATUS_ENUM}"
    


