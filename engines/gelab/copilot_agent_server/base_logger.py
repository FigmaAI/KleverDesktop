import json
import jsonlines
from PIL import Image
import base64
from io import BytesIO

class BaseLogger:
    def __init__(self):
        pass

    def log_str(self, *args, **kwargs):
        raise NotImplementedError
    
    def save_image(self, *args, **kwargs):
        raise NotImplementedError
    
    def read_logs(self, *args, **kwargs):
        raise NotImplementedError