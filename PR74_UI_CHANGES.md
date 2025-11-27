# PR #74 UI 변경사항 분석

## 개요
- **PR 작성자**: homebodify
- **목적**: Task 생성 시 AI 출력 언어 선택 기능 추가
- **지원 언어**: English, Korean (한국어), Japanese (日本語)

---

## 📝 UI 변경사항 (우리가 구현할 부분)

### 1. 새 컴포넌트: `src/components/LanguageSelector.tsx`

**파일 생성** (완전히 새로운 파일)

```typescript
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Language {
  code: string
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
]

interface LanguageSelectorProps {
  value?: string
  onChange: (value: string) => void
  required?: boolean
  label?: string
  description?: string
}

export function LanguageSelector({
  value,
  onChange,
  required = false,
  label = 'Output Language',
  description = 'The language for AI-generated outputs and analysis results',
}: LanguageSelectorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="language">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Select value={value || 'en'} onValueChange={onChange}>
        <SelectTrigger id="language">
          <SelectValue placeholder="Select a language" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.nativeName} ({lang.name})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
```

**특징**:
- shadcn/ui Select 컴포넌트 사용
- 네이티브 이름과 영문 이름 함께 표시 (예: "한국어 (Korean)")
- 재사용 가능한 props (label, description 커스터마이징 가능)
- 기본값: 'en'

---

### 2. `src/components/TaskCreateDialog.tsx` 수정

#### 2.1 Import 추가
```typescript
// 14번째 줄에 추가
import { LanguageSelector } from './LanguageSelector'
```

#### 2.2 State 추가 (34-40번째 줄 근처)
```typescript
const [goal, setGoal] = useState('')
const [url, setUrl] = useState('')
const [language, setLanguage] = useState('en')  // ← 추가
const [selectedModel, setSelectedModel] = useState<
  { type: 'local' | 'api'; model: string } | undefined
>()
```

#### 2.3 taskInput에 language 추가 (61-69번째 줄 근처)
```typescript
const taskInput = {
  projectId,
  name: `Task ${new Date().toLocaleString()}`,
  goal: taskGoal,
  url: platform === 'web' ? url.trim() : undefined,
  modelProvider: selectedModel?.type,
  modelName: selectedModel?.model,
  language,  // ← 추가
}
```

#### 2.4 handleClose에 리셋 로직 추가 (98-102번째 줄 근처)
```typescript
const handleClose = () => {
  setGoal('')
  setUrl('')
  setLanguage('en')  // ← 추가
  setRunImmediately(true)
  onClose()
}
```

#### 2.5 UI에 LanguageSelector 추가

**위치**: URL 입력 섹션과 Task Description 섹션 사이

```typescript
{/* URL Input (Web Platform Only) */}
{platform === 'web' && (
  <div className="space-y-2">
    <Label>Website URL</Label>
    <Input
      placeholder="https://example.com"
      value={url}
      onChange={(e) => setUrl(e.target.value)}
    />
  </div>
)}

{/* Language Selection - 여기에 추가 */}
<LanguageSelector
  value={language}
  onChange={setLanguage}
  label="Output Language"
  description="The language for AI analysis and results"
/>

{/* Task Description */}
<div className="space-y-2">
  <Label>Task Description</Label>
  ...
```

---

### 3. `src/types/project.ts` 타입 수정

#### 3.1 Task interface 수정 (16-37번째 줄 근처)
```typescript
export interface Task {
  id: string
  name: string
  description?: string
  goal: string
  status: TaskStatus
  modelProvider?: 'api' | 'local'
  modelName?: string
  model?: string
  language?: string  // ← 추가: 'en' | 'ko' | 'ja'
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  startedAt?: string
  completedAt?: string
  output?: string
  error?: string
  resultPath?: string
  url?: string
  metrics?: TaskMetrics
}
```

#### 3.2 TaskCreateInput 수정 (58-66번째 줄 근처)
```typescript
export interface TaskCreateInput {
  projectId: string
  name: string
  description?: string
  goal: string
  modelProvider?: 'api' | 'local'
  modelName?: string
  language?: string  // ← 추가
  url?: string
}
```

---

### 4. `main/types/project.ts` 타입 수정

**동일한 수정 적용**:
- `Task` interface에 `language?: string` 추가
- `CreateTaskInput`에 `language?: string` 추가

---

## 🚫 제외할 부분 (파이썬 프롬프트 수정)

다음 파일들의 변경사항은 **무시**합니다 (우리가 다른 로직으로 구현):

- ❌ `appagent/scripts/prompts.py` - `add_language_instruction()` 함수
- ❌ `appagent/scripts/self_explorer.py` - `--language` CLI 파라미터
- ❌ `appagent/scripts/task_executor.py` - `--language` CLI 파라미터
- ❌ `main/handlers/task.ts` - 파이썬에 `--language` 전달하는 로직

---

## 📋 UI 구현 체크리스트

- [ ] `src/components/LanguageSelector.tsx` 생성
- [ ] `src/components/TaskCreateDialog.tsx` 수정
  - [ ] Import 추가
  - [ ] State 추가
  - [ ] taskInput에 language 필드 추가
  - [ ] handleClose에 리셋 로직 추가
  - [ ] UI에 LanguageSelector 컴포넌트 추가
- [ ] `src/types/project.ts` 수정
  - [ ] Task interface에 language 필드 추가
  - [ ] TaskCreateInput에 language 필드 추가
- [ ] `main/types/project.ts` 수정
  - [ ] Task interface에 language 필드 추가
  - [ ] CreateTaskInput에 language 필드 추가

---

## 🎯 다음 단계: 번역 로직 구현

UI는 위 체크리스트대로 구현하고, 번역 로직은 별도로 설계:

### 옵션 1: 실시간 번역 (출력 스트리밍 중 번역)
- Task 실행 시 `task:output` 이벤트를 intercept
- 각 출력 라인을 즉시 번역하여 UI에 표시

### 옵션 2: 후처리 번역 (Task 완료 후 번역)
- Task가 완료되면 전체 output을 한 번에 번역
- 번역된 결과를 별도로 저장하거나 UI에만 표시

### 옵션 3: 하이브리드
- 구조화된 필드(Observation, Thought, Summary)만 번역
- Action, 파일 경로, 에러 메시지는 영어 유지

---

**작성일**: 2025-11-27
**기준 커밋**: 164a5e9 (refactor: Limit language selection to task creation only)
