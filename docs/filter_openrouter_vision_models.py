#!/usr/bin/env python3
"""
OpenRouter Vision Models Filter

LiteLLM JSON에서 OpenRouter 프로바이더의 비전 지원 모델을 필터링합니다.
"""

import requests
import pandas as pd
from typing import Dict, Any

LITELLM_URL = "https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json"

def fetch_models() -> Dict[str, Any]:
    """LiteLLM JSON 데이터를 가져옵니다."""
    response = requests.get(LITELLM_URL)
    response.raise_for_status()
    return response.json()

def filter_openrouter_vision_models(data: Dict[str, Any]) -> pd.DataFrame:
    """OpenRouter 프로바이더의 비전 지원 모델만 필터링합니다."""
    models = []
    
    for model_id, model_info in data.items():
        if model_id == "sample_spec":
            continue
        if not isinstance(model_info, dict):
            continue
            
        # OpenRouter 프로바이더 필터
        provider = model_info.get("litellm_provider", "")
        if provider != "openrouter":
            continue
            
        # 비전 지원 필터
        supports_vision = model_info.get("supports_vision", False)
        if not supports_vision:
            continue
            
        # chat 모드만 포함
        mode = model_info.get("mode", "")
        if mode and mode != "chat":
            continue
        
        models.append({
            "model_id": model_id,
            "provider": provider,
            "max_input_tokens": model_info.get("max_input_tokens", 0),
            "max_output_tokens": model_info.get("max_output_tokens", 0),
            "input_cost_per_token": model_info.get("input_cost_per_token", 0),
            "output_cost_per_token": model_info.get("output_cost_per_token", 0),
            "supports_vision": supports_vision,
            "supports_function_calling": model_info.get("supports_function_calling", False),
        })
    
    df = pd.DataFrame(models)
    
    # 비용 계산 (1M 토큰당)
    if len(df) > 0:
        df["input_cost_per_1M"] = df["input_cost_per_token"] * 1_000_000
        df["output_cost_per_1M"] = df["output_cost_per_token"] * 1_000_000
        df = df.sort_values("input_cost_per_1M", ascending=True)
    
    return df

def categorize_by_vendor(df: pd.DataFrame) -> Dict[str, pd.DataFrame]:
    """모델을 벤더별로 분류합니다."""
    vendors = {}
    
    vendor_prefixes = {
        "OpenAI": ["openrouter/openai/", "openrouter/gpt-"],
        "Anthropic": ["openrouter/anthropic/"],
        "Google": ["openrouter/google/"],
        "xAI": ["openrouter/x-ai/"],
        "Mistral": ["openrouter/mistralai/"],
        "DeepSeek": ["openrouter/deepseek/"],
        "Qwen": ["openrouter/qwen/"],
        "Meta": ["openrouter/meta-llama/"],
    }
    
    for vendor, prefixes in vendor_prefixes.items():
        mask = df["model_id"].apply(
            lambda x: any(x.startswith(p) for p in prefixes)
        )
        vendor_df = df[mask]
        if len(vendor_df) > 0:
            vendors[vendor] = vendor_df
    
    return vendors

def main():
    print("🔍 LiteLLM 모델 데이터 가져오는 중...")
    data = fetch_models()
    print(f"   총 {len(data)} 개 모델 로드됨")
    
    print("\n📋 OpenRouter 비전 모델 필터링 중...")
    df = filter_openrouter_vision_models(data)
    print(f"   {len(df)} 개 비전 모델 발견됨")
    
    if len(df) == 0:
        print("❌ 비전 모델을 찾을 수 없습니다.")
        return
    
    print("\n" + "="*80)
    print("📊 OpenRouter 비전 모델 목록")
    print("="*80)
    
    # 전체 목록 출력
    display_cols = ["model_id", "max_input_tokens", "input_cost_per_1M", "output_cost_per_1M"]
    print(df[display_cols].to_string(index=False))
    
    # 벤더별 분류
    print("\n" + "="*80)
    print("🏢 벤더별 비전 모델")
    print("="*80)
    
    vendors = categorize_by_vendor(df)
    for vendor, vendor_df in vendors.items():
        print(f"\n### {vendor} ({len(vendor_df)}개)")
        print(vendor_df[["model_id", "input_cost_per_1M"]].to_string(index=False))
    
    # CSV 저장
    output_path = "docs/openrouter_vision_models.csv"
    df.to_csv(output_path, index=False)
    print(f"\n✅ CSV 저장됨: {output_path}")

if __name__ == "__main__":
    main()

