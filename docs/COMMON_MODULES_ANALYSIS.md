# 공통 모듈 분석 및 추출 계획

## 목차
- [현황 분석](#현황-분석)
- [공통 모듈 정의](#공통-모듈-정의)
- [상세 설계](#상세-설계)
- [마이그레이션 계획](#마이그레이션-계획)

---

## 현황 분석

### 1. LiteLLM 통합 현황

#### AppAgent (`agents/appagent/scripts/model.py`)
```python
# ✅ 최신 LiteLLM 구현
from litellm import completion

class OpenAIModel(BaseModel):
    """
    Universal Model API using LiteLLM.
    Supports 100+ providers:
    - Ollama (local)
    - OpenAI (gpt-4o, gpt-4-turbo)
    - Anthropic Claude
    - Google Gemini
    - xAI Grok
    - OpenRouter
    - Mistral, DeepSeek, etc.
    """

    def __init__(self, base_url, api_key, model, temperature, max_tokens):
        self.provider = self._detect_provider(model)
        self.use_json_mode = True
        self.use_streaming = (provider == "Ollama")
        # Timeout: Qwen3 = 600s, others = 300s
```

**특징**:
- Provider 자동 감지 (`ollama/`, `claude-`, `gpt-`, etc.)
- JSON mode 지원 (provider별 다름)
- Streaming 지원 (Ollama만)
- Qwen3 <think> 모드 지원
- 토큰 카운팅
- 성능 메트릭

#### GELab-Zero (`agents/gelab-zero/tools/ask_llm_v2.py`)
```python
# ❌ 구식 OpenAI API 직접 호출
import openai

def ask_llm_anything(model_provider, model_name, messages):
    with smart_open("model_config.yaml", "r") as f:
        model_config = yaml.safe_load(f)

    openai.api_base = model_config[model_provider]["api_base"]
    openai.api_key = model_config[model_provider]["api_key"]

    completion = openai.ChatCompletion.create(
        model=model_name,
        messages=messages,
        temperature=0.5
    )
```

**문제점**:
- 구식 OpenAI SDK 사용 (deprecated)
- `model_config.yaml` 별도 관리 (Electron config.json과 분리)
- Provider 수동 지정 필요
- LiteLLM 미사용 (100+ provider 지원 불가)
- 토큰 카운팅 미흡

---

### 2. Android/에뮬레이터 코드 현황

#### AppAgent (`agents/appagent/scripts/and_controller.py`)
```python
# Android/Emulator 제어 함수들
def list_available_emulators() -> list[str]:
    """List all available AVDs"""

def start_emulator(avd_name=None, wait_for_boot=True) -> str:
    """Start emulator and return device serial"""

def start_emulator_with_app(avd_name, app_name, wait_for_boot=True) -> tuple[str, str]:
    """Start emulator and install/launch app"""

def stop_emulator(device_serial=None):
    """Stop emulator by serial"""

def cleanup_emulators():
    """Stop all running emulators"""
```

**특징**:
- ADB 명령 래퍼
- 에뮬레이터 생명주기 관리
- 앱 설치/실행 통합
- 부팅 대기 로직

#### GELab-Zero
- 에뮬레이터 관련 코드가 여러 파일에 분산
- AppAgent와 중복

---

### 3. Google Login 코드 현황

#### Web Login (`agents/appagent/scripts/google_login.py`)
```python
def check_google_login_from_storage(profile_dir: str) -> dict:
    """Check if already logged in (storage state JSON)"""

def start_google_login(profile_dir, timeout=600, browser_type='chromium') -> dict:
    """Launch browser for Google login with Playwright"""
```

**특징**:
- Playwright 기반
- Persistent context (브라우저 프로필)
- Storage state 저장 (cookies)
- 여러 브라우저 지원 (chromium, chrome, firefox, webkit)

#### Android Login (`agents/appagent/scripts/google_login_android.py`)
```python
def start_google_login_android(device_serial: str) -> dict:
    """Android Google login automation"""
```

**특징**:
- ADB 명령 사용
- Android OS 수준 자동화

---

### 4. 공통 유틸리티 현황

#### Image Processing
- `encode_image()`: 이미지 → base64
- `optimize_image()`: 이미지 압축/리사이즈
- 사용처: AppAgent, GELab, Browser-Use 모두

#### Output Formatting
- `print_with_color()`: 컬러 출력
- `append_to_log()`: 마크다운 로그
- 사용처: 모든 에이전트

#### Config Loading
- AppAgent: 환경 변수 우선, yaml fallback
- GELab: yaml 파일 직접 읽기
- 통합 필요

---

## 공통 모듈 정의

### 폴더 구조 (최종)

```
agents/
├── shared/                         # 공통 모듈 (모든 에이전트가 사용)
│   ├── __init__.py
│   │
│   ├── llm/                        # 🆕 LLM 통합
│   │   ├── __init__.py
│   │   ├── base_model.py          # BaseModel 인터페이스
│   │   ├── litellm_model.py       # LiteLLM 통합 (OpenAIModel 이동)
│   │   ├── model_factory.py       # 모델 생성 팩토리
│   │   └── utils.py               # Provider 감지, timeout 계산 등
│   │
│   ├── android/                    # 🆕 Android 공통 기능
│   │   ├── __init__.py
│   │   ├── emulator.py            # 에뮬레이터 관리 (from and_controller)
│   │   ├── adb_wrapper.py         # ADB 명령 래퍼
│   │   └── google_login_android.py # Android Google 로그인
│   │
│   ├── web/                        # 🆕 Web 공통 기능
│   │   ├── __init__.py
│   │   └── google_login.py        # Web Google 로그인 (Playwright)
│   │
│   ├── utils/                      # 🆕 공통 유틸리티
│   │   ├── __init__.py
│   │   ├── image.py               # encode_image, optimize_image
│   │   ├── output.py              # print_with_color, append_to_log
│   │   ├── config.py              # 통합 설정 로더
│   │   └── progress.py            # 진행 상황 리포팅
│   │
│   └── schemas/                    # 🆕 공통 데이터 스키마
│       ├── __init__.py
│       ├── action.py              # Action 스키마
│       ├── task.py                # Task 스키마
│       └── response.py            # LLM Response 스키마
│
├── appagent/                       # AppAgent (Android only)
│   └── scripts/
│       ├── self_explorer.py       # Uses shared.llm, shared.android
│       ├── and_controller.py      # 🔄 Remove emulator functions (moved to shared)
│       └── ...
│
├── browser-use/                    # Browser-Use (Web only)
│   └── scripts/
│       ├── self_explorer.py       # Uses shared.llm, shared.web
│       ├── browser_use_wrapper.py # Uses shared.llm.litellm_model
│       └── ...
│
└── gelab-zero/                     # GELab-Zero (Android only)
    ├── tools/
    │   └── ask_llm_v2.py          # 🗑️ DEPRECATED, use shared.llm
    └── klever_wrapper/
        └── self_explorer.py       # 🔄 Migrate to shared.llm, shared.android
```

---

## 상세 설계

### 1. LLM 통합 모듈 (`shared/llm/`)

#### `base_model.py`
```python
"""
Base model interface for all LLM integrations.
"""
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Tuple


class BaseModel(ABC):
    """Base interface for all LLM models"""

    @abstractmethod
    def get_model_response(self, prompt: str, images: List[str]) -> Tuple[bool, str, Dict[str, Any]]:
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
```

#### `litellm_model.py`
```python
"""
LiteLLM-based model implementation supporting 100+ providers.
Migrated from agents/appagent/scripts/model.py
"""
from typing import List, Dict, Any, Tuple, Optional
from .base_model import BaseModel

try:
    from litellm import completion
    LITELLM_AVAILABLE = True
except ImportError:
    LITELLM_AVAILABLE = False


class LiteLLMModel(BaseModel):
    """
    Universal LLM API using LiteLLM.

    Supports:
    - Ollama (ollama/model-name)
    - OpenAI (gpt-4o, gpt-4-turbo)
    - Anthropic (claude-3-5-sonnet, claude-opus-4)
    - Google (gemini-2.0-flash-exp)
    - xAI (grok-beta)
    - OpenRouter (openrouter/provider/model)
    - 95+ more providers
    """

    def __init__(
        self,
        model: str,
        api_key: str = "",
        base_url: str = "",
        temperature: float = 0.0,
        max_tokens: int = 4096,
        configs: Optional[Dict[str, Any]] = None
    ):
        if not LITELLM_AVAILABLE:
            raise ImportError("litellm is not installed. Run: pip install litellm")

        self.model = model
        self.api_key = api_key
        self.base_url = base_url
        self.temperature = float(temperature)
        self.max_tokens = int(max_tokens)
        self.configs = configs or {}

        # Auto-detect provider
        self.provider = self._detect_provider(model)

        # Timeout settings
        self.timeout = self._get_timeout()

        # JSON mode
        self.use_json_mode = self.configs.get("USE_JSON_MODE", True)

        # Streaming (only for Ollama)
        self.use_streaming = self.provider == "Ollama" and self.configs.get("USE_STREAMING", True)

    def _detect_provider(self, model: str) -> str:
        """Detect provider from model name"""
        if model.startswith("ollama/"):
            return "Ollama"
        elif model.startswith("openrouter/"):
            return "OpenRouter"
        elif model.startswith("claude-") or model.startswith("anthropic/"):
            return "Anthropic"
        elif model.startswith("gpt-") or model.startswith("o1-"):
            return "OpenAI"
        elif model.startswith("gemini-") or model.startswith("google/"):
            return "Google Gemini"
        elif model.startswith("grok-") or model.startswith("xai/"):
            return "xAI"
        else:
            return "Generic"

    def _is_qwen3_model(self) -> bool:
        """Check if model is Qwen3 (needs longer timeout for <think>)"""
        return "qwen3" in self.model.lower()

    def _get_timeout(self) -> int:
        """Get appropriate timeout based on model"""
        if self._is_qwen3_model():
            return self.configs.get("QWEN3_TIMEOUT", 600)  # 10 minutes
        return self.configs.get("REQUEST_TIMEOUT", 300)  # 5 minutes

    def _get_json_format_params(self) -> Dict[str, Any]:
        """Get JSON format parameters based on provider"""
        if not self.use_json_mode:
            return {}

        # Qwen3: JSON mode conflicts with <think>, disable
        if self._is_qwen3_model():
            return {}

        if self.provider == "Ollama":
            return {"format": "json"}
        elif self.provider in ["OpenAI", "Azure OpenAI"]:
            return {"response_format": {"type": "json_object"}}
        elif self.provider == "Google Gemini":
            return {"response_mime_type": "application/json"}
        else:
            return {}

    def get_model_response(
        self,
        prompt: str,
        images: List[str]
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """
        Get model response using LiteLLM.

        Args:
            prompt: Text prompt
            images: List of image paths or base64 strings

        Returns:
            (success, response, metadata)
        """
        import time
        from shared.utils.image import encode_image

        # Build messages
        content = [{"type": "text", "text": prompt}]

        for img in images:
            content.append({
                "type": "image_url",
                "image_url": {"url": encode_image(img)}
            })

        messages = [{"role": "user", "content": content}]

        # Call LiteLLM
        start_time = time.time()

        try:
            response = completion(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                api_key=self.api_key,
                api_base=self.base_url if self.base_url else None,
                timeout=self.timeout,
                stream=self.use_streaming,
                **self._get_json_format_params()
            )

            response_time = time.time() - start_time

            # Extract response
            if self.use_streaming:
                # Handle streaming
                full_response = ""
                for chunk in response:
                    if chunk.choices[0].delta.content:
                        full_response += chunk.choices[0].delta.content
                response_text = full_response
                # Token counting not available in streaming
                metadata = {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                    "response_time": response_time,
                    "provider": self.provider,
                    "model": self.model
                }
            else:
                # Non-streaming
                response_text = response.choices[0].message.content
                usage = response.usage
                metadata = {
                    "prompt_tokens": usage.prompt_tokens,
                    "completion_tokens": usage.completion_tokens,
                    "total_tokens": usage.total_tokens,
                    "response_time": response_time,
                    "provider": self.provider,
                    "model": self.model
                }

            return True, response_text, metadata

        except Exception as e:
            error_msg = f"LiteLLM error: {str(e)}"
            return False, error_msg, {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
                "response_time": time.time() - start_time,
                "provider": self.provider,
                "model": self.model,
                "error": error_msg
            }
```

#### `model_factory.py`
```python
"""
Model factory for creating appropriate model instances.
"""
from typing import Dict, Any, Optional
from .base_model import BaseModel
from .litellm_model import LiteLLMModel


def create_model(
    model_name: str,
    api_key: str = "",
    base_url: str = "",
    temperature: float = 0.0,
    max_tokens: int = 4096,
    configs: Optional[Dict[str, Any]] = None
) -> BaseModel:
    """
    Create a model instance.

    Currently only supports LiteLLM, but can be extended
    to support other implementations in the future.

    Args:
        model_name: Model identifier (e.g., "ollama/llama3.2-vision", "gpt-4o")
        api_key: API key (empty for local models like Ollama)
        base_url: Base URL (empty for default endpoints)
        temperature: Generation temperature (0.0 - 2.0)
        max_tokens: Maximum tokens to generate
        configs: Additional configuration dict

    Returns:
        BaseModel instance
    """
    return LiteLLMModel(
        model=model_name,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        configs=configs
    )
```

---

### 2. Android 공통 모듈 (`shared/android/`)

#### `emulator.py`
```python
"""
Android emulator management functions.
Extracted from agents/appagent/scripts/and_controller.py
"""
import subprocess
import time
from typing import List, Optional, Tuple
from shared.utils.output import print_with_color


def list_available_emulators() -> List[str]:
    """
    List all available Android Virtual Devices (AVDs).

    Returns:
        List of AVD names
    """
    try:
        result = subprocess.run(
            ['emulator', '-list-avds'],
            capture_output=True,
            text=True,
            check=True
        )
        avds = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]
        return avds
    except Exception as e:
        print_with_color(f"Error listing emulators: {e}", "red")
        return []


def start_emulator(
    avd_name: Optional[str] = None,
    wait_for_boot: bool = True,
    timeout: int = 120
) -> Optional[str]:
    """
    Start an Android emulator.

    Args:
        avd_name: AVD name (if None, uses first available)
        wait_for_boot: Wait for boot completion
        timeout: Boot timeout in seconds

    Returns:
        Device serial number, or None if failed
    """
    if not avd_name:
        avds = list_available_emulators()
        if not avds:
            print_with_color("No AVDs available", "red")
            return None
        avd_name = avds[0]

    print_with_color(f"Starting emulator: {avd_name}", "cyan")

    try:
        # Start emulator in background
        subprocess.Popen(
            ['emulator', '-avd', avd_name, '-no-snapshot-load'],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )

        if wait_for_boot:
            return _wait_for_emulator_boot(timeout)
        else:
            return None

    except Exception as e:
        print_with_color(f"Error starting emulator: {e}", "red")
        return None


def _wait_for_emulator_boot(timeout: int) -> Optional[str]:
    """Wait for emulator to boot and return device serial"""
    print_with_color("Waiting for emulator to boot...", "yellow")

    start_time = time.time()
    while time.time() - start_time < timeout:
        # Check for connected devices
        result = subprocess.run(
            ['adb', 'devices'],
            capture_output=True,
            text=True
        )

        lines = result.stdout.strip().split('\n')[1:]  # Skip header
        for line in lines:
            if 'emulator' in line and 'device' in line:
                device_serial = line.split()[0]

                # Check boot completion
                boot_check = subprocess.run(
                    ['adb', '-s', device_serial, 'shell', 'getprop', 'sys.boot_completed'],
                    capture_output=True,
                    text=True
                )

                if boot_check.stdout.strip() == '1':
                    print_with_color(f"Emulator ready: {device_serial}", "green")
                    return device_serial

        time.sleep(2)

    print_with_color("Emulator boot timeout", "red")
    return None


def stop_emulator(device_serial: Optional[str] = None):
    """
    Stop an emulator.

    Args:
        device_serial: Device serial (if None, stops all emulators)
    """
    if device_serial:
        print_with_color(f"Stopping emulator: {device_serial}", "yellow")
        subprocess.run(['adb', '-s', device_serial, 'emu', 'kill'])
    else:
        cleanup_emulators()


def cleanup_emulators():
    """Stop all running emulators"""
    print_with_color("Cleaning up all emulators...", "yellow")

    result = subprocess.run(
        ['adb', 'devices'],
        capture_output=True,
        text=True
    )

    lines = result.stdout.strip().split('\n')[1:]
    for line in lines:
        if 'emulator' in line:
            device_serial = line.split()[0]
            subprocess.run(['adb', '-s', device_serial, 'emu', 'kill'])

    print_with_color("Emulator cleanup complete", "green")


def start_emulator_with_app(
    avd_name: Optional[str] = None,
    app_package: Optional[str] = None,
    apk_path: Optional[str] = None,
    wait_for_boot: bool = True
) -> Tuple[Optional[str], Optional[str]]:
    """
    Start emulator and install/launch app.

    Args:
        avd_name: AVD name
        app_package: App package name
        apk_path: Path to APK file
        wait_for_boot: Wait for boot completion

    Returns:
        (device_serial, package_name)
    """
    device_serial = start_emulator(avd_name, wait_for_boot)
    if not device_serial:
        return None, None

    if apk_path:
        # Install APK
        print_with_color(f"Installing APK: {apk_path}", "cyan")
        subprocess.run(['adb', '-s', device_serial, 'install', apk_path])

        # Extract package name if not provided
        if not app_package:
            result = subprocess.run(
                ['aapt', 'dump', 'badging', apk_path],
                capture_output=True,
                text=True
            )
            for line in result.stdout.split('\n'):
                if line.startswith('package: name='):
                    app_package = line.split("'")[1]
                    break

    if app_package:
        # Launch app
        print_with_color(f"Launching app: {app_package}", "cyan")
        subprocess.run([
            'adb', '-s', device_serial, 'shell',
            'monkey', '-p', app_package, '-c', 'android.intent.category.LAUNCHER', '1'
        ])
        time.sleep(3)  # Wait for app to start

    return device_serial, app_package
```

#### `adb_wrapper.py`
```python
"""
ADB command wrapper utilities.
"""
import subprocess
from typing import Optional, List
from shared.utils.output import print_with_color


def adb_shell(
    device_serial: str,
    command: str,
    timeout: int = 30
) -> Optional[str]:
    """
    Execute ADB shell command.

    Args:
        device_serial: Device serial
        command: Shell command
        timeout: Command timeout

    Returns:
        Command output, or None if failed
    """
    try:
        result = subprocess.run(
            ['adb', '-s', device_serial, 'shell', command],
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.stdout.strip()
    except Exception as e:
        print_with_color(f"ADB shell error: {e}", "red")
        return None


def get_connected_devices() -> List[str]:
    """
    Get list of connected devices.

    Returns:
        List of device serials
    """
    result = subprocess.run(
        ['adb', 'devices'],
        capture_output=True,
        text=True
    )

    devices = []
    lines = result.stdout.strip().split('\n')[1:]  # Skip header
    for line in lines:
        if '\tdevice' in line:
            devices.append(line.split()[0])

    return devices


def take_screenshot(
    device_serial: str,
    output_path: str,
    screenshot_dir: str = "/sdcard"
) -> bool:
    """
    Take screenshot from device.

    Args:
        device_serial: Device serial
        output_path: Local output path
        screenshot_dir: Remote screenshot directory

    Returns:
        True if successful
    """
    remote_path = f"{screenshot_dir}/screenshot.png"

    try:
        # Capture screenshot
        subprocess.run(
            ['adb', '-s', device_serial, 'shell', 'screencap', '-p', remote_path],
            check=True
        )

        # Pull to local
        subprocess.run(
            ['adb', '-s', device_serial, 'pull', remote_path, output_path],
            check=True
        )

        return True
    except Exception as e:
        print_with_color(f"Screenshot error: {e}", "red")
        return False
```

---

### 3. Web 공통 모듈 (`shared/web/`)

#### `google_login.py`
```python
"""
Google Login for web using Playwright.
Moved from agents/appagent/scripts/google_login.py
"""
# (동일한 코드, 위치만 이동)
```

---

### 4. 유틸리티 모듈 (`shared/utils/`)

#### `image.py`
```python
"""
Image processing utilities.
"""
import base64
from PIL import Image
from io import BytesIO
from typing import Optional


def encode_image(image_path: str) -> str:
    """
    Encode image to base64 data URL.

    Args:
        image_path: Path to image file

    Returns:
        Data URL (data:image/png;base64,...)
    """
    with open(image_path, "rb") as f:
        image_data = f.read()

    b64 = base64.b64encode(image_data).decode('utf-8')

    # Detect format
    if image_data[0:4] == b"\x89PNG":
        mime = "image/png"
    elif image_data[0:2] == b"\xff\xd8":
        mime = "image/jpeg"
    else:
        mime = "image/png"

    return f"data:{mime};base64,{b64}"


def optimize_image(
    image_path: str,
    max_width: int = 1280,
    max_height: int = 720,
    quality: int = 95,
    compress: bool = True
) -> str:
    """
    Optimize image (resize + compress).

    Args:
        image_path: Input image path
        max_width: Maximum width
        max_height: Maximum height
        quality: JPEG quality (1-100)
        compress: Enable compression

    Returns:
        Optimized image as base64 data URL
    """
    img = Image.open(image_path)

    # Resize if needed
    if img.width > max_width or img.height > max_height:
        img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

    # Convert to RGB (for JPEG)
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Save to bytes
    buffer = BytesIO()
    if compress:
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
    else:
        img.save(buffer, format='PNG')

    image_bytes = buffer.getvalue()
    b64 = base64.b64encode(image_bytes).decode('utf-8')

    mime = "image/jpeg" if compress else "image/png"
    return f"data:{mime};base64,{b64}"
```

#### `output.py`
```python
"""
Output formatting utilities.
"""
import sys


def print_with_color(text: str, color: str):
    """
    Print colored text to stdout.

    Args:
        text: Text to print
        color: Color name (red, green, yellow, blue, cyan, magenta, reset)
    """
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "magenta": "\033[95m",
        "cyan": "\033[96m",
        "reset": "\033[0m"
    }

    color_code = colors.get(color, "")
    reset_code = colors["reset"]

    print(f"{color_code}{text}{reset_code}", flush=True)


def append_to_log(text: str, log_path: str):
    """
    Append text to log file (markdown format).

    Args:
        text: Text to append
        log_path: Log file path
    """
    with open(log_path, 'a', encoding='utf-8') as f:
        f.write(text + '\n')
```

#### `config.py`
```python
"""
Unified configuration loader.
Reads from environment variables (set by Electron).
"""
import os
from typing import Dict, Any


def load_config() -> Dict[str, Any]:
    """
    Load configuration from environment variables.
    Environment variables are set by Electron's buildEnvFromConfig().

    Returns:
        Configuration dictionary
    """
    config = {
        # Model configuration
        'MODEL_PROVIDER': os.getenv('MODEL_PROVIDER', 'ollama'),
        'MODEL_NAME': os.getenv('MODEL_NAME', 'ollama/llama3.2-vision'),
        'API_KEY': os.getenv('API_KEY', ''),
        'API_BASE_URL': os.getenv('API_BASE_URL', ''),

        # Execution settings
        'MAX_TOKENS': int(os.getenv('MAX_TOKENS', '4096')),
        'TEMPERATURE': float(os.getenv('TEMPERATURE', '0.0')),
        'REQUEST_INTERVAL': int(os.getenv('REQUEST_INTERVAL', '10')),
        'MAX_ROUNDS': int(os.getenv('MAX_ROUNDS', '20')),

        # Android settings
        'ANDROID_SCREENSHOT_DIR': os.getenv('ANDROID_SCREENSHOT_DIR', '/sdcard'),
        'ANDROID_XML_DIR': os.getenv('ANDROID_XML_DIR', '/sdcard'),

        # Web settings
        'WEB_BROWSER_TYPE': os.getenv('WEB_BROWSER_TYPE', 'chromium'),
        'WEB_VIEWPORT_WIDTH': int(os.getenv('WEB_VIEWPORT_WIDTH', '1280')),
        'WEB_VIEWPORT_HEIGHT': int(os.getenv('WEB_VIEWPORT_HEIGHT', '720')),

        # Image settings
        'IMAGE_MAX_WIDTH': int(os.getenv('IMAGE_MAX_WIDTH', '1280')),
        'IMAGE_MAX_HEIGHT': int(os.getenv('IMAGE_MAX_HEIGHT', '720')),
        'IMAGE_QUALITY': int(os.getenv('IMAGE_QUALITY', '95')),
        'IMAGE_COMPRESSION': os.getenv('IMAGE_COMPRESSION', 'true').lower() == 'true',

        # Preferences
        'OUTPUT_LANGUAGE': os.getenv('OUTPUT_LANGUAGE', 'en'),
        'ENABLE_REFLECTION': os.getenv('ENABLE_REFLECTION', 'true').lower() == 'true',

        # Advanced
        'USE_JSON_MODE': os.getenv('USE_JSON_MODE', 'true').lower() == 'true',
        'USE_STREAMING': os.getenv('USE_STREAMING', 'false').lower() == 'true',
        'REQUEST_TIMEOUT': int(os.getenv('REQUEST_TIMEOUT', '300')),
        'QWEN3_TIMEOUT': int(os.getenv('QWEN3_TIMEOUT', '600')),
    }

    return config
```

---

## 마이그레이션 계획

### Phase 0: 공통 모듈 생성 ✅

**작업**:
1. `agents/shared/` 디렉토리 생성
2. 하위 모듈 디렉토리 생성 (`llm/`, `android/`, `web/`, `utils/`, `schemas/`)
3. `__init__.py` 파일 생성 (각 모듈마다)

```bash
mkdir -p agents/shared/{llm,android,web,utils,schemas}
touch agents/shared/__init__.py
touch agents/shared/{llm,android,web,utils,schemas}/__init__.py
```

---

### Phase 1: LLM 모듈 이동 ✅

**1.1. LiteLLM 모델 추출**
```bash
# AppAgent의 model.py에서 LiteLLM 관련 코드 추출
# → agents/shared/llm/litellm_model.py
```

**작업**:
- [ ] `agents/appagent/scripts/model.py` 읽기
- [ ] `BaseModel`, `OpenAIModel` 클래스 추출
- [ ] `agents/shared/llm/base_model.py` 생성
- [ ] `agents/shared/llm/litellm_model.py` 생성 (OpenAIModel → LiteLLMModel로 이름 변경)
- [ ] `agents/shared/llm/model_factory.py` 생성
- [ ] `agents/shared/llm/__init__.py`에서 export

**1.2. GELab LLM 코드 마이그레이션**
```bash
# GELab의 ask_llm_v2.py를 shared.llm 사용하도록 변경
```

**작업**:
- [ ] `agents/gelab-zero/tools/ask_llm_v2.py`를 deprecated로 표시
- [ ] GELab 스크립트들이 `shared.llm.model_factory`를 import하도록 수정
- [ ] `model_config.yaml` 제거 (Electron의 환경 변수 사용)
- [ ] 테스트: GELab이 LiteLLM으로 정상 작동하는지 확인

---

### Phase 2: Android 모듈 이동 ✅

**2.1. 에뮬레이터 함수 추출**
```bash
# and_controller.py에서 에뮬레이터 관련 함수 추출
# → agents/shared/android/emulator.py
```

**작업**:
- [ ] `agents/appagent/scripts/and_controller.py` 읽기
- [ ] 에뮬레이터 관련 함수 추출:
  - `list_available_emulators()`
  - `start_emulator()`
  - `stop_emulator()`
  - `cleanup_emulators()`
  - `start_emulator_with_app()`
- [ ] `agents/shared/android/emulator.py` 생성
- [ ] `agents/shared/android/adb_wrapper.py` 생성 (ADB 유틸리티)
- [ ] `agents/appagent/scripts/and_controller.py`에서 에뮬레이터 함수 제거
- [ ] AppAgent 스크립트들이 `shared.android.emulator`를 import하도록 수정

**2.2. Android Google Login 이동**
```bash
# google_login_android.py 이동
# → agents/shared/android/google_login_android.py
```

**작업**:
- [ ] `agents/appagent/scripts/google_login_android.py` → `agents/shared/android/` 이동
- [ ] Import 경로 업데이트
- [ ] 테스트: Android Google Login 정상 작동 확인

---

### Phase 3: Web 모듈 이동 ✅

**3.1. Web Google Login 이동**
```bash
# google_login.py 이동
# → agents/shared/web/google_login.py
```

**작업**:
- [ ] `agents/appagent/scripts/google_login.py` → `agents/shared/web/` 이동
- [ ] Import 경로 업데이트
- [ ] Browser-Use에서도 사용하도록 수정
- [ ] 테스트: Web Google Login 정상 작동 확인

---

### Phase 4: 유틸리티 모듈 이동 ✅

**4.1. 이미지 유틸리티 추출**
```bash
# utils.py에서 이미지 관련 함수 추출
# → agents/shared/utils/image.py
```

**작업**:
- [ ] `encode_image()`, `optimize_image()` 함수 추출
- [ ] `agents/shared/utils/image.py` 생성
- [ ] 모든 에이전트에서 `shared.utils.image` import

**4.2. 출력 유틸리티 추출**
```bash
# utils.py에서 출력 관련 함수 추출
# → agents/shared/utils/output.py
```

**작업**:
- [ ] `print_with_color()`, `append_to_log()` 함수 추출
- [ ] `agents/shared/utils/output.py` 생성
- [ ] 모든 에이전트에서 `shared.utils.output` import

**4.3. 설정 로더 생성**
```bash
# 통합 설정 로더 생성
# → agents/shared/utils/config.py
```

**작업**:
- [ ] `agents/shared/utils/config.py` 생성
- [ ] `load_config()` 함수 구현 (환경 변수 → dict)
- [ ] 모든 에이전트에서 `shared.utils.config` import
- [ ] 기존 config.yaml 읽기 코드 제거

---

### Phase 5: 통합 테스트 ✅

**테스트 항목**:
- [ ] AppAgent Android task 실행 (shared 모듈 사용)
- [ ] Browser-Use Web task 실행 (shared 모듈 사용)
- [ ] GELab Android task 실행 (shared 모듈 사용, LiteLLM 통합)
- [ ] Google Login (Web) - shared.web 사용
- [ ] Google Login (Android) - shared.android 사용
- [ ] 에뮬레이터 관리 - shared.android.emulator 사용
- [ ] LiteLLM 100+ providers 테스트:
  - Ollama (local)
  - OpenAI (gpt-4o)
  - Anthropic (claude-3.5-sonnet)
  - Google (gemini-2.0-flash)
  - OpenRouter

---

## 이점

### 1. 코드 중복 제거
- LiteLLM 통합: 1곳에서 관리 (3곳 → 1곳)
- 에뮬레이터 관리: 1곳에서 관리 (2곳 → 1곳)
- Google Login: 1곳에서 관리 (2곳 → 1곳)
- 이미지 처리: 1곳에서 관리 (3곳 → 1곳)

### 2. 일관성
- 모든 에이전트가 동일한 LiteLLM 구현 사용
- 모든 에이전트가 동일한 설정 로더 사용
- 모든 에이전트가 동일한 출력 포맷 사용

### 3. 유지보수성
- LiteLLM 업데이트 시 1곳만 수정
- 버그 수정 시 모든 에이전트에 자동 반영
- 새 기능 추가 시 모든 에이전트가 즉시 사용 가능

### 4. GELab LiteLLM 통합
- ✅ GELab도 100+ provider 지원
- ✅ 구식 OpenAI SDK 제거
- ✅ Electron config.json 통합
- ✅ 토큰 카운팅 정확도 향상

---

## 독립 실행 지원 (Standalone Execution Support)

### ✅ 결론: 독립 실행 가능

공통 모듈을 `agents/shared/`로 추출한 후에도 **각 에이전트는 독립적으로 실행 가능**합니다. Python의 `sys.path` 관리와 적절한 import 구조를 통해 테스트 편의성을 유지할 수 있습니다.

### 작동 원리

#### 1. Python Import 경로 설정

각 에이전트 스크립트는 실행 시 `agents/` 루트를 Python path에 추가하여 `shared` 모듈을 import합니다:

```python
# agents/appagent/scripts/self_explorer.py
import sys
from pathlib import Path

# Add agents root to Python path for shared module access
# Works both standalone and when called from Electron
agents_root = Path(__file__).parent.parent.parent  # ../../
sys.path.insert(0, str(agents_root))

# Now we can import shared modules
from shared.llm.model_factory import create_model
from shared.android.emulator import start_emulator
from shared.utils.config import load_config
from shared.utils.output import print_with_color

# Rest of the script...
```

**경로 구조**:
```
agents/
├── shared/               # Import as: from shared.llm import ...
│   ├── llm/
│   ├── android/
│   └── utils/
├── appagent/             # Current file: agents/appagent/scripts/self_explorer.py
│   └── scripts/
│       └── self_explorer.py  # Path(__file__).parent.parent.parent → agents/
├── browser-use/
└── gelab-zero/
```

#### 2. 독립 실행 방법

**방법 A: PYTHONPATH 환경 변수 설정**

```bash
# From project root
export PYTHONPATH="${PWD}/agents"
python agents/appagent/scripts/self_explorer.py \
  --platform android \
  --app "MyApp" \
  --root_dir ~/Documents/MyApp \
  --task_desc "Open settings and enable notifications"
```

**방법 B: 래퍼 스크립트 생성** (권장)

```bash
# agents/appagent/run_standalone.sh
#!/bin/bash

# Get agents directory (parent of appagent)
AGENTS_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Set Python path to include agents root and shared modules
export PYTHONPATH="${AGENTS_DIR}"

# Set configuration via environment variables
export MODEL_NAME="${MODEL_NAME:-ollama/llama3.2-vision}"
export API_KEY="${API_KEY:-}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:11434}"
export MAX_TOKENS="${MAX_TOKENS:-4096}"
export TEMPERATURE="${TEMPERATURE:-0.0}"
export REQUEST_INTERVAL="${REQUEST_INTERVAL:-10}"
export MAX_ROUNDS="${MAX_ROUNDS:-20}"
export ANDROID_SCREENSHOT_DIR="${ANDROID_SCREENSHOT_DIR:-/sdcard}"
export ANDROID_XML_DIR="${ANDROID_XML_DIR:-/sdcard}"
export OUTPUT_LANGUAGE="${OUTPUT_LANGUAGE:-en}"
export ENABLE_REFLECTION="${ENABLE_REFLECTION:-true}"

# Run the script
python "${AGENTS_DIR}/appagent/scripts/self_explorer.py" "$@"
```

사용 예시:
```bash
cd agents/appagent
chmod +x run_standalone.sh

# Run with default settings
./run_standalone.sh \
  --platform android \
  --app "MyApp" \
  --root_dir ~/Documents/MyApp \
  --task_desc "Open settings"

# Override model
MODEL_NAME="gpt-4o" API_KEY="sk-..." ./run_standalone.sh \
  --platform android \
  --app "MyApp" \
  --task_desc "Test login flow"
```

#### 3. 설정 관리

독립 실행 시 설정은 다음 우선순위로 로드됩니다:

**우선순위 체인**:
```
1. 환경 변수 (최우선)
   ↓
2. 로컬 config.yaml (fallback, 개발/테스트용)
   ↓
3. 하드코딩된 기본값 (최후 수단)
```

**`shared/utils/config.py` 구현**:

```python
import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional

def load_config(config_file: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration with priority:
    1. Environment variables (highest priority)
    2. Local config.yaml (fallback for standalone testing)
    3. Hard-coded defaults (last resort)

    Args:
        config_file: Optional path to config.yaml for standalone mode
    """
    config = {}

    # Try loading from local config file (for standalone testing)
    if config_file and Path(config_file).exists():
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f) or {}
        print(f"[Config] Loaded from {config_file}")

    # Environment variables override everything
    config['MODEL_PROVIDER'] = os.getenv('MODEL_PROVIDER', config.get('model_provider', 'ollama'))
    config['MODEL_NAME'] = os.getenv('MODEL_NAME', config.get('model_name', 'ollama/llama3.2-vision'))
    config['API_KEY'] = os.getenv('API_KEY', config.get('api_key', ''))
    config['API_BASE_URL'] = os.getenv('API_BASE_URL', config.get('api_base_url', ''))

    # Execution settings
    config['MAX_TOKENS'] = int(os.getenv('MAX_TOKENS', config.get('max_tokens', '4096')))
    config['TEMPERATURE'] = float(os.getenv('TEMPERATURE', config.get('temperature', '0.0')))
    config['REQUEST_INTERVAL'] = int(os.getenv('REQUEST_INTERVAL', config.get('request_interval', '10')))
    config['MAX_ROUNDS'] = int(os.getenv('MAX_ROUNDS', config.get('max_rounds', '20')))

    # Android settings
    config['ANDROID_SCREENSHOT_DIR'] = os.getenv('ANDROID_SCREENSHOT_DIR', config.get('android_screenshot_dir', '/sdcard'))
    config['ANDROID_XML_DIR'] = os.getenv('ANDROID_XML_DIR', config.get('android_xml_dir', '/sdcard'))

    # Preferences
    config['OUTPUT_LANGUAGE'] = os.getenv('OUTPUT_LANGUAGE', config.get('output_language', 'en'))
    config['ENABLE_REFLECTION'] = os.getenv('ENABLE_REFLECTION', config.get('enable_reflection', 'true')).lower() == 'true'

    return config
```

#### 4. 독립 실행 테스트 구조

각 에이전트에 테스트용 config 파일 제공:

```yaml
# agents/appagent/config.test.yaml (standalone testing용)
model_provider: ollama
model_name: ollama/llama3.2-vision
api_key: ""
api_base_url: http://localhost:11434

max_tokens: 4096
temperature: 0.0
request_interval: 10
max_rounds: 20

android_screenshot_dir: /sdcard
android_xml_dir: /sdcard

output_language: en
enable_reflection: true
```

스크립트에서 사용:

```python
# agents/appagent/scripts/self_explorer.py
from shared.utils.config import load_config

# Try loading from local test config if exists, otherwise use env vars
config_file = Path(__file__).parent.parent / "config.test.yaml"
config = load_config(str(config_file) if config_file.exists() else None)
```

### Electron vs 독립 실행 비교

| 실행 모드 | Python Path 설정 | 설정 로드 방식 | 사용 사례 |
|----------|-----------------|--------------|-----------|
| **Electron** | `main/utils/python-runtime.ts`에서 자동 설정 | 환경 변수 (22개, `buildEnvFromConfig()`) | 프로덕션, 일반 사용자 |
| **독립 실행** | 스크립트 시작 시 `sys.path.insert()` | 환경 변수 우선 + `config.test.yaml` fallback | 개발, 디버깅, 테스트 |

### 독립 실행 체크리스트

각 에이전트 폴더에 다음 파일들을 추가하여 독립 실행 지원:

```
agents/appagent/
├── scripts/
│   ├── self_explorer.py      # sys.path 설정 코드 포함
│   ├── and_controller.py
│   └── ...
├── run_standalone.sh          # 🆕 독립 실행 래퍼 스크립트
├── config.test.yaml           # 🆕 테스트용 설정 (gitignore)
└── README_STANDALONE.md       # 🆕 독립 실행 가이드
```

### 테스트 권장 사항

1. **유닛 테스트**: 각 에이전트를 독립 실행하여 shared 모듈 import 확인
2. **통합 테스트**: Electron에서 실행하여 전체 플로우 확인
3. **회귀 테스트**: 기존 기능이 정상 작동하는지 확인

```bash
# 독립 실행 테스트
cd agents/appagent
./run_standalone.sh --platform android --app TestApp --task_desc "test"

# Electron 실행 테스트
cd ../..
npm run start
```

### 추가 이점

1. **개발 속도 향상**: Electron 빌드 없이 Python 코드 테스트 가능
2. **디버깅 용이**: IDE에서 직접 Python 스크립트 디버깅 가능
3. **CI/CD 통합**: GitHub Actions에서 에이전트 단독 테스트 가능
4. **문서화 개선**: 각 에이전트의 독립성이 명확히 문서화됨

---

## 우선순위

### HIGH (즉시 시작)
1. **LLM 모듈 이동** - 가장 중요, GELab도 LiteLLM 사용
2. **설정 로더 생성** - 모든 에이전트 통합

### MEDIUM (LLM 완료 후)
3. **Android 모듈 이동** - 에뮬레이터, Google Login
4. **유틸리티 모듈 이동** - 이미지, 출력

### LOW (나중에)
5. **Web 모듈 이동** - Google Login만 있어서 우선순위 낮음

---

## 예상 소요 시간

- **Phase 0**: 1시간 (디렉토리 생성)
- **Phase 1**: 1-2일 (LLM 모듈, GELab 마이그레이션)
- **Phase 2**: 1일 (Android 모듈)
- **Phase 3**: 0.5일 (Web 모듈)
- **Phase 4**: 1일 (유틸리티)
- **Phase 5**: 1일 (통합 테스트)

**총 예상 시간**: 5-6일

---

## 다음 단계

1. 문서 검토 및 승인
2. Phase 0 시작 (디렉토리 구조 생성)
3. Phase 1 시작 (LLM 모듈 - 최우선)

준비되면 알려주세요! 🚀
