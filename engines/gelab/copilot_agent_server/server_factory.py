
from copilot_agent_server.local_server import LocalServer as LocalParserServer


def get_server_class(server_type: str):
    if server_type == "local_parser_server":
        return LocalParserServer
    else:
        raise ValueError(f"Unknown server_type: {server_type}")