# 🚨 MAS SANDBOX CRITICAL ISSUE - 최종 분석 보고서

## 문제 발견

### 📍 코드 위치: `main/utils/project-storage.ts:107-114`

```typescript
export function getProjectWorkspaceDir(projectName: string): string {
  const homeDir = os.homedir();
  const documentsDir = path.join(homeDir, 'Documents', 'apps');  // ❌ BLOCKED IN MAS!

  ensureDirectoryExists(documentsDir);  // ❌ WILL FAIL IN MAS SANDBOX!

  return path.join(documentsDir, projectName);
}
```

### 🔴 왜 실패하는가?

**MAS 샌드박스 규칙:**
- `~/Documents` = **차단됨** (기본)
- 사용 가능한 위치:
  - ✅ `app.getPath('userData')` → `~/Library/Containers/com.klever.desktop/Data/Library/Application Support/klever-desktop/`
  - ✅ `app.getPath('downloads')` → `~/Downloads/` (entitlement 있음)
  - ✅ User-selected files via file picker (entitlement 있음)

### 💥 실패 시나리오

1. **사용자가 프로젝트 생성**
   ```
   project:create → getProjectWorkspaceDir()
   → ~/Documents/apps/{project}/ 접근 시도
   → 샌드박스 거부 → 디렉토리 생성 실패
   → 프로젝트 생성 실패
   ```

2. **Python 스크립트 실행**
   ```
   task:start → Python 실행
   → project.workspaceDir (~/Documents/...) 접근
   → 파일 쓰기 시도
   → 샌드박스 거부 → Permission denied
   → 스크립트 크래시
   ```

3. **Integration Test**
   ```
   integration:run → workspaceDir = ~/Documents
   → 샌드박스 거부
   → 테스트 실패
   ```

## 해결 방법 (3가지 옵션)

### 🥇 Option 1: Entitlement 추가 (권장)

**`build/entitlements.mas.plist`에 추가:**

```xml
<!-- Documents folder read-write access -->
<key>com.apple.security.files.user-selected.read-write</key>
<true/>

<!-- OR: Persistent access to user-selected files -->
<key>com.apple.security.files.bookmarks.document-scope</key>
<true/>
```

**장점:**
- ✅ 기존 코드 수정 불필요
- ✅ 사용자가 폴더 선택 가능
- ✅ Apple의 권장 방식

**단점:**
- ⚠️ 첫 실행 시 사용자가 폴더 선택 필요 (파일 피커)

**구현:**
1. 프로젝트 생성 시 파일 피커로 workspace 위치 선택
2. Security-scoped bookmark로 저장
3. 이후 실행 시 자동으로 접근

---

### 🥈 Option 2: Sandbox Container 사용 (가장 안전)

**`project-storage.ts` 수정:**

```typescript
export function getProjectWorkspaceDir(projectName: string): string {
  // MAS-safe: Use app's sandboxed container
  const userDataPath = app.getPath('userData');  // Sandbox container
  const workspaceDir = path.join(userDataPath, 'workspaces', projectName);

  ensureDirectoryExists(workspaceDir);

  return workspaceDir;
}
```

**결과 경로:**
```
~/Library/Containers/com.klever.desktop/Data/Library/Application Support/klever-desktop/workspaces/{project}/
```

**장점:**
- ✅ 샌드박스 문제 완전 해결
- ✅ 코드 수정 최소화
- ✅ Apple 승인 확실

**단점:**
- ⚠️ 사용자가 Finder에서 직접 접근 어려움
- ⚠️ 기존 프로젝트 마이그레이션 필요

---

### 🥉 Option 3: Temporary Exception (비권장)

**`build/entitlements.mas.plist`에 추가:**

```xml
<!-- Temporary exception for Documents folder -->
<key>com.apple.security.temporary-exception.files.absolute-path.read-write</key>
<array>
  <string>/Users/</string>
  <string>$(HOME)/Documents</string>
</array>
```

**장점:**
- ✅ 코드 수정 불필요
- ✅ 모든 경로 접근 가능

**단점:**
- ❌ Apple이 거부할 가능성 높음
- ❌ 명확한 정당화 필요
- ❌ 보안 위험

---

## 추가 문제: Integration Test

**`main/handlers/integration.ts:114`:**

```typescript
const workspaceDir = path.join(homeDir, 'Documents');  // ❌ BLOCKED!
```

**해결:**
```typescript
// Use sandbox-safe location
const workspaceDir = path.join(app.getPath('userData'), 'integration-tests');
```

---

## 권장 구현 순서

### Phase 1: 긴급 수정 (Option 2)
1. ✅ `getProjectWorkspaceDir()` 수정 → sandbox container 사용
2. ✅ `integration.ts` 수정 → sandbox container 사용
3. ✅ 빌드 & 테스트
4. ✅ TestFlight 업로드

### Phase 2: 사용자 경험 개선 (Option 1)
1. 프로젝트 생성 UI에 폴더 선택 추가
2. Security-scoped bookmarks 구현
3. Documents 폴더 entitlement 추가
4. 사용자가 원하는 위치에 workspace 생성 가능

---

## 예상 영향

### Before (Darwin):
```
✅ ~/Documents/apps/MyProject/
✅ Python 스크립트 정상 실행
✅ 파일 쓰기 성공
```

### Before (MAS - 현재):
```
❌ ~/Documents/ 접근 차단
❌ 프로젝트 생성 실패
❌ Python 스크립트 실패
❌ TestFlight 앱 작동 안 함
```

### After (Option 2 적용):
```
✅ ~/Library/Containers/.../workspaces/MyProject/
✅ 프로젝트 생성 성공
✅ Python 스크립트 정상 실행
✅ TestFlight 앱 작동
```

---

## 액션 아이템

**즉시 수정 필요:**
- [ ] `main/utils/project-storage.ts` - `getProjectWorkspaceDir()` 수정
- [ ] `main/handlers/integration.ts` - workspace 경로 수정
- [ ] Build 15 재빌드
- [ ] TestFlight 재업로드

**향후 개선:**
- [ ] 파일 피커 UI 추가
- [ ] Documents entitlement 추가
- [ ] 사용자 문서 참조