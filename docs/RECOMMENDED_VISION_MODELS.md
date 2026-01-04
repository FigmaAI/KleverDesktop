# 추천 비전 모델 목록 (2026년 1월)

> `docs/filter_openrouter_vision_models.py` 스크립트 실행 결과 기반으로 선정

## 요약

- **총 발견 모델**: 38개 (OpenRouter 비전 지원)
- **선정 모델**: 11개 (벤더별 고성능/일반/효율)

---

## 선정된 테스트 모델

### OpenAI (3개) - OpenRouter

| 티어 | 모델 ID | Context | Input $/1M | Output $/1M |
|------|---------|---------|------------|-------------|
| 🔥 고성능 | `openrouter/openai/gpt-5.2-pro` | 400K | $21.00 | $168.00 |
| 🌟 일반 | `openrouter/openai/gpt-5.2` | 400K | $1.75 | $14.00 |
| ⚡ 효율 | `openrouter/openai/gpt-4.1-mini` | 1M | $0.40 | $1.60 |

### Anthropic (3개) - OpenRouter

| 티어 | 모델 ID | Context | Input $/1M | Output $/1M |
|------|---------|---------|------------|-------------|
| 🔥 고성능 | `openrouter/anthropic/claude-opus-4.5` | 200K | $5.00 | $25.00 |
| 🌟 일반 | `openrouter/anthropic/claude-sonnet-4.5` | 1M | $3.00 | $15.00 |
| ⚡ 효율 | `openrouter/anthropic/claude-haiku-4.5` | 200K | $1.00 | $5.00 |

### Google (3개) - OpenRouter

| 티어 | 모델 ID | Context | Input $/1M | Output $/1M |
|------|---------|---------|------------|-------------|
| 🔥 고성능 | `openrouter/google/gemini-3-pro-preview` | 1M | $2.00 | $12.00 |
| 🌟 일반 | `openrouter/google/gemini-2.5-pro` | 1M | $1.25 | $10.00 |
| ⚡ 효율 | `openrouter/google/gemini-2.5-flash` | 1M | $0.30 | $2.50 |

### xAI (2개) - 직접 API

| 티어 | 모델 ID | Context | Input $/1M | Output $/1M |
|------|---------|---------|------------|-------------|
| 🔥 고성능 | `xai/grok-4-1-fast` | 2M | $0.20 | $0.50 |
| 🌟 일반 | `xai/grok-4-1-fast-non-reasoning-latest` | 2M | $0.20 | $0.50 |

> ⚠️ xAI 모델은 OpenRouter에서 비전 미지원으로 직접 API 사용 필요

---

## 빠른 복사용 모델 목록 (11개)

```
openrouter/openai/gpt-5.2-pro
openrouter/openai/gpt-5.2
openrouter/openai/gpt-4.1-mini
openrouter/anthropic/claude-opus-4.5
openrouter/anthropic/claude-sonnet-4.5
openrouter/anthropic/claude-haiku-4.5
openrouter/google/gemini-3-pro-preview
openrouter/google/gemini-2.5-pro
openrouter/google/gemini-2.5-flash
xai/grok-4-1-fast
xai/grok-4-1-fast-non-reasoning-latest
```

---

## TypeScript 상수

```typescript
export const RECOMMENDED_VISION_MODELS = [
  // OpenAI (OpenRouter)
  { id: 'openrouter/openai/gpt-5.2-pro', tier: 'high', provider: 'OpenAI', inputCost: 21.0, outputCost: 168.0 },
  { id: 'openrouter/openai/gpt-5.2', tier: 'standard', provider: 'OpenAI', inputCost: 1.75, outputCost: 14.0 },
  { id: 'openrouter/openai/gpt-4.1-mini', tier: 'efficient', provider: 'OpenAI', inputCost: 0.4, outputCost: 1.6 },
  
  // Anthropic (OpenRouter)
  { id: 'openrouter/anthropic/claude-opus-4.5', tier: 'high', provider: 'Anthropic', inputCost: 5.0, outputCost: 25.0 },
  { id: 'openrouter/anthropic/claude-sonnet-4.5', tier: 'standard', provider: 'Anthropic', inputCost: 3.0, outputCost: 15.0 },
  { id: 'openrouter/anthropic/claude-haiku-4.5', tier: 'efficient', provider: 'Anthropic', inputCost: 1.0, outputCost: 5.0 },
  
  // Google (OpenRouter)
  { id: 'openrouter/google/gemini-3-pro-preview', tier: 'high', provider: 'Google', inputCost: 2.0, outputCost: 12.0 },
  { id: 'openrouter/google/gemini-2.5-pro', tier: 'standard', provider: 'Google', inputCost: 1.25, outputCost: 10.0 },
  { id: 'openrouter/google/gemini-2.5-flash', tier: 'efficient', provider: 'Google', inputCost: 0.3, outputCost: 2.5 },
  
  // xAI (직접 API)
  { id: 'xai/grok-4-1-fast', tier: 'high', provider: 'xAI', inputCost: 0.2, outputCost: 0.5 },
  { id: 'xai/grok-4-1-fast-non-reasoning-latest', tier: 'standard', provider: 'xAI', inputCost: 0.2, outputCost: 0.5 },
] as const;

export type RecommendedModel = typeof RECOMMENDED_VISION_MODELS[number];
export type ModelTier = 'high' | 'standard' | 'efficient';
```

---

## 비용 비교 차트

```
가장 저렴한 순서 (Input $/1M):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$0.20  │ grok-4-1-fast ⭐                    █
$0.20  │ grok-4-1-fast-non-reasoning ⭐      █
$0.30  │ gemini-2.5-flash                    ██
$0.40  │ gpt-4.1-mini                        ██
$1.00  │ claude-haiku-4.5                    █████
$1.25  │ gemini-2.5-pro                      ██████
$1.75  │ gpt-5.2                             █████████
$2.00  │ gemini-3-pro-preview                ██████████
$3.00  │ claude-sonnet-4.5                   ███████████████
$5.00  │ claude-opus-4.5                     █████████████████████████
$21.00 │ gpt-5.2-pro                         █████████████████████████████████████████████████████████████████████████████████████████████████████████
```

---

## 티어 설명

| 티어 | 설명 | 특징 |
|------|------|------|
| 🔥 고성능 (High) | 최고 품질의 결과물 | 복잡한 작업, 높은 정확도 필요 시 |
| 🌟 일반 (Standard) | 균형 잡힌 성능 | 일상적인 작업에 적합 |
| ⚡ 효율 (Efficient) | 빠르고 저렴함 | 대량 처리, 비용 절감 |

---

## 참고

- 데이터 소스: [LiteLLM model_prices_and_context_window.json](https://raw.githubusercontent.com/BerriAI/litellm/refs/heads/main/model_prices_and_context_window.json)
- 필터링 스크립트: `docs/filter_openrouter_vision_models.py`
- 전체 모델 CSV: `docs/openrouter_vision_models.csv`
- 생성일: 2026년 1월
