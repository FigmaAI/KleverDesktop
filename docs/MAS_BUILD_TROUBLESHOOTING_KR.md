# Mac App Store 빌드 문제 해결 가이드

## 개요

이 문서는 Klever Desktop을 Mac App Store용으로 빌드할 때 발생하는 일반적인 문제들, 특히 V8 초기화 중 발생하는 EXC_BREAKPOINT 크래시 문제에 대한 해결 방법을 제공합니다.

## 핵심 수정사항: V8 초기화 크래시

### 증상
- 앱 실행 직후 즉시 크래시 발생 (~120ms)
- 예외: `EXC_BREAKPOINT (SIGTRAP)`
- Electron Framework의 V8/JavaScript 엔진 초기화 중 크래시
- 스택 트레이스: `ElectronMain → v8::Isolate::Initialize`

### 근본 원인
Electron 헬퍼 프로세스가 필요한 권한(entitlements)으로 제대로 서명되지 않아 크래시가 발생합니다. 특히 다음 권한들이 필요합니다:
- `com.apple.security.cs.allow-jit` (JIT 컴파일)
- `com.apple.security.cs.allow-unsigned-executable-memory` (V8 메모리 관리)
- `com.apple.security.cs.allow-dyld-environment-variables` (동적 링킹)
- `com.apple.security.cs.disable-library-validation` (네이티브 모듈)

### 적용된 해결 방법

#### 1. `forge.config.js` 업데이트 (32-57번 라인)

**`optionsForFile` 콜백 추가**로 모든 Electron 헬퍼 프로세스가 상속 권한으로 서명되도록 보장:

```javascript
osxSign: {
  // ... 기존 설정
  optionsForFile: (filePath) => {
    // 헬퍼 프로세스는 반드시 상속 권한을 사용해야 함
    if (filePath.includes('Helper')) {
      return {
        entitlements: 'build/entitlements.mas.inherit.plist',
      };
    }
    // 메인 앱은 메인 권한 사용
    return {
      entitlements: 'build/entitlements.mas.plist',
    };
  },
  hardenedRuntime: true,
  gatekeeperAssess: false,
  signatureFlags: ['runtime'],
}
```

**프로비저닝 프로필 참조 수정** - 환경 변수 사용:
```javascript
provisioningProfile: process.env.MAS_PROVISIONING_PROFILE || undefined,
```

#### 2. `build/entitlements.mas.inherit.plist` 개선

헬퍼 프로세스를 위한 네트워크 접근 권한 추가:
```xml
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>
```

## Electron 헬퍼 프로세스

Electron 앱은 여러 프로세스로 구성됩니다:
- **Main App**: `Klever Desktop.app/Contents/MacOS/klever-desktop`
- **Helper (GPU)**: GPU 가속 프로세스
- **Helper (Renderer)**: 웹 콘텐츠 렌더링 프로세스
- **Helper (Plugin)**: 플러그인 실행 프로세스

**모든 헬퍼는 `entitlements.mas.inherit.plist`로 서명되어야 합니다.** 그렇지 않으면 V8이 초기화에 실패합니다.

## 빌드 프로세스

### 1. 사전 준비

```bash
# 서명 인증서 설정 (환경 변수)
export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"

# 선택사항: 프로비저닝 프로필 (있는 경우)
export MAS_PROVISIONING_PROFILE="/path/to/profile.provisionprofile"
```

### 2. Mac App Store용 빌드

```bash
# 이전 빌드 정리
rm -rf out/

# 빌드 및 패키징
npm run make -- --platform=mas --arch=universal

# 출력 위치: out/make/
# - out/make/klever-desktop-2.0.0-universal.pkg (Mac App Store 설치 파일)
```

### 3. 서명 검증

```bash
# 메인 앱 서명 확인
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app"

# 헬퍼 서명 확인 (중요!)
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (GPU).app"
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Renderer).app"
codesign -dv --verbose=4 "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Plugin).app"

# 권한(entitlements) 적용 확인
codesign -d --entitlements - "out/klever-desktop-mas-universal/Klever Desktop.app"
codesign -d --entitlements - "out/klever-desktop-mas-universal/Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Renderer).app"
```

예상 출력 결과:
- Authority: `3rd Party Mac Developer Application`
- `com.apple.security.cs.allow-jit` 포함된 권한
- 모든 헬퍼가 상속 권한으로 서명됨

### 4. 로컬 테스트 (선택사항)

```bash
# /Applications에 설치
sudo installer -pkg "out/make/klever-desktop-2.0.0-universal.pkg" -target /

# 실행 및 크래시 확인
open "/Applications/Klever Desktop.app"

# 실패 시 Console.app에서 크래시 리포트 확인
```

## 일반적인 문제들

### 문제: 프로비저닝 프로필을 찾을 수 없음

**오류**: `Error: Could not find provisioning profile at path: build/klever.provisionprofile`

**해결 방법**: 이제 환경 변수를 사용합니다. 다음 중 선택:
1. `MAS_PROVISIONING_PROFILE`을 프로필 경로로 설정하거나
2. 설정하지 않고 그대로 둠 (로컬 빌드에서는 선택사항)

### 문제: 헬퍼 프로세스 크래시

**증상**: 메인 앱이 실행되지만 즉시 V8 오류로 크래시

**해결 방법**: 위의 `codesign -d --entitlements -` 명령어로 헬퍼가 상속 권한으로 서명되었는지 확인

### 문제: 코드 서명 인증서를 찾을 수 없음

**오류**: `Error: No identity found for signing`

**해결 방법**:
```bash
# 사용 가능한 서명 인증서 목록 확인
security find-identity -v -p codesigning

# 다음 두 인증서가 설치되어 있는지 확인:
# - "3rd Party Mac Developer Application"
# - "3rd Party Mac Developer Installer"
```

### 문제: 샌드박스 위반

**증상**: 앱은 실행되지만 기능들이 작동하지 않음 (네트워크, 파일 접근, USB)

**해결 방법**: `build/entitlements.mas.plist`의 권한들을 확인하고 App Store Connect의 capabilities와 일치하는지 확인

## 테스트 체크리스트

App Store 제출 전 확인 사항:

- [ ] 앱이 크래시 없이 실행됨
- [ ] 모든 헬퍼 프로세스가 제대로 서명됨
- [ ] 네트워크 연결 작동 (API 호출, Ollama)
- [ ] 파일 접근 작동 (프로젝트 저장소, 작업 폴더)
- [ ] USB 장치 접근 작동 (Android용 ADB)
- [ ] V8/JavaScript 엔진이 정상적으로 초기화됨
- [ ] Python 서브프로세스 실행 작동
- [ ] Console.app에 샌드박스 위반 없음

## 참고 자료

- [Electron Forge Mac App Store 가이드](https://www.electronforge.io/guides/code-signing/code-signing-macos#mac-app-store)
- [Apple 코드 서명 가이드](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [Electron Entitlements 문서](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)

## 변경 이력

**2025-11-20**: V8 초기화 크래시 수정
- 헬퍼 프로세스의 올바른 서명을 위한 `optionsForFile` 콜백 추가
- 네트워크 접근을 포함한 상속 권한 개선
- 프로비저닝 프로필 참조 수정
- Hardened Runtime 플래그 추가

---

## 추가 참고사항

### 왜 헬퍼 프로세스 서명이 중요한가?

Electron은 Chromium 기반이므로 멀티프로세스 아키텍처를 사용합니다:

1. **메인 프로세스**: 앱의 생명주기와 네이티브 API 관리
2. **렌더러 프로세스**: 각 웹 페이지를 별도 프로세스에서 실행 (보안)
3. **GPU 프로세스**: 하드웨어 가속 그래픽 처리
4. **플러그인 프로세스**: 네이티브 플러그인 실행

각 프로세스는 V8 JavaScript 엔진의 인스턴스를 실행하며, V8은 JIT(Just-In-Time) 컴파일을 위해 실행 가능한 메모리를 동적으로 생성합니다. macOS 샌드박스 환경에서 이를 허용하려면 명시적인 권한이 필요합니다.

### 주요 권한 설명

| 권한 | 용도 | 없을 경우 결과 |
|------|------|----------------|
| `com.apple.security.cs.allow-jit` | JIT 컴파일 허용 | V8 초기화 실패 (크래시) |
| `com.apple.security.cs.allow-unsigned-executable-memory` | 동적 코드 생성 허용 | JavaScript 실행 불가 |
| `com.apple.security.cs.allow-dyld-environment-variables` | 동적 라이브러리 로딩 | 네이티브 모듈 로드 실패 |
| `com.apple.security.cs.disable-library-validation` | 서드파티 라이브러리 허용 | Node.js 네이티브 애드온 작동 불가 |

### 디버깅 팁

크래시가 계속 발생하는 경우:

1. **Console.app 확인**:
   ```bash
   # Console.app 열기
   open -a Console
   # 'klever-desktop' 검색하여 크래시 리포트 찾기
   ```

2. **서명 상세 정보 확인**:
   ```bash
   # 모든 서명 정보 출력
   codesign -dvvv "Klever Desktop.app"
   ```

3. **권한 비교**:
   ```bash
   # 메인 앱과 헬퍼의 권한 비교
   diff <(codesign -d --entitlements - "Klever Desktop.app" 2>&1) \
        <(codesign -d --entitlements - "Klever Desktop.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Helpers/Electron Helper (Renderer).app" 2>&1)
   ```

4. **샌드박스 위반 모니터링**:
   ```bash
   # 샌드박스 로그 실시간 확인
   log stream --predicate 'process == "Klever Desktop" AND eventMessage CONTAINS "sandbox"'
   ```

### 환경 변수 설정 자동화

`.zshrc` 또는 `.bash_profile`에 추가:

```bash
# Mac App Store 빌드를 위한 환경 변수
export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
# export MAS_PROVISIONING_PROFILE="/path/to/profile.provisionprofile"  # 선택사항
```

또는 프로젝트 루트에 `.env.local` 파일 생성 (gitignore 추가):

```bash
CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
# MAS_PROVISIONING_PROFILE="/path/to/profile.provisionprofile"
```

그리고 빌드 스크립트에서:
```bash
source .env.local
npm run make -- --platform=mas
```
