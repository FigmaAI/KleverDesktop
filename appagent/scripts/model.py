import json
import re
import time
from abc import abstractmethod
from typing import List, Optional, Dict, Any, Union

import requests

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

from utils import print_with_color, encode_image, optimize_image


class BaseModel:
    def __init__(self):
        pass

    @abstractmethod
    def get_model_response(self, prompt: str, images: List[str]) -> tuple[bool, str, dict]:
        """
        Get model response with metadata.

        Returns:
            tuple: (success, response_text, metadata)
            - success: bool indicating if request was successful
            - response_text: str containing model's response
            - metadata: dict with performance metrics:
                {
                    "prompt_tokens": int,
                    "completion_tokens": int,
                    "total_tokens": int,
                    "response_time": float (seconds),
                    "provider": str,
                    "model": str
                }
        """
        pass


class OpenAIModel(BaseModel):
    """
    Universal Model API using LiteLLM.

    Supports 100+ model providers including:
    - Ollama (ollama/llama3.2-vision, ollama/qwen3-vl:8b) - Local models
    - OpenAI (gpt-4o, gpt-4-turbo, gpt-4o-mini)
    - Anthropic Claude (claude-sonnet-4-5-20250929, claude-opus-4, etc.)
    - xAI Grok (grok-beta, grok-vision-beta)
    - Google Gemini (gemini-2.0-flash-exp, gemini-pro-vision)
    - OpenRouter (access 100+ models: openrouter/provider/model)
    - Mistral (mistral-large-latest, pixtral-12b)
    - DeepSeek (deepseek-chat, deepseek-reasoner)
    - And 90+ more providers via LiteLLM

    The implementation automatically detects the provider from the model name
    and handles the appropriate API format.
    
    For Ollama models, use the format: ollama/model-name (e.g., ollama/llama3.2-vision)
    """
    def __init__(self, base_url: str, api_key: str, model: str, temperature: float, max_tokens: int, configs: Optional[Dict[str, Any]] = None):
        super().__init__()
        self.base_url = base_url
        self.api_key = api_key
        self.model = model
        self.configs = configs or {}
        # Ensure temperature is a float and max_tokens is an integer (API providers require correct types)
        self.temperature = float(temperature)
        self.max_tokens = int(max_tokens)

        # Detect provider from model name
        self.provider = self._detect_provider(model)

        # Set timeout based on model type
        self.timeout = self._get_timeout()
        
        # JSON structured output is enabled by default for reliable parsing
        # Can be disabled via config if needed (e.g., USE_JSON_MODE=false from Electron)
        self.use_json_mode = self.configs.get("USE_JSON_MODE", True)
        
        # Streaming mode for real-time output
        # Only enable for Ollama (local models) - needed for <think> mode monitoring
        # For cloud providers (OpenRouter, OpenAI, etc.), disable streaming to get accurate token counts
        if self.provider == "Ollama":
            self.use_streaming = self.configs.get("USE_STREAMING", True)
        else:
            self.use_streaming = False  # Disable for cloud providers to get token usage

        # Use LiteLLM if available, fallback to requests for basic OpenAI compatibility
        self.use_litellm = LITELLM_AVAILABLE

        if self.use_litellm:
            print_with_color(f"✓ Model initialized: {model} (Provider: {self.provider}, via LiteLLM)", "green")
            streaming_status = "enabled (local)" if self.use_streaming else "disabled (accurate tokens)"
            print_with_color(f"  Timeout: {self.timeout}s, JSON mode: {self.use_json_mode}, Streaming: {streaming_status}", "cyan")
        else:
            print_with_color(f"✓ Model initialized: {model} (Legacy mode - install litellm for better compatibility)", "yellow")
    
    def _is_qwen3_model(self) -> bool:
        """Check if the model is a Qwen3 variant (which uses thinking mode)"""
        return "qwen3" in self.model.lower()
    
    def _get_timeout(self) -> int:
        """Get appropriate timeout based on model type"""
        if self._is_qwen3_model():
            # Qwen3 models need longer timeout for <think> processing
            return self.configs.get("QWEN3_TIMEOUT", 600)
        return self.configs.get("REQUEST_TIMEOUT", 300)
    
    def _get_json_format_params(self) -> Dict[str, Any]:
        """Get JSON format parameters based on provider"""
        if not self.use_json_mode:
            return {}
        
        # Qwen3 models: JSON mode conflicts with <think> mode, disable it
        if self._is_qwen3_model():
            print_with_color("Qwen3 model detected: JSON mode disabled (conflicts with <think>)", "yellow")
            return {}
        
        if self.provider == "Ollama":
            # Ollama uses 'format' parameter
            return {"format": "json"}
        elif self.provider in ["OpenAI", "Azure OpenAI"]:
            # OpenAI uses 'response_format' parameter
            return {"response_format": {"type": "json_object"}}
        elif self.provider == "Google Gemini":
            # Gemini uses 'response_mime_type'
            return {"response_mime_type": "application/json"}
        else:
            # Other providers may not support JSON mode natively
            # Will rely on prompt engineering
            return {}

    def _detect_provider(self, model: str) -> str:
        """Detect the provider from the model name."""
        if model.startswith("ollama/"):
            return "Ollama"
        elif model.startswith("openrouter/"):
            return "OpenRouter"
        elif model.startswith("claude-") or model.startswith("anthropic/"):
            return "Anthropic"
        elif model.startswith("xai/") or model.startswith("grok"):
            return "xAI Grok"
        elif model.startswith("gpt-"):
            return "OpenAI"
        elif model.startswith("gemini/") or model.startswith("google/"):
            return "Google Gemini"
        elif model.startswith("azure/"):
            return "Azure OpenAI"
        elif model.startswith("command-") or model.startswith("cohere/"):
            return "Cohere"
        elif model.startswith("mistral/"):
            return "Mistral"
        elif model.startswith("together_ai/"):
            return "Together AI"
        elif model.startswith("perplexity/"):
            return "Perplexity"
        elif model.startswith("deepseek/"):
            return "DeepSeek"
        else:
            return "OpenAI-compatible"

    def get_model_response(self, prompt: str, images: List[str]) -> tuple[bool, str, dict]:
        """
        Get model response using LiteLLM (supports 100+ providers) or fallback to requests.

        Args:
            prompt: Text prompt
            images: List of file paths

        Returns:
            (success, response_text, metadata)
        """
        if self.use_litellm:
            return self._get_response_litellm(prompt, images)
        else:
            return self._get_response_legacy(prompt, images)

    def _get_response_litellm(self, prompt: str, images: List[str]) -> tuple[bool, str, dict]:
        """Get response using LiteLLM (supports all modern providers)."""
        start_time = time.time()

        # Optimize images before encoding
        optimized_images = []
        for img_path in images:
            optimized_path = optimize_image(img_path)
            optimized_images.append(optimized_path)

        # Build content array
        # Add JSON instruction if JSON mode is enabled
        json_params = self._get_json_format_params()
        if json_params:
            json_instruction = """

IMPORTANT: You must respond with valid JSON only. Follow the exact field names specified in the instructions above."""
            prompt = prompt + json_instruction
        
        content = [{"type": "text", "text": prompt}]

        # Add images
        for img in optimized_images:
            base64_img = encode_image(img)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_img}"
                }
            })
            print_with_color(f"Image encoded: {img}", "cyan")

        try:
            # Prepare completion parameters
            completion_params = {
                "model": self.model,
                "messages": [{"role": "user", "content": content}],
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
                "timeout": self.timeout
            }

            # Only add API key if it's not empty and not Ollama (which doesn't need auth)
            if self.api_key and self.api_key.strip() and self.provider != "Ollama":
                completion_params["api_key"] = self.api_key

            # Add base_url if provided (for custom endpoints like OpenRouter)
            if self.base_url and self.base_url.strip():
                completion_params["api_base"] = self.base_url
                print_with_color(f"Using custom base URL: {self.base_url}", "cyan")
            
            # Add JSON format parameters if enabled
            if json_params:
                completion_params.update(json_params)
                print_with_color(f"JSON mode enabled: {json_params}", "cyan")

            # Enable streaming for real-time output
            if self.use_streaming:
                completion_params["stream"] = True
                print_with_color(f"Streaming enabled for real-time output", "cyan")

            # LiteLLM automatically handles different provider formats
            print_with_color(f"Sending request to {self.provider} (timeout: {self.timeout}s)...", "cyan")
            response = completion(**completion_params)

            # Handle streaming response
            if self.use_streaming:
                response_content = ""
                # Only show streaming output for Ollama (useful for <think> mode)
                show_streaming_output = self.provider == "Ollama"
                
                if show_streaming_output:
                    print_with_color("\n--- Model Response (streaming) ---", "yellow")
                
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        chunk_content = chunk.choices[0].delta.content
                        response_content += chunk_content
                        # Print in real-time only for Ollama
                        if show_streaming_output:
                            # Remove extra newlines from streaming output for better readability
                            # Ollama tends to add newlines between tokens
                            display_chunk = chunk_content.replace('\n', ' ').strip()
                            if display_chunk:  # Only print non-empty chunks
                                print(display_chunk + " ", end="", flush=True)
                
                if show_streaming_output:
                    print()  # Newline after streaming completes
                    print_with_color("--- End of Response ---\n", "yellow")
                
                # Calculate response time after streaming completes
                response_time = time.time() - start_time
            else:
                # Calculate response time
                response_time = time.time() - start_time
                # LiteLLM normalizes all responses to OpenAI format
                response_content = response.choices[0].message.content

            if not response_content or len(response_content.strip()) == 0:
                print_with_color("WARNING: Model returned empty content", "yellow")
                metadata = {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "response_time": response_time,
                    "provider": self.provider,
                    "model": self.model
                }
                return False, "Model returned empty response", metadata

            # Collect usage metadata
            prompt_tokens = 0
            completion_tokens = 0
            total_tokens = 0

            # Streaming mode doesn't provide usage info in the same way
            if not self.use_streaming and hasattr(response, 'usage') and response.usage:
                usage = response.usage
                prompt_tokens = getattr(usage, 'prompt_tokens', 0)
                completion_tokens = getattr(usage, 'completion_tokens', 0)
                total_tokens = getattr(usage, 'total_tokens', prompt_tokens + completion_tokens)
                print_with_color(
                    f"Tokens - Prompt: {prompt_tokens}, Completion: {completion_tokens}, Total: {total_tokens}",
                    "yellow"
                )
            elif self.use_streaming:
                # Estimate tokens for streaming (rough approximation)
                # Words * 1.3 is a rough estimate for token count
                completion_tokens = int(len(response_content.split()) * 1.3)
                # Estimate prompt tokens based on image + text (rough: ~1000 for image, text words * 1.3)
                prompt_tokens = int(1000 + len(prompt.split()) * 1.3)  # rough estimate
                total_tokens = prompt_tokens + completion_tokens
                print_with_color(f"Tokens (estimated): ~{total_tokens} total ({prompt_tokens} prompt + {completion_tokens} completion)", "yellow")

            # Print response time
            print_with_color(f"✓ {self.provider} response received in {response_time:.2f}s", "green")

            # Build metadata dict
            metadata = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "response_time": response_time,
                "provider": self.provider,
                "model": self.model
            }

            return True, response_content, metadata

        except Exception as e:
            response_time = time.time() - start_time
            error_msg = str(e)

            # Provide helpful error messages for common issues
            if "authentication" in error_msg.lower() or "api_key" in error_msg.lower():
                print_with_color(f"ERROR: Authentication failed for {self.provider}. Check your API key.", "red")
            elif "rate_limit" in error_msg.lower() or "quota" in error_msg.lower():
                print_with_color(f"ERROR: Rate limit or quota exceeded for {self.provider}.", "red")
            elif "not found" in error_msg.lower() or "404" in error_msg:
                print_with_color(f"ERROR: Model '{self.model}' not found. Check the model name.", "red")
            else:
                print_with_color(f"ERROR: {self.provider} request failed after {response_time:.2f}s: {error_msg}", "red")

            metadata = {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "response_time": response_time,
                "provider": self.provider,
                "model": self.model,
                "error": error_msg
            }
            return False, f"{self.provider} request failed: {error_msg}", metadata

    def _get_response_legacy(self, prompt: str, images: List[str]) -> tuple[bool, str, dict]:
        """Legacy implementation using requests (basic OpenAI compatibility only)."""
        start_time = time.time()

        # Optimize images before encoding
        optimized_images = []
        for img_path in images:
            optimized_path = optimize_image(img_path)
            optimized_images.append(optimized_path)

        content = [
            {
                "type": "text",
                "text": prompt
            }
        ]

        # Encode images to base64
        for img in optimized_images:
            base64_img = encode_image(img)
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_img}"
                }
            })
            print_with_color(f"Image encoded to base64: {img}", "cyan")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user",
                    "content": content
                }
            ],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }
        try:
            response = requests.post(self.base_url, headers=headers, json=payload, timeout=self.timeout).json()
        except requests.exceptions.Timeout:
            response_time = time.time() - start_time
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, f"Request timeout after {self.timeout} seconds", metadata
        except requests.exceptions.RequestException as e:
            response_time = time.time() - start_time
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, f"Request failed: {str(e)}", metadata
        except Exception as e:
            response_time = time.time() - start_time
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, f"Failed to parse response: {str(e)}", metadata

        # Calculate response time
        response_time = time.time() - start_time

        # Check for errors in response
        if "error" in response:
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, response["error"]["message"], metadata

        # Check if response has expected structure
        if "choices" not in response or not response["choices"]:
            print_with_color("ERROR: No 'choices' in model response", "red")
            print_with_color(f"Response: {response}", "red")
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, "Invalid response format: missing 'choices'", metadata

        # Extract content
        message = response["choices"][0]["message"]
        content = message.get("content", "")

        if not content or len(content.strip()) == 0:
            print_with_color("WARNING: Model returned empty content", "yellow")
            metadata = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0, "response_time": response_time, "provider": "OpenAI-compatible", "model": self.model}
            return False, "Model returned empty response", metadata

        # Collect usage metadata
        prompt_tokens = 0
        completion_tokens = 0
        total_tokens = 0

        if "usage" in response:
            usage = response["usage"]
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
            print_with_color(f"Tokens - Prompt: {prompt_tokens}, Completion: {completion_tokens}", "yellow")

        # Print response time
        print_with_color(f"Response time: {response_time:.2f}s", "yellow")

        metadata = {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "response_time": response_time,
            "provider": "OpenAI-compatible",
            "model": self.model
        }

        return True, content, metadata


def _parse_action_string(act: str) -> list:
    """Parse action string like 'tap(9)' or 'swipe(1, "up", "medium")' into structured result."""
    if "FINISH" in act:
        return ["FINISH"]
    
    act_name = act.split("(")[0].strip()
    
    if act_name == "tap":
        area = int(re.findall(r"tap\((.*?)\)", act)[0])
        return [act_name, area]
    elif act_name == "text":
        input_str = re.findall(r"text\((.*?)\)", act)[0]
        # Remove quotes if present
        if input_str.startswith('"') and input_str.endswith('"'):
            input_str = input_str[1:-1]
        elif input_str.startswith("'") and input_str.endswith("'"):
            input_str = input_str[1:-1]
        return [act_name, input_str]
    elif act_name == "long_press":
        area = int(re.findall(r"long_press\((.*?)\)", act)[0])
        return [act_name, area]
    elif act_name == "swipe":
        params = re.findall(r"swipe\((.*?)\)", act)[0]
        area, swipe_dir, dist = params.split(",")
        area = int(area)
        swipe_dir = swipe_dir.strip().strip('"\'')
        dist = dist.strip().strip('"\'')
        return [act_name, area, swipe_dir, dist]
    elif act_name == "grid":
        return [act_name]
    else:
        return ["ERROR", act_name]


def parse_explore_rsp(rsp):
    """Parse exploration response. Tries JSON first, falls back to regex."""
    
    # Try JSON parsing first
    try:
        data = json.loads(rsp)
        # Handle case-insensitive keys
        observation = data.get("Observation") or data.get("observation", "")
        think = data.get("Thought") or data.get("thought", "")
        act = data.get("Action") or data.get("action", "")
        last_act = data.get("Summary") or data.get("summary", "No summary available")
        
        print_with_color("✓ JSON parsed successfully", "green")
        print_with_color("Observation:", "yellow")
        print_with_color(observation, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")
        print_with_color("Action:", "yellow")
        print_with_color(act, "magenta")
        print_with_color("Summary:", "yellow")
        print_with_color(last_act, "magenta")
        
        # Parse action
        action_result = _parse_action_string(act)
        if action_result[0] == "FINISH":
            return ["FINISH", observation, think, act, last_act]
        elif action_result[0] == "ERROR":
            print_with_color(f"ERROR: Undefined act {action_result[1]}!", "red")
            return ["ERROR"]
        elif action_result[0] == "tap":
            return ["tap", action_result[1], last_act, observation, think, act]
        elif action_result[0] == "text":
            return ["text", action_result[1], last_act, observation, think, act]
        elif action_result[0] == "long_press":
            return ["long_press", action_result[1], last_act, observation, think, act]
        elif action_result[0] == "swipe":
            return ["swipe", action_result[1], action_result[2], action_result[3], last_act, observation, think, act]
        elif action_result[0] == "grid":
            return ["grid", observation, think, act, last_act]
        
    except json.JSONDecodeError:
        print_with_color("JSON parse failed, trying regex fallback...", "yellow")
    
    # Fallback to regex parsing
    try:
        observation = re.findall(r"Observation: (.*?)$", rsp, re.MULTILINE)[0].strip()
        think = re.findall(r"Thought: (.*?)$", rsp, re.MULTILINE)[0].strip()
        act = re.findall(r"Action: (.*?)$", rsp, re.MULTILINE)[0].strip()
        # Handle cases where Summary is missing (common with local models)
        summary_matches = re.findall(r"Summary: (.*?)$", rsp, re.MULTILINE)
        last_act = summary_matches[0].strip() if summary_matches else "No summary available"
        print_with_color("Observation:", "yellow")
        print_with_color(observation, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")
        print_with_color("Action:", "yellow")
        print_with_color(act, "magenta")
        print_with_color("Summary:", "yellow")
        print_with_color(last_act, "magenta")
        if "FINISH" in act:
            return ["FINISH", observation, think, act, last_act]
        act_name = act.split("(")[0].strip()
        if act_name == "tap":
            area = int(re.findall(r"tap\((.*?)\)", act)[0])
            return [act_name, area, last_act, observation, think, act]
        elif act_name == "text":
            input_str = re.findall(r"text\((.*?)\)", act)[0][1:-1]
            return [act_name, input_str, last_act, observation, think, act]
        elif act_name == "long_press":
            area = int(re.findall(r"long_press\((.*?)\)", act)[0])
            return [act_name, area, last_act, observation, think, act]
        elif act_name == "swipe":
            params = re.findall(r"swipe\((.*?)\)", act)[0]
            area, swipe_dir, dist = params.split(",")
            area = int(area)
            swipe_dir = swipe_dir.strip()[1:-1]
            dist = dist.strip()[1:-1]
            return [act_name, area, swipe_dir, dist, last_act, observation, think, act]
        elif act_name == "grid":
            return [act_name, observation, think, act, last_act]
        else:
            print_with_color(f"ERROR: Undefined act {act_name}!", "red")
            return ["ERROR"]
    except Exception as e:
        print_with_color(f"ERROR: an exception occurs while parsing the model response: {e}", "red")
        print_with_color(rsp, "red")
        return ["ERROR"]


def _parse_grid_action_string(act: str) -> list:
    """Parse grid action string like 'tap(1, "center")' into structured result."""
    if "FINISH" in act:
        return ["FINISH"]
    
    act_name = act.split("(")[0].strip()
    
    if act_name == "tap":
        params = re.findall(r"tap\((.*?)\)", act)[0].split(",")
        area = int(params[0].strip())
        subarea = params[1].strip().strip('"\'')
        return ["tap_grid", area, subarea]
    elif act_name == "long_press":
        params = re.findall(r"long_press\((.*?)\)", act)[0].split(",")
        area = int(params[0].strip())
        subarea = params[1].strip().strip('"\'')
        return ["long_press_grid", area, subarea]
    elif act_name == "swipe":
        params = re.findall(r"swipe\((.*?)\)", act)[0].split(",")
        start_area = int(params[0].strip())
        start_subarea = params[1].strip().strip('"\'')
        end_area = int(params[2].strip())
        end_subarea = params[3].strip().strip('"\'')
        return ["swipe_grid", start_area, start_subarea, end_area, end_subarea]
    elif act_name == "grid":
        return ["grid"]
    else:
        return ["ERROR", act_name]


def parse_grid_rsp(rsp):
    """Parse grid mode response. Tries JSON first, falls back to regex."""
    
    # Try JSON parsing first
    try:
        data = json.loads(rsp)
        observation = data.get("Observation") or data.get("observation", "")
        think = data.get("Thought") or data.get("thought", "")
        act = data.get("Action") or data.get("action", "")
        last_act = data.get("Summary") or data.get("summary", "No summary available")
        
        print_with_color("✓ JSON parsed successfully", "green")
        print_with_color("Observation:", "yellow")
        print_with_color(observation, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")
        print_with_color("Action:", "yellow")
        print_with_color(act, "magenta")
        print_with_color("Summary:", "yellow")
        print_with_color(last_act, "magenta")
        
        action_result = _parse_grid_action_string(act)
        if action_result[0] == "FINISH":
            return ["FINISH", observation, think, act, last_act]
        elif action_result[0] == "ERROR":
            print_with_color(f"ERROR: Undefined act {action_result[1]}!", "red")
            return ["ERROR"]
        elif action_result[0] == "tap_grid":
            return ["tap_grid", action_result[1], action_result[2], last_act, observation, think, act]
        elif action_result[0] == "long_press_grid":
            return ["long_press_grid", action_result[1], action_result[2], last_act, observation, think, act]
        elif action_result[0] == "swipe_grid":
            return ["swipe_grid", action_result[1], action_result[2], action_result[3], action_result[4], last_act, observation, think, act]
        elif action_result[0] == "grid":
            return ["grid", observation, think, act, last_act]
            
    except json.JSONDecodeError:
        print_with_color("JSON parse failed, trying regex fallback...", "yellow")
    
    # Fallback to regex parsing
    try:
        observation = re.findall(r"Observation: (.*?)$", rsp, re.MULTILINE)[0].strip()
        think = re.findall(r"Thought: (.*?)$", rsp, re.MULTILINE)[0].strip()
        act = re.findall(r"Action: (.*?)$", rsp, re.MULTILINE)[0].strip()
        summary_matches = re.findall(r"Summary: (.*?)$", rsp, re.MULTILINE)
        last_act = summary_matches[0].strip() if summary_matches else "No summary available"
        print_with_color("Observation:", "yellow")
        print_with_color(observation, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")
        print_with_color("Action:", "yellow")
        print_with_color(act, "magenta")
        print_with_color("Summary:", "yellow")
        print_with_color(last_act, "magenta")
        if "FINISH" in act:
            return ["FINISH", observation, think, act, last_act]
        act_name = act.split("(")[0].strip()
        if act_name == "tap":
            params = re.findall(r"tap\((.*?)\)", act)[0].split(",")
            area = int(params[0].strip())
            subarea = params[1].strip()[1:-1]
            return [act_name + "_grid", area, subarea, last_act, observation, think, act]
        elif act_name == "long_press":
            params = re.findall(r"long_press\((.*?)\)", act)[0].split(",")
            area = int(params[0].strip())
            subarea = params[1].strip()[1:-1]
            return [act_name + "_grid", area, subarea, last_act, observation, think, act]
        elif act_name == "swipe":
            params = re.findall(r"swipe\((.*?)\)", act)[0].split(",")
            start_area = int(params[0].strip())
            start_subarea = params[1].strip()[1:-1]
            end_area = int(params[2].strip())
            end_subarea = params[3].strip()[1:-1]
            return [act_name + "_grid", start_area, start_subarea, end_area, end_subarea, last_act, observation, think, act]
        elif act_name == "grid":
            return [act_name, observation, think, act, last_act]
        else:
            print_with_color(f"ERROR: Undefined act {act_name}!", "red")
            return ["ERROR"]
    except Exception as e:
        print_with_color(f"ERROR: an exception occurs while parsing the model response: {e}", "red")
        print_with_color(rsp, "red")
        return ["ERROR"]


def parse_reflect_rsp(rsp):
    """Parse reflection response. Tries JSON first, falls back to regex."""
    
    # Check if response is empty or too short
    if not rsp or len(rsp.strip()) < 10:
        print_with_color("ERROR: Model response is empty or too short", "red")
        print_with_color(f"Response: '{rsp}'", "red")
        return ["ERROR"]
    
    # Try JSON parsing first
    try:
        data = json.loads(rsp)
        decision = data.get("Decision") or data.get("decision", "")
        think = data.get("Thought") or data.get("thought", "")
        doc = data.get("Documentation") or data.get("documentation")
        
        print_with_color("✓ JSON parsed successfully", "green")
        print_with_color("Decision:", "yellow")
        print_with_color(decision, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")
        
        if decision == "INEFFECTIVE":
            return [decision, think, None]
        elif decision in ["BACK", "CONTINUE", "SUCCESS"]:
            if not doc:
                print_with_color("WARNING: No 'Documentation' found, using placeholder", "yellow")
                doc = "No documentation available"
            print_with_color("Documentation:", "yellow")
            print_with_color(doc, "magenta")
            return [decision, think, doc]
        else:
            print_with_color(f"ERROR: Undefined decision {decision}!", "red")
            return ["ERROR"]
            
    except json.JSONDecodeError:
        print_with_color("JSON parse failed, trying regex fallback...", "yellow")
    
    # Fallback to regex parsing
    try:
        decision_matches = re.findall(r"Decision: (.*?)$", rsp, re.MULTILINE)
        think_matches = re.findall(r"Thought: (.*?)$", rsp, re.MULTILINE)

        if not decision_matches:
            print_with_color("ERROR: No 'Decision:' found in model response", "red")
            print_with_color(rsp, "red")
            return ["ERROR"]

        if not think_matches:
            print_with_color("ERROR: No 'Thought:' found in model response", "red")
            print_with_color(rsp, "red")
            return ["ERROR"]

        decision = decision_matches[0].strip()
        think = think_matches[0].strip()

        print_with_color("Decision:", "yellow")
        print_with_color(decision, "magenta")
        print_with_color("Thought:", "yellow")
        print_with_color(think, "magenta")

        if decision == "INEFFECTIVE":
            return [decision, think, None]
        elif decision == "BACK" or decision == "CONTINUE" or decision == "SUCCESS":
            doc_matches = re.findall(r"Documentation: (.*?)$", rsp, re.MULTILINE)
            if not doc_matches:
                print_with_color("WARNING: No 'Documentation:' found, using placeholder", "yellow")
                doc = "No documentation available"
            else:
                doc = doc_matches[0].strip()
            print_with_color("Documentation:", "yellow")
            print_with_color(doc, "magenta")
            return [decision, think, doc]
        else:
            print_with_color(f"ERROR: Undefined decision {decision}!", "red")
            return ["ERROR"]
    except Exception as e:
        print_with_color(f"ERROR: an exception occurs while parsing the model response: {e}", "red")
        print_with_color(rsp, "red")
        return ["ERROR"]
