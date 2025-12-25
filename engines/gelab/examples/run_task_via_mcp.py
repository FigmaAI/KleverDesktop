import asyncio
from fastmcp import Client

client = Client("http://localhost:8704/mcp")

import json

from tqdm import tqdm

async def ask_agent(task: str):
    async with client:
        result = await client.call_tool("ask_agent", {"task": task, "reset_environment": False, "kill_app_when_awake": False, "max_steps": 1})
        print(result)


# async 
async def async_list_tools():
    async with client:
        tools = await client.list_tools()
        print("Supported tools:\n", json.dumps(tools, indent=4, ensure_ascii=False))



asyncio.run(async_list_tools())

