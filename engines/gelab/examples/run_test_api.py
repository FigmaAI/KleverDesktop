import sys
import time
from pathlib import Path
import argparse

# Make imports work no matter where you run this script from.
PROJECT_DIR = Path(__file__).resolve().parents[1]  # .../gelab-zero
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

tmp_server_config = {
    "log_dir": str(PROJECT_DIR / "running_log/server_log/os-copilot-local-eval-logs/traces"),
    "image_dir": str(PROJECT_DIR / "running_log/server_log/os-copilot-local-eval-logs/images"),
    "debug": False
}


local_model_config = {
    "task_type": "parser_0922_summary",
    "model_config": {
        "model_name": "step-gui-1",
        "model_provider": "stepfun",
        "args": {
            "temperature": 0.1,
            "top_p": 0.95,
            "frequency_penalty": 0.0,
            "max_tokens": 4096,
        },
        
        # optional to resize image
        # "resize_config": {
        #     "is_resize": True,
        #     "target_image_size": (756, 756)
        # }
    },

    "max_steps": 400,
    "delay_after_capture": 2,
    "debug": False
}

def run_api_smoke_test(task: str, image_path: str, rollout_config: dict, server_config: dict, query: str = "") -> dict:
    """
    Use ONE static image + ONE task to do a single automate_step call.
    This is a smoke test to verify your model API is reachable and returns a valid action.
    """
    from copilot_agent_server.local_server import LocalServer
    from copilot_agent_server.local_server_logger import LocalServerLogger
    from tools.image_tools import make_b64_url

    if not task or not isinstance(task, str):
        raise ValueError("task must be a non-empty string")

    image_path_obj = Path(image_path).expanduser().resolve()
    if not image_path_obj.exists():
        raise FileNotFoundError(f"Image not found: {image_path_obj}")

    l2_server = LocalServer(server_config)

    session_id = l2_server.get_session({
        "task": task,
        "task_type": rollout_config["task_type"],
        "model_config": rollout_config["model_config"],
        "extra_info": {
            "run_mode": "api_smoke_test",
            "image_path": str(image_path_obj),
        }
    })
    print(f"Session ID: {session_id}")

    image_b64_url = make_b64_url(
        str(image_path_obj),
        resize_config=rollout_config["model_config"].get("resize_config", None),
    )

    payload = {
        "session_id": session_id,
        "observation": {
            "screenshot": {
                "type": "image_url",
                "image_url": {"url": image_b64_url},
            },
        }
    }
    if query:
        payload["observation"]["query"] = query

    step_result = l2_server.automate_step(payload)

    logger = LocalServerLogger({
        "log_dir": server_config["log_dir"],
        "image_dir": server_config["image_dir"],
        "session_id": session_id,
    })
    logs = logger.read_logs()
    last_msg = (logs[-1]["message"] if len(logs) > 0 else {}) if logs else {}

    action = last_msg.get("action") or step_result.get("action")
    model_response = last_msg.get("model_response", "")


    print("✅ API 测试完成！")
    print(f"📋 返回的 action: {action}")
    print("="*60)
    print("🎉 恭喜！你的 GUI Agent API 服务运行正常，可以开始使用啦！")
    print("💡 提示：你可以运行 run_single_task.py 来执行真实设备上的任务！")
    print("="*60 + "\n")

    return {
        "session_id": session_id,
        "action": action,
        "model_response": model_response,
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="API smoke test: 1 image + 1 task")
    parser.add_argument("--task", type=str, default="去淘宝帮我买本书", help="Task instruction")
    parser.add_argument(
        "--image",
        type=str,
        default=str((PROJECT_DIR / "images/test_api.png").resolve()),
        help="Path to the test screenshot (default: ./images/test_api.png)",
    )
    parser.add_argument("--query", type=str, default="", help="Optional user reply text (for INFO action cases)")
    parser.add_argument("--debug", action="store_true", help="Print server logs to stdout")
    args = parser.parse_args()

    tmp_rollout_config = local_model_config
    tmp_server_config = dict(tmp_server_config)
    tmp_server_config["debug"] = bool(args.debug)

    run_api_smoke_test(
        task=args.task,
        image_path=args.image,
        rollout_config=tmp_rollout_config,
        server_config=tmp_server_config,
        query=args.query,
    )
