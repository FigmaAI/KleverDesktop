

class BaseParser:
    # option screen resolution: width, height
    def __init__(self, parser_config: dict):
        self.parser_config = parser_config
        # indipendent assertion necessary keys 

    def action_assertion(self, action: dict):
        raise NotImplementedError

    def action2str(self, action: dict) -> str:
        raise NotImplementedError
    
    def str2action(self, action_str: str) -> dict:
        raise NotImplementedError
    
    def env2messages4ask(self, task, environments, actions, return_sft, hints=[] ):
        raise NotImplementedError