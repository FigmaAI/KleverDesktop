from fastmcp import FastMCP

import sys
if "." not in sys.path:
    sys.path.append(".")

from copilot_front_end.mobile_action_helper import list_devices, get_device_wm_size
from copilot_agent_server.local_server import LocalServer

from copilot_agent_client.mcp_agent_loop import gui_agent_loop

from multiprocessing import Queue

import yaml

from PIL import Image
import io
import base64

from megfile import smart_open, smart_remove

# TODO: to manage the usage status of all devices, and meke an option to display only available devices
def get_device_list():
    """
    Get the list of connected devices.
    
    :return: 设备列表
    :rtype: list of str, each str is a device ID
    """
    devices = list_devices()
    
    return devices

# TODO: to execute command only when device is available
def get_screenshot(device_id: str, ):
    """
    Get screenshot from the device.
    :param device_id: 设备ID
    :type device_id: str
    :return: 截图，base64编码的字符串

    """

    from copilot_front_end.mobile_action_helper import capture_screenshot

    screenshot_url = capture_screenshot(device_id)


    with smart_open(screenshot_url, "rb") as f:
        image_data = f.read()
    screenshot_b64 = base64.b64encode(image_data).decode('utf-8')

    smart_remove(screenshot_url)

    return screenshot_b64

    

# TODO: to get the list of running apps on the device rather than hardcoding
# TODO: to execute command only when device is available
def get_available_apps(device_id: str):
    """
    Get the list of available apps on the device.
    :param device_id: 设备ID
    :type device_id: str
    :return: 可用应用列表
    :rtype: list of str, each str is an app package name
    """

    from copilot_front_end.package_map import package_name_map

    app_list = list(package_name_map.keys())

    return app_list


# TODO: to execute command only when device is available
def execute_task(
    device_id: str,
    task: str,
    
    # Whether to reset the environment before starting the task. If True:
    # 1. The HOME key will be pressedand, the init screen will be set up to the initial state.
    # 2. The target app will be launched afresh.
    reset_environment: bool,

    # The max number of steps for the agent to perform.
    # The actual step limit is min(max_steps, the default max_steps set in the gui_agent_config)
    max_steps: int,

    # Whether to return intermediate logs during the task execution. If True:
    # 1. the intermediate logs will be logged and returned along with the final result.
    enable_intermediate_logs: bool,

    # Whether call caption model to generate image captions for each screenshot during the task execution. If True:
    # 1. image captions will be generated and returned along with the intermediate screenshots.
    # 2. only works when enable_intermediate_logs is True.
    # 3. the enable_intermediate_image_caption or return_intermediate_screenshots must be True when enable_intermediate_logs is True.
    enable_intermediate_image_caption: bool,

    # Whether to return the intermediate screenshots during the task execution. If True:
    # 1. the intermediate screenshots will be logged and returned along with the final result.
    # 2. only works when enable_intermediate_logs is True.
    # 3. the enable_intermediate_image_caption or enable_intermediate_screenshots must be True when enable_intermediate_logs is True.
    enable_intermediate_screenshots: bool,

    # Whether to return the final screenshot after task execution. If True:
    # 1. the final screenshot will be returned along with the final result.
    enable_final_screenshot: bool,

    # Whether to return the final image caption after task execution. If True:
    # 1. the final image caption will be returned along with the final result.
    enable_final_image_caption: bool,

    # When the INFO action is called, how to handle it.
    # 1. "auto_reply": the INFO action will be handled automatically by calling the caption model to generate image captions.
    # 2. "no_reply": the INFO action will be ignored. THE AGENT MAY GET STUCK IF THE INFO ACTION IS IGNORED.
    # 3. "manual_reply": the INFO action will cause an interruption, and the user needs to provide the reply manually by input things in server's console.
    # 4. "pass_to_client": the INFO action will be returned to the MCP client to handle it.
    reply_mode: str,

    # Optional session ID to continue an existing session. If None, a new session will be created.
    # If not None:
    # 1. The existing session with the given session_id will be continued.
    # 2. If a completed sessionid is provided, will raise an error.
    session_id: str,

    # Optional reply from the client to handle the INFO action when reply_mode is "pass_to_client".
    reply_from_client: str,

    # optional you can provide extra infomation to pass to the agent and log it
    extra_info: dict = {},
):
    """
        # GUI Agent Documentation

        Ask the GUI agent to perform the specified task on a connected device.
        The GUI Agent can be able to understand natural language instructions and interact with the device accordingly.
        The agent will be able to execute a high-level task description by performing a sequence of low-level actions on the device.

        ## For high-level tasks, the agent has the below limited capabilities:

        1. The task must be related to an app that is already installed on the device. for example, "打开微信，帮我发一条消息给张三，说今天下午三点开会"; "帮我在淘宝上搜索一款性价比高的手机，并加入购物车"; "to purchase an ea on Amazon".

        2. The task must be simple and specific. for example, "do yyy in xxx app"; "find xxx information in xxx app". ONE THING AT ONE APP AT A TIME.

        3. The agent may not be able to handle complex tasks that require multi-step reasoning or planning. for example. You may need to break down complex tasks into simpler sub-tasks and ask the agent to perform them sequentially. For example, instead of asking the agent to "plan a trip to Paris for xxx", you can ask it to "search for flights to Paris on xxx app", "find hotels in Paris on xxx app", make the plan yourself and ask agent to "sent the plan to xxx via IM app like wechat".
        
        ## For low-level tasks, the agent can perform the below actions:

        1. CLICK: Click on a specific point on the screen, you need to ask the agent to click the specific thing, e.g., "点击搜索按钮", "点击发送按钮", "点击确认按钮", etc.

        2. SWIPE: Swipe from one point to another point on the screen, you need to ask the agent to swipe from one specific point to another, e.g., "在屏幕主界面向下滑动以刷新页面", "向左滑动以查看下一张图片", etc.

        3. LONG_PRESS: Long press on a specific point on the screen, you need to ask the agent to long press on a specific thing, e.g., "长按应用图标以打开菜单", "长按图片以查看大图", etc.

        4. INPUT_TEXT: Input text into a specific text field, you need to ask the agent to input specific text into a specific field, e.g., "在搜索框中输入'天气预报'", "在消息输入框中输入'你好，张三'", etc.

        5. AWAKE: to open some app.

        ## Function Arguments

        Args:
            device_id (str): The ID of the connected device.
            task (str): The task description for the GUI agent.
            reset_environment (bool): Whether to reset the environment before starting the task.
            max_steps (int): Maximum number of steps for the agent to perform.
            enable_intermediate_logs (bool): Whether to return intermediate logs during the task execution.
            enable_intermediate_image_caption (bool): Whether call caption model to generate image captions for each screenshot during the task execution.
            enable_intermediate_screenshots (bool): Whether to return the intermediate screenshots during the task execution.
            enable_final_screenshot (bool): Whether to return the final screenshot after task execution.
            enable_final_image_caption (bool): Whether to return the final image caption after task execution.
            reply_mode (str): How to handle the INFO action when it is called.
            session_id (str): Optional session ID to continue an existing session.
            reply_from_client (str): Optional reply from the client to handle the INFO action when reply_mode is "pass_to_client".
        Returns:
            dict: The result of the task execution.
    """



    # load mcp server config
    mcp_server_config = yaml.safe_load(smart_open("mcp_server_config.yaml", "r"))
    agent_loop_config = mcp_server_config['agent_loop_config']

    # determine the actual max_steps
    max_steps = min(max_steps, agent_loop_config.get('max_steps', 40))


    l2_server = LocalServer(mcp_server_config['server_config'])

    result = gui_agent_loop(
        agent_server=l2_server,
        device_id=device_id,
        agent_loop_config=agent_loop_config,

        max_steps=max_steps,

        enable_intermediate_logs=enable_intermediate_logs,
        enable_intermediate_image_caption=enable_intermediate_image_caption,
        enable_intermediate_screenshots=enable_intermediate_screenshots,

        enable_final_screenshot=enable_final_screenshot,
        enable_final_image_caption=enable_final_image_caption,

        reply_mode=reply_mode,

        task=task,
        session_id=session_id,
        reply_from_client=reply_from_client,

        reset_environment=reset_environment,
        reflush_app=reset_environment,

        extra_info=extra_info,
    )


    return result



if __name__ == "__main__":
    current_device = get_device_list()[0]
    print(f"Current connected device: {current_device}")


    # TEST execute_task that will call INFO action
    # return_log = execute_task(
    #     device_id=current_device,
    #     task="去淘宝帮我选一个生日礼物",

    #     reset_environment=True,
    #     max_steps=20,
    #     enable_intermediate_logs=True,
    #     enable_intermediate_image_caption=True,
    #     enable_intermediate_screenshots=True,
    #     enable_final_screenshot=True,
    #     enable_final_image_caption=True,

    #     # reply_mode="manual_reply",
    #     # reply_mode="auto_reply",
    #     reply_mode="pass_to_client",

    #     session_id=None,
    #     reply_from_client=None,
    # )

    # session_id = return_log['session_id']
    # print(f"Session ID: {session_id}")

    # with smart_open("tmp_task_return_log.yaml", "w") as f:
    #     yaml.dump(return_log, f, encoding="utf-8", allow_unicode=True)

    
    # TEST continue the previous session
    # session_id = "17ab15cf-2349-4df2-b0f9-7e227eab062f"

    # return_log = execute_task(
    #     device_id=current_device,
    #     # task="去淘宝帮我选一个生日礼物",
    #     task=None,

    #     reset_environment=False,

    #     max_steps=10,
    #     enable_intermediate_logs=True,
    #     enable_intermediate_image_caption=True,
    #     enable_intermediate_screenshots=True,
    #     enable_final_screenshot=True,
    #     enable_final_image_caption=True,

    #     # reply_mode="manual_reply",
    #     # reply_mode="auto_reply",
    #     reply_mode="pass_to_client",

    #     session_id=session_id,
    #     reply_from_client="铜苹果",
    # )

    # with smart_open("tmp_task_return_log_continue.yaml", "w") as f:
    #     yaml.dump(return_log, f, encoding="utf-8", allow_unicode=True)


    # TEST a normal task without INFO action
    # test log configs
    return_log = execute_task(
        device_id=current_device,
        task="打开微信",

        reset_environment=True,
        max_steps=2,

        enable_intermediate_logs=False,
        enable_intermediate_image_caption=True,
        enable_intermediate_screenshots=True,

        # enable_final_screenshot=False,
        enable_final_screenshot=True,
        # enable_final_image_caption=False,
        enable_final_image_caption=True,

        reply_mode="no_reply",

        session_id=None,
        reply_from_client=None,
    )
    

    with smart_open("tmp_mcp_images.yaml", "w") as f:
        yaml.dump(return_log, f, encoding="utf-8", allow_unicode=True)
    




    pass
