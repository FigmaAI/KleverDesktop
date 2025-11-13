# Claude Development Guidelines for KleverDesktop

이 문서는 Claude가 KleverDesktop 프로젝트를 개발할 때 따라야 할 가이드라인과 베스트 프랙티스를 정의합니다.

## 📋 Table of Contents

- [Development Workflow](#development-workflow)
- [Code Quality](#code-quality)
- [Git Commit Guidelines](#git-commit-guidelines)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)

---

## 🔄 Development Workflow

### ⚠️ CRITICAL: Pre-Push Checklist

**푸시하기 전에 반드시 다음 단계를 순서대로 실행하세요:**

```bash
# 1. Lint 검사 실행
npm run lint

# 2. Lint 에러가 있다면 자동 수정 시도
npm run lint:fix

# 3. TypeScript 타입 체크
npm run build

# 4. 모든 에러가 해결되었는지 확인 후 커밋
git add .
git commit -m "your commit message"

# 5. 푸시
git push
```

### Why Linting Before Push?

1. **Vercel 빌드 실패 방지**: TypeScript 컴파일 에러는 Vercel 배포를 실패시킵니다
2. **코드 품질 유지**: 사용되지 않는 import, 타입 에러 등을 사전에 발견
3. **시간 절약**: 빌드 실패 후 수정하는 것보다 미리 검사하는 것이 훨씬 효율적
4. **일관성**: 팀 전체가 동일한 코드 스타일을 유지

### Common Lint Issues & Solutions

#### 1. Unused Imports
```typescript
// ❌ Bad
import { Textarea, Select, Option } from '@mui/joy'

// ✅ Good - Remove unused imports
import { Box, Button } from '@mui/joy'
```

#### 2. TypeScript Type Errors
```typescript
// ❌ Bad - MUI icons don't support 'neutral' color
<Schedule color="neutral" />

// ✅ Good - Use supported colors
<Schedule color="action" />
```

#### 3. Invalid Type Comparisons
```typescript
// ❌ Bad - Platform type vs empty string
if (platform !== '') return true

// ✅ Good - Use proper type checks
if (activeStep === 0) return true
```

---

## 💎 Code Quality

### TypeScript Best Practices

1. **명시적 타입 정의**
   ```typescript
   // ✅ Good
   const [platform, setPlatform] = useState<Platform>('android')

   // ❌ Bad
   const [platform, setPlatform] = useState('android')
   ```

2. **Type Assertions 사용**
   ```typescript
   // ✅ Good - Explicit const assertion
   status: 'active' as const

   // ❌ Bad - Type inference may fail
   status: 'active'
   ```

3. **Proper Interface Usage**
   ```typescript
   // ✅ Good
   import type { Project, Task } from '../types/project'

   // ❌ Bad
   import { Project, Task } from '../types/project'
   ```

### MUI Joy UI Guidelines

1. **Icon Color Props**
   - Supported: `primary`, `success`, `warning`, `error`, `info`, `action`, `inherit`, `disabled`, `secondary`
   - NOT supported: `neutral`, `danger`

2. **Component Imports**
   ```typescript
   // ✅ Good - Only import what you use
   import { Box, Button, Stack } from '@mui/joy'

   // ❌ Bad - Importing unused components
   import { Box, Button, Stack, Textarea, Select } from '@mui/joy'
   ```

---

## 📝 Git Commit Guidelines

### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락 등
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드 추가/수정
- `chore`: 빌드 업무, 패키지 매니저 수정 등

### Examples

```bash
# Good commit messages
git commit -m "feat: Add project-task management UI with MUI Joy"
git commit -m "fix: Resolve TypeScript build errors for Vercel deployment"
git commit -m "docs: Update README with setup instructions"

# Bad commit messages
git commit -m "fixed stuff"
git commit -m "update"
git commit -m "wip"
```

---

## 🛠 Technology Stack

### Frontend
- **Framework**: React 18.3+ with TypeScript 5.5+
- **UI Library**: MUI Joy (Beta 48+)
- **Routing**: React Router DOM 6.26+
- **State Management**: React Hooks (useState, useEffect)
- **Desktop Framework**: Electron 31+

### Backend (Electron Main Process)
- **Runtime**: Node.js
- **IPC**: Electron IPC (ipcMain/ipcRenderer)
- **Storage**: JSON files (`~/.klever-desktop/projects.json`)
- **Process Management**: child_process (spawn, exec)

### Python Integration
- **AppAgent**: Self-explorer for Android & Web automation
- **Communication**: subprocess via IPC
- **Models**: Ollama (local) or OpenAI/OpenRouter (API)

---

## 📁 Project Structure

```
KleverDesktop/
├── main.js                    # Electron main process
├── preload.js                 # IPC bridge
├── src/
│   ├── App.tsx               # Main React app with routing
│   ├── main.tsx              # React entry point
│   ├── components/           # Reusable UI components
│   │   └── Layout.tsx
│   ├── pages/                # Page components
│   │   ├── ProjectList.tsx
│   │   ├── ProjectCreate.tsx
│   │   ├── ProjectDetail.tsx
│   │   ├── TaskCreate.tsx
│   │   ├── TaskDetail.tsx
│   │   ├── Settings.tsx
│   │   └── SetupWizard.tsx
│   └── types/                # TypeScript type definitions
│       ├── project.ts        # Project & Task types
│       └── electron.d.ts     # Electron API types
├── appagent/                 # Python automation engine (submodule)
└── package.json
```

### Key Directories

- **`src/pages/`**: 각 라우트에 대응하는 페이지 컴포넌트
- **`src/types/`**: 전역 TypeScript 타입 정의
- **`src/components/`**: 재사용 가능한 UI 컴포넌트
- **Root level**: Electron 메인 프로세스 파일들

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Development mode (React dev server + Electron)
npm run electron:dev

# Build for production
npm run build

# Lint check
npm run lint

# Lint auto-fix
npm run lint:fix

# Package desktop app
npm run package
```

---

## ✅ Pre-Deployment Checklist

푸시 전에 다음을 확인하세요:

- [ ] `npm run lint` 실행하여 lint 에러 없음
- [ ] `npm run build` 실행하여 TypeScript 컴파일 성공
- [ ] 사용되지 않는 import 제거됨
- [ ] MUI 컴포넌트 color prop이 올바른 값 사용
- [ ] TypeScript 타입이 명시적으로 정의됨
- [ ] 커밋 메시지가 컨벤션을 따름
- [ ] IPC 채널 이름이 일관성 있음 (예: `project:create`, `task:start`)

---

## 🐛 Troubleshooting

### Vercel Build Fails

1. **로컬에서 빌드 테스트**
   ```bash
   npm run build
   ```

2. **에러 확인 및 수정**
   - TypeScript 컴파일 에러
   - Unused imports
   - Type mismatches

3. **재푸시**
   ```bash
   git add .
   git commit -m "fix: Resolve build errors"
   git push
   ```

### Electron IPC Not Working

1. **preload.js 확인**: electronAPI가 올바르게 expose되었는지
2. **main.js 확인**: ipcMain.handle이 정의되어 있는지
3. **타입 정의 확인**: `electron.d.ts`에 메소드가 선언되어 있는지

---

## 📚 Additional Resources

- [MUI Joy Documentation](https://mui.com/joy-ui/getting-started/)
- [Electron Documentation](https://www.electronjs.org/docs/latest/)
- [React Router Documentation](https://reactrouter.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Last Updated**: 2025-11-13
**Version**: 1.0.0
