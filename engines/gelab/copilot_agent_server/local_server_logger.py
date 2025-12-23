import json
import jsonlines

from copilot_agent_server.base_logger import BaseLogger
from megfile import smart_open, smart_makedirs, smart_exists

import datetime
import base64
from io import BytesIO
from PIL import Image



class LocalServerLogger(BaseLogger):
    def __init__(self, logger_config: dict):
        # self.log_file = log_file
        # self.writer = jsonlines.open(log_file, mode='a')

        assert "log_dir" in logger_config, "logger_config must contain 'log_dir'"
        log_dir = logger_config["log_dir"]

        if not smart_exists(log_dir):
            smart_makedirs(log_dir)
            print(f"Created log_dir: {log_dir}")

        # assert smart_exists(log_dir), f"log_dir {log_dir} does not exist"
        while log_dir.endswith('/'):
            log_dir = log_dir[:-1]

        assert "image_dir" in logger_config, "logger_config must contain 'image_dir'"
        image_dir = logger_config["image_dir"]
        # assert smart_exists(image_dir), f"image_dir {image_dir} does not exist"
        if not smart_exists(image_dir):
            smart_makedirs(image_dir)
            print(f"Created image_dir: {image_dir}")

        while image_dir.endswith('/'):
            image_dir = image_dir[:-1]

        assert "session_id" in logger_config, "logger_config must contain 'session_id'"
        session_id = logger_config["session_id"]
        self.session_id = session_id

        self.image_dir = f"{image_dir}"
        
        self.log_target_file = f"{log_dir}/{session_id}.jsonl"

        pass

    def read_logs(self):
        if not smart_exists(self.log_target_file):
            return []
        
        # with smart_open(self.log_target_file, 'r') as f:
        with smart_open(self.log_target_file, 'r',encoding='utf-8') as f:
            reader = jsonlines.Reader(f)
            logs = [obj for obj in reader]
        
        return logs

    def log_str(self, message_dict, is_print: bool = False):
        
        log_message = {
            "session_id": self.session_id,
            "timestamp": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "message": message_dict
        }

        # with smart_open(self.log_target_file, 'a') as f:
        with smart_open(self.log_target_file, 'a',encoding='utf-8') as f:
            writer = jsonlines.Writer(f)
            writer.write(log_message)
        
        if is_print:
            print(json.dumps(log_message, indent=2, ensure_ascii=False))

    def save_image(self, image: Image.Image, image_name: str) -> str:
        """
        Save a PIL Image to the image directory with the given image name.
        Returns the path where the image is saved.
        """
        assert isinstance(image, Image.Image), "image must be a PIL Image"
        assert (isinstance(image_name, str) or isinstance(image_name, int)) and len(image_name) > 0, "image_name must be a non-empty string"

        # to compress image into jpeg format
        buffered = BytesIO()
        image = image.convert('RGB')
        image.save(buffered, format="JPEG", quality=85)
        image_data = buffered.getvalue()
        image_path = f"{self.image_dir}/{self.session_id}_{image_name}.jpeg"
        with smart_open(image_path, "wb") as f:
            f.write(image_data)

        return image_path

