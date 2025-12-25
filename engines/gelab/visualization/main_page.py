import json
import streamlit as st
from io import BytesIO
from PIL import Image
import jsonlines
import base64

from megfile import smart_open, smart_exists

import sys
if "." not in sys.path:
    sys.path.append(".")

from tools.image_tools import draw_points

from megfile import smart_open, smart_exists

from tqdm import tqdm

def long_side_resize(image, long_side=800):
    image = image.convert("RGB")
    width, height = image.size
    if max(width, height) > long_side:
        if width >= height:
            new_width = long_side
            new_height = int(height * long_side / width)
        else:
            new_height = long_side
            new_width = int(width * long_side / height)
        image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    return image

def make_b64_url(image):
    buffered = BytesIO()
    image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    img_data = f"data:image/jpeg;base64,{img_str}"
    return img_data

def meta2messages(logs):

    messages = []
    config_log = logs[0]

    messages.append({
        "role": "system",
        "content": f"### Task: {config_log['message']['task']}\n\n### model_name: {config_log['message']['model_config']['model_name']}"
    })

    env_act_logs = logs[1:]
    for idx, log in enumerate(tqdm(env_act_logs)):
        env = log['message']['environment']
        act = log['message']['action']


        image_url = env['image']

        image_new_url = env['image'].replace(".jpeg", "_processed.jpeg")

        if smart_exists(image_new_url):
            image_url = image_new_url
        else:
            with smart_open(image_url, "rb") as f:
                image = Image.open(f)
                image = long_side_resize(image, long_side=800)

            if "point1" in act:
                points = [act["point1"], act["point2"]]

                draw_points(image, image_new_url, points)

                image_url = image_new_url

            elif "point" in act:
                points =[ act["point"]]
                draw_points(image, image_new_url, points)

                image_url = image_new_url
        
        thought = act.get("cot","")
        act['cot'] = thought
        del act['cot']
        env_msg = {
            "role": "user",
            "content": [
                {
                    "type": "image_url", "image_url": {"url": image_url}
                },
                {
                    "type": "text", "text": f"### 用户评论: {env['user_comment']}\n\n#### Task: {config_log['message']['task']}\n\n### 第{idx+1} 轮模型动作:\n\n#### Thought:\n\n{thought}\n\n```json\n{json.dumps(act, indent=2, ensure_ascii=False)}\n```"
                }
            ]
        }
        messages.append(env_msg)

    return messages


st.title("根据Session ID查找Copilot 数据")

# with st.sidebar:
session_id = st.text_input("输入Session ID")

if st.button("查找"):
    session_id = session_id.strip()

    log_file = f"running_log/server_log/os-copilot-local-eval-logs/traces/{session_id}.jsonl"

    if smart_exists(log_file):
        # with smart_open(log_file, "r") as f:
        with smart_open(log_file, "r",encoding='utf-8') as f:
            reader = jsonlines.Reader(f)
            logs = [log for log in reader]

            messages = meta2messages(logs)

            for mes in messages:
                with st.chat_message(mes['role']):
                    if type(mes['content']) == str:
                        st.markdown(mes['content'])
                    else:
                        # interleave_contents = try_pause_json(mes['content'])
                        for item in mes['content']:
                            if item['type'] == 'text':
                                st.markdown(
    """
    <style>
    [data-testid="stJson"] {
        word-wrap: break-word;   /* 长单词/URL 自动换行 */
        white-space: pre-wrap;   /* 保留空格，自动换行 */
    }
    </style>
    """,
    unsafe_allow_html=True
)
                                st.markdown(item['text'])
                            elif item['type'] == 'image_url':
                                image_url = item['image_url']['url']
                                with smart_open(image_url, "rb") as f:
                                    image = Image.open(f)
                                    st.image(image)

    else:
        st.write("未找到数据")

