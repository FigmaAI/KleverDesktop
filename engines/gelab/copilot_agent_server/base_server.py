import json
import jsonlines

class BaseCopilotServer:
    def __init__(self):
        pass

    def get_session(self, *args, **kwargs):
        raise NotImplementedError
    
    def automate_step(self, *args, **kwargs):
        raise NotImplementedError
    
if __name__ == "__main__":
    pass

