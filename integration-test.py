#!/usr/bin/env python3
"""
Integration test for Klever Desktop
Tests model connectivity and basic functionality
"""

import sys
import os
import time
import json
import yaml
import subprocess
import signal


def load_config(config_path="./config.yaml"):
    """Load configuration from YAML file"""
    configs = dict(os.environ)
    with open(config_path, "r") as file:
        yaml_data = yaml.safe_load(file)
    configs.update(yaml_data)
    return configs


def print_with_color(text, color):
    """Print colored text to console"""
    colors = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'cyan': '\033[96m',
        'reset': '\033[0m'
    }
    color_code = colors.get(color, colors['reset'])
    print(f"{color_code}{text}{colors['reset']}")


def test_ollama_connection(config):
    """Test Ollama local model connection"""
    print_with_color("Testing Ollama connection...", "cyan")

    try:
        import ollama

        # Get model name from config
        model = config.get("LOCAL_MODEL", "qwen3-vl:4b")

        # Check if Ollama is running
        try:
            models = ollama.list()
            print_with_color(f"✓ Ollama is running", "green")

            # Check if the required model is available
            model_names = [m['name'] for m in models.get('models', [])]
            if model in model_names or f"{model}:latest" in model_names:
                print_with_color(f"✓ Model '{model}' is available", "green")
            else:
                print_with_color(f"✗ Model '{model}' not found", "red")
                print_with_color(f"Available models: {', '.join(model_names)}", "yellow")
                return False, f"Model '{model}' not found in Ollama"

            # Test simple request
            print_with_color("Testing simple request...", "cyan")
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        'role': 'system',
                        'content': 'You are a helpful assistant. Provide direct, concise responses.'
                    },
                    {
                        'role': 'user',
                        'content': 'Say "OK" if you can hear me.'
                    }
                ],
                options={
                    'temperature': 0.0,
                    'num_predict': 50
                }
            )

            if response and 'message' in response and 'content' in response['message']:
                content = response['message']['content'].strip()
                print_with_color(f"✓ Model responded: {content[:50]}...", "green")
                return True, "Ollama connection successful"
            else:
                print_with_color("✗ Invalid response format", "red")
                return False, "Invalid response format from Ollama"

        except Exception as e:
            print_with_color(f"✗ Ollama connection failed: {str(e)}", "red")
            return False, f"Ollama connection failed: {str(e)}"

    except ImportError:
        print_with_color("✗ Ollama SDK not installed", "red")
        return False, "Ollama SDK not installed"


def test_appagent_execution(config):
    """Test actual appagent execution with Google search"""
    print_with_color("Testing AppAgent execution...", "cyan")
    print_with_color("Starting web automation test on google.com", "cyan")
    print()

    config_path = "./appagent/config.yaml"
    config_backup_path = "./appagent/config.yaml.backup"

    try:
        # Backup original config
        import shutil
        shutil.copy(config_path, config_backup_path)
        print_with_color("✓ Config backed up", "green")

        # Modify MAX_ROUNDS to 2 for quick test
        with open(config_path, "r") as f:
            config_data = yaml.safe_load(f)

        original_max_rounds = config_data.get("MAX_ROUNDS", 20)
        config_data["MAX_ROUNDS"] = 2

        with open(config_path, "w") as f:
            yaml.dump(config_data, f)

        print_with_color("✓ MAX_ROUNDS set to 2 for testing", "green")
        print()

        # Run self_explorer.py
        cmd = [
            sys.executable,  # Use current Python interpreter
            "appagent/scripts/self_explorer.py",
            "--app", "google_search_test",
            "--platform", "web",
            "--root_dir", "./appagent"
        ]

        print_with_color("Executing: " + " ".join(cmd), "cyan")
        print_with_color("-" * 60, "cyan")
        print()

        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )

        # Send URL and task description to stdin
        process.stdin.write("https://www.google.com\n")
        process.stdin.write("Search for 'weather' and click on the search button\n")
        process.stdin.flush()
        process.stdin.close()

        # Stream output in real-time
        output_lines = []
        try:
            for line in process.stdout:
                line = line.rstrip()
                if line:
                    print(line)
                    output_lines.append(line)
                    # Flush to ensure immediate output
                    sys.stdout.flush()

        except KeyboardInterrupt:
            print_with_color("\n✗ Test interrupted by user", "yellow")
            process.send_signal(signal.SIGINT)
            process.wait()
            return False, "Test interrupted by user"

        exit_code = process.wait()

        print()
        print_with_color("-" * 60, "cyan")

        # Check if test was successful
        if exit_code == 0:
            print_with_color("✓ AppAgent executed successfully", "green")
            return True, "AppAgent execution test passed"
        else:
            print_with_color(f"✗ AppAgent exited with code {exit_code}", "red")
            return False, f"AppAgent execution failed with exit code {exit_code}"

    except Exception as e:
        print_with_color(f"✗ AppAgent test failed: {str(e)}", "red")
        return False, f"AppAgent test error: {str(e)}"

    finally:
        # Restore original config
        try:
            if os.path.exists(config_backup_path):
                shutil.move(config_backup_path, config_path)
                print_with_color("✓ Config restored", "green")
        except Exception as e:
            print_with_color(f"⚠ Failed to restore config: {str(e)}", "yellow")


def test_api_connection(config):
    """Test API connection (OpenAI-compatible)"""
    print_with_color("Testing API connection...", "cyan")

    try:
        import requests

        # Get config values
        base_url = config.get("API_BASE_URL", "")
        api_key = config.get("API_KEY", "")
        model = config.get("API_MODEL", "gpt-4o-mini")

        if not base_url or not api_key or api_key == "sk-":
            print_with_color("✗ API credentials not configured", "yellow")
            return False, "API credentials not configured in config.yaml"

        # Test simple request
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": "Say 'OK' if you can hear me."
                }
            ],
            "temperature": 0.0,
            "max_tokens": 50
        }

        print_with_color(f"Sending request to {base_url}...", "cyan")
        response = requests.post(base_url, headers=headers, json=payload, timeout=30)

        if response.status_code == 200:
            data = response.json()
            if "choices" in data and len(data["choices"]) > 0:
                content = data["choices"][0]["message"]["content"]
                print_with_color(f"✓ API responded: {content[:50]}...", "green")
                return True, "API connection successful"
            else:
                print_with_color("✗ Invalid response format", "red")
                return False, "Invalid response format from API"
        else:
            error_msg = f"API request failed with status {response.status_code}"
            print_with_color(f"✗ {error_msg}", "red")
            try:
                error_detail = response.json().get("error", {}).get("message", "")
                if error_detail:
                    error_msg += f": {error_detail}"
            except:
                pass
            return False, error_msg

    except requests.exceptions.Timeout:
        print_with_color("✗ API request timeout", "red")
        return False, "API request timeout after 30 seconds"
    except Exception as e:
        print_with_color(f"✗ API connection failed: {str(e)}", "red")
        return False, f"API connection failed: {str(e)}"


def main():
    """Main integration test function"""
    print_with_color("=" * 60, "cyan")
    print_with_color("Klever Desktop Integration Test", "cyan")
    print_with_color("=" * 60, "cyan")
    print()

    # Load config
    try:
        config = load_config("./config.yaml")
        print_with_color("✓ Config loaded successfully", "green")
        print()
    except Exception as e:
        print_with_color(f"✗ Failed to load config: {str(e)}", "red")
        return 1

    # Get model type
    model_type = config.get("MODEL", "local").lower()
    print_with_color(f"Model type: {model_type}", "cyan")
    print()

    # Test based on model type
    results = {
        "timestamp": time.time(),
        "model_type": model_type,
        "tests": {}
    }

    if model_type == "local":
        success, message = test_ollama_connection(config)
        results["tests"]["ollama"] = {
            "success": success,
            "message": message
        }

        if not success:
            print()
            print_with_color("=" * 60, "red")
            print_with_color("Integration test FAILED", "red")
            print_with_color("=" * 60, "red")
            print_with_color(f"Error: {message}", "red")
            print()
            print_with_color("Troubleshooting:", "yellow")
            print_with_color("1. Make sure Ollama is running: ollama serve", "yellow")
            print_with_color("2. Check if model is installed: ollama list", "yellow")
            print_with_color("3. Pull the model if needed: ollama pull qwen3-vl:4b", "yellow")
            return 1

    elif model_type == "api":
        success, message = test_api_connection(config)
        results["tests"]["api"] = {
            "success": success,
            "message": message
        }

        if not success:
            print()
            print_with_color("=" * 60, "red")
            print_with_color("Integration test FAILED", "red")
            print_with_color("=" * 60, "red")
            print_with_color(f"Error: {message}", "red")
            print()
            print_with_color("Troubleshooting:", "yellow")
            print_with_color("1. Check API_BASE_URL in config.yaml", "yellow")
            print_with_color("2. Verify API_KEY is valid", "yellow")
            print_with_color("3. Ensure API_MODEL name is correct", "yellow")
            return 1
    else:
        print_with_color(f"✗ Unknown model type: {model_type}", "red")
        print_with_color("MODEL in config.yaml must be 'local' or 'api'", "yellow")
        return 1

    # Test actual AppAgent execution
    print()
    print_with_color("=" * 60, "cyan")
    print_with_color("Phase 2: AppAgent Execution Test", "cyan")
    print_with_color("=" * 60, "cyan")
    print()

    success, message = test_appagent_execution(config)
    results["tests"]["appagent"] = {
        "success": success,
        "message": message
    }

    if not success:
        print()
        print_with_color("=" * 60, "red")
        print_with_color("Integration test FAILED", "red")
        print_with_color("=" * 60, "red")
        print_with_color(f"Error: {message}", "red")
        print()
        print_with_color("Troubleshooting:", "yellow")
        print_with_color("1. Check if Playwright is properly installed", "yellow")
        print_with_color("2. Verify model configuration is correct", "yellow")
        print_with_color("3. Check network connection", "yellow")
        return 1

    # Success!
    print()
    print_with_color("=" * 60, "green")
    print_with_color("Integration test PASSED ✓", "green")
    print_with_color("=" * 60, "green")
    print()
    print_with_color("Your Klever Desktop is ready to use!", "green")
    print()

    return 0


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
