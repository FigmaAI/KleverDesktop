# Issue #95: 모델명 표시 개선 방안

안녕하세요! 모델 선택 시 긴 이름이 잘려 보이는 문제에 대해 답변드립니다.

## 현재 상황

Klever Desktop은 **LiteLLM**을 사용하여 다양한 AI 제공업체의 모델을 지원하고 있습니다.

### 모델 데이터 소스

모델 목록은 다음 위치에서 가져옵니다:
- **URL**: https://models.litellm.ai
- **실제 데이터**: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json

이 데이터에서 파싱된 모델명은 **provider prefix를 포함한 전체 ID** 형태입니다:
- `ollama/llama3.2-vision`
- `anthropic/claude-3-5-sonnet-20241022`
- `gemini/gemini-2.0-flash`
- `openai/gpt-4o`
- `xai/grok-vision-beta`

### 왜 긴 모델명을 사용하는가?

LiteLLM은 **provider prefix가 포함된 전체 모델 ID**를 요구합니다. 이는 다음 파일에서 확인할 수 있습니다:

1. **`main/utils/litellm-providers.ts`** (556-558라인):
   ```typescript
   providerMap[providerId].models.push({
     id: modelId,  // 전체 ID 저장 (예: "ollama/llama3.2-vision")
     name: modelId,
   });
   ```

2. **Python 엔진에서의 사용** (`core/llm_adapter.py`, `engines/appagent/scripts/model.py`):
   - LiteLLM은 `ollama/llama3.2-vision` 형태의 전체 ID를 받아 자동으로 provider를 감지하고 적절한 API로 라우팅합니다
   - 따라서 **백엔드 호출 시 전체 ID가 반드시 필요**합니다

## 해결 방안

제안하신 3가지 방법 모두 타당하지만, **가장 효율적인 방법은 1번(Provider prefix 제거)과 3번(툴팁)을 결합**하는 것입니다.

### 권장 수정 위치: `src/components/ModelSelector.tsx`

**핵심 원칙**:
- ✅ **표시용 이름**: 짧고 읽기 쉽게 (provider prefix 제거)
- ✅ **실제 값**: LiteLLM이 요구하는 전체 ID 유지
- ✅ **백엔드 로직**: 변경 없음 (LiteLLM은 여전히 전체 ID 사용)

### 구체적인 수정 방법

**현재 코드** (153-178라인):
```typescript
const modelOptions: ComboboxOption[] = useMemo(() => {
  return currentModels.map((m) => {
    const modelInfo = getModelInfo(m);
    const hasBadges = modelInfo && (modelInfo.supportsVision || modelInfo.maxInputTokens);

    return {
      value: m,  // 전체 ID (예: "ollama/llama3.2-vision")
      label: m,  // 👈 문제: 전체 ID를 그대로 표시하여 잘림
      itemLabel: hasBadges ? (
        <div className="flex items-center justify-between w-full gap-2">
          <span className="truncate">{m}</span>
          ...
        </div>
      ) : m,
    };
  });
}, [currentModels, getModelInfo, t]);
```

**개선 코드**:
```typescript
const modelOptions: ComboboxOption[] = useMemo(() => {
  return currentModels.map((m) => {
    const modelInfo = getModelInfo(m);
    const hasBadges = modelInfo && (modelInfo.supportsVision || modelInfo.maxInputTokens);

    // Provider prefix 제거 함수
    const getDisplayName = (modelId: string): string => {
      // "provider/model-name" 형태에서 "model-name"만 추출
      const parts = modelId.split('/');
      return parts.length > 1 ? parts.slice(1).join('/') : modelId;
    };

    const displayName = getDisplayName(m);

    return {
      value: m,  // ✅ 전체 ID 유지 (LiteLLM 호출용)
      label: displayName,  // ✅ 짧은 이름 (화면 표시용)
      itemLabel: hasBadges ? (
        <div className="flex items-center justify-between w-full gap-2">
          <span className="truncate" title={m}>  {/* 툴팁 추가 */}
            {displayName}
          </span>
          <div className="flex gap-1 shrink-0">
            {modelInfo?.supportsVision && (
              <Badge variant="default" className="text-xs px-1 py-0">
                {t('modelSelector.vision')}
              </Badge>
            )}
            {modelInfo?.maxInputTokens && (
              <Badge variant="secondary" className="text-xs px-1 py-0">
                {(modelInfo.maxInputTokens / 1000).toFixed(0)}K
              </Badge>
            )}
          </div>
        </div>
      ) : (
        <span title={m}>{displayName}</span>  {/* 툴팁 추가 */
      ),
    };
  });
}, [currentModels, getModelInfo, t]);
```

### 변경 사항 요약

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| **선택된 항목 표시** | `ollama/llama3.2-vision` | `llama3.2-vision` |
| **드롭다운 목록** | `ollama/llama3.2-vision` | `llama3.2-vision` |
| **툴팁 (hover)** | 없음 | `ollama/llama3.2-vision` |
| **API 호출용 값** | `ollama/llama3.2-vision` | `ollama/llama3.2-vision` (변경 없음) |

### 예상 효과

**변경 전**:
```
┌─────────────────────────────┐
│ Provider: Ollama            │
│ Model: [ollama/llama3.2...▼]│  ← 잘림
└─────────────────────────────┘
```

**변경 후**:
```
┌─────────────────────────────┐
│ Provider: Ollama            │
│ Model: [llama3.2-vision  ▼]│  ← 깔끔하게 표시
└─────────────────────────────┘
```

## 왜 백엔드를 수정하지 않는가?

1. **LiteLLM 요구사항**: LiteLLM은 `provider/model` 형태의 전체 ID를 필요로 합니다
2. **Provider 자동 감지**: 전체 ID가 있어야 LiteLLM이 올바른 API로 라우팅할 수 있습니다
3. **설정 저장**: `config.json`과 `projects.json`에 저장된 모델 정보도 전체 ID를 사용합니다
4. **호환성 유지**: 기존 설정 파일과의 호환성을 유지할 수 있습니다

## 참고 파일

- **모델 선택 UI**: `src/components/ModelSelector.tsx`
- **LiteLLM Provider 관리**: `main/utils/litellm-providers.ts`
- **Combobox 컴포넌트**: `src/components/ui/combobox.tsx`

## 결론

**표시 레이어에서만 provider prefix를 제거**하고, **데이터 레이어에서는 전체 ID를 유지**하는 것이 가장 안전하고 효율적인 방법입니다. 이렇게 하면:

- ✅ 사용자는 짧고 명확한 모델명을 볼 수 있습니다
- ✅ LiteLLM은 필요한 전체 정보를 받을 수 있습니다
- ✅ 기존 코드 변경이 최소화됩니다
- ✅ 툴팁으로 전체 정보를 확인할 수 있습니다

추가 질문이 있으시면 언제든지 말씀해 주세요! 😊
