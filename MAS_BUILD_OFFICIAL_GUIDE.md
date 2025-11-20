# Mac App Store 빌드 가이드 (Electron 공식 방법 준수)

**Electron 공식 가이드 기반**: https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide

---

## 🎯 변경 사항 요약

### 공식 가이드 준수를 위한 개선

1. ✅ **불필요한 Entitlements 제거**
   - JIT 관련 entitlements 제거 (Python 번들링하지 않음)
   - App Sandbox 필수 entitlements만 유지

2. ✅ **빌드와 업로드 분리**
   - `build-appstore.sh`: 빌드 + 서명 + 검증만
   - `upload-appstore.sh`: App Store Connect 업로드만

3. ✅ **MAS 제한 사항 준수**
   - crashReporter, autoUpdater 미사용 확인
   - MAS 전용 Electron 빌드 사용

---

## 📋 Entitlements 변경

### Before (불필요한 권한 포함)
```xml
<!-- ❌ Python 번들링하지 않으므로 불필요 -->
<key>com.apple.security.cs.allow-jit</key>
<true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key>
<true/>
<key>com.apple.security.cs.disable-library-validation</key>
<true/>
```

### After (필수 권한만)
```xml
<!-- ✅ App Sandbox (Required for MAS) -->
<key>com.apple.security.app-sandbox</key>
<true/>

<!-- Network Access -->
<key>com.apple.security.network.client</key>
<true/>
<key>com.apple.security.network.server</key>
<true/>

<!-- File Access -->
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
<key>com.apple.security.files.downloads.read-write</key>
<true/>
```

**장점**:
- ✅ Apple 심사 과정 간소화
- ✅ 불필요한 권한 요청 제거
- ✅ 보안 프로필 개선

---

## 🚀 빌드 프로세스

### 1. 준비물

**필수 인증서** (Keychain에 설치):
- **Apple Distribution** (또는 3rd Party Mac Developer Application)
- **Mac Installer Distribution** (또는 3rd Party Mac Developer Installer)

**Provisioning Profile**:
- `build/embedded.provisionprofile` (Apple Developer Portal에서 다운로드)

**확인 방법**:
```bash
# 인증서 확인
security find-identity -v -p codesigning

# 필요한 인증서 확인
# - Apple Distribution: Your Name (TEAM_ID)
# - Mac Installer Distribution: Your Name (TEAM_ID)
```

### 2. 빌드 실행

```bash
# 기본 빌드
./scripts/build-appstore.sh

# 또는 빌드 번호 지정
BUILD_NUMBER=5 ./scripts/build-appstore.sh
```

**스크립트 동작**:
1. ✅ 인증서 자동 탐지
2. ✅ 아이콘 생성
3. ✅ 의존성 설치
4. ✅ Electron 앱 빌드
5. ✅ MAS 패키징 (electron-builder)
6. ✅ 서명 검증

**출력**:
```
dist-electron/mas/Klever Desktop-2.0.0.pkg
```

### 3. 업로드 (별도 스크립트)

```bash
# 환경 변수 설정
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ZQC7QNZ4J8"

# 업로드 실행
./scripts/upload-appstore.sh "dist-electron/mas/Klever Desktop-2.0.0.pkg"
```

**또는 .env 파일 사용**:
```bash
# .env.mas 파일 생성
cp .env.mas.example .env.mas
nano .env.mas  # 값 입력

# 환경 변수 로드 후 업로드
source .env.mas
./scripts/upload-appstore.sh "dist-electron/mas/Klever Desktop-2.0.0.pkg"
```

**대안: Transporter 앱 사용** (권장):
1. Mac App Store에서 Transporter 다운로드
2. PKG 파일을 Transporter에 드래그
3. "Deliver" 클릭
4. 더 나은 에러 메시지 제공

---

## 📁 파일 구조

```
KleverDesktop/
├── build/
│   ├── entitlements.mas.plist          ← 정리됨 (JIT 제거)
│   ├── entitlements.mas.inherit.plist  ← 정리됨 (JIT 제거)
│   ├── embedded.provisionprofile       ← 필수 (Apple Developer Portal)
│   └── icon.icns
├── scripts/
│   ├── build-appstore.sh               ← 빌드 + 서명 (단순화)
│   └── upload-appstore.sh              ← 업로드 (새 파일)
├── .env.mas.example                    ← 환경 변수 템플릿
└── package.json                        ← electron-builder 설정
```

---

## ✅ Electron 공식 가이드 체크리스트

### 인증서 (Certificate Requirements)
- [x] Apple Distribution 사용
- [x] Mac Installer Distribution 사용
- [x] 자동 탐지 기능

### App Sandbox
- [x] `com.apple.security.app-sandbox` 활성화
- [x] 필요한 entitlements만 포함
- [x] 불필요한 JIT entitlements 제거

### MAS Build
- [x] `mas` 타겟 사용 (darwin 아님)
- [x] `type: distribution` 설정
- [x] hardenedRuntime false (샌드박스로 충분)

### MAS Limitations
- [x] crashReporter 미사용
- [x] autoUpdater 미사용

### Provisioning Profile
- [x] `build/embedded.provisionprofile` 경로
- [x] Apple Developer Portal에서 다운로드

---

## 🔧 문제 해결

### 빌드 실패: "PKG file not found"

**원인**:
- Provisioning profile 누락
- 인증서 문제

**해결**:
```bash
# 1. Provisioning profile 확인
ls -la build/embedded.provisionprofile

# 2. 인증서 확인
security find-identity -v -p codesigning

# 3. 디버그 모드로 재빌드
DEBUG=electron-builder ./scripts/build-appstore.sh
```

### 업로드 실패: "Invalid credentials"

**원인**:
- App-specific password 오류
- Team ID 오류

**해결**:
```bash
# 1. 새 app-specific password 생성
# https://appleid.apple.com/account/manage

# 2. Team ID 확인
# https://developer.apple.com/account/#!/membership

# 3. 대안: Transporter 앱 사용
# https://apps.apple.com/app/transporter/id1450874784
```

### App Store 심사 거부: "Invalid Entitlements"

**원인**:
- 불필요한 entitlements 포함

**해결**:
- ✅ 이미 해결됨! JIT entitlements 제거됨
- Apple이 요구하는 설명:
  - `network.server`: "로컬 AI 모델 서버 (Ollama)"
  - 다른 entitlements는 표준 Electron 앱 요구사항

---

## 📚 참고 자료

### Electron 공식
- **MAS Submission Guide**: https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide
- **Code Signing**: https://www.electronjs.org/docs/latest/tutorial/code-signing

### Apple 공식
- **App Store Connect**: https://appstoreconnect.apple.com
- **Developer Portal**: https://developer.apple.com/account
- **App-Specific Password**: https://appleid.apple.com/account/manage
- **Provisioning Profiles**: https://developer.apple.com/account/resources/profiles
- **App Sandbox Guide**: https://developer.apple.com/documentation/bundleresources/entitlements

### 도구
- **Transporter**: https://apps.apple.com/app/transporter/id1450874784
- **electron-builder**: https://www.electron.build/configuration/mas

---

## 🎯 다음 단계

### 1. 로컬 테스트 (선택사항)

mas-dev 빌드로 로컬 테스트:

```bash
# package.json에서 임시로 변경
"mas": {
  "type": "development",  // distribution → development
  "provisioningProfile": "build/AppleDevelopment.provisionprofile"
}

# 빌드
./scripts/build-appstore.sh

# 테스트
open "dist-electron/mas-dev/Klever Desktop.app"
```

**주의**: distribution 빌드는 로컬에서 실행 불가 (정상 동작)

### 2. 제출

1. ✅ 빌드 완료
2. ✅ 업로드 완료
3. ⏳ 처리 대기 (5-30분)
4. 📝 App Store Connect에서 빌드 선택
5. 📝 "What's New" 작성
6. 📝 App Privacy 완성
7. 🚀 심사 제출

---

**모든 준비 완료! 🎉**

이제 Electron 공식 가이드를 준수하는 안정적인 MAS 빌드 프로세스가 완성되었습니다.
