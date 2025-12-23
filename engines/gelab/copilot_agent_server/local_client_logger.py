import json
import jsonlines

from copilot_agent_server.base_logger import BaseLogger
from megfile import smart_open, smart_makedirs, smart_exists

import datetime
import base64
from io import BytesIO
from PIL import Image


class LocalClientLogger(BaseLogger):
    def __init__(self, log_dir):
        self.log_dir = log_dir

        smart_makedirs(self.log_dir, exist_ok=True)
        
        current_date = datetime.datetime.now().strftime("%Y%m%d")
        self.log_file_path = f"{self.log_dir}/log_{current_date}.jsonl"
        
        
    def log_str(self, message_dict, is_print: bool = False):
        
        log_message = {
            "timestamp": datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            "message": message_dict
        }

        with smart_open(self.log_file_path, 'a') as f:
            writer = jsonlines.Writer(f)
            writer.write(log_message)
        
        if is_print:
            print(json.dumps(log_message, indent=2, ensure_ascii=False))
        

    def read_logs(self):
        logs = []

        assert smart_exists(self.log_file_path), f"log_dir {self.log_dir} does not exist"
        with smart_open(self.log_file_path, "r") as f:
            reader = jsonlines.Reader(f)
            for obj in reader:
                logs.append(obj)
        return logs