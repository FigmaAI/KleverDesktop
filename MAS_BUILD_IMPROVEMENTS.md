# Mac App Store Build Script - Improvements Summary

## 🎯 Overview

`scripts/build-appstore.sh` 스크립트를 electron-builder의 MAS 빌드 프로세스에 맞게 개선했습니다.

---

## ✅ 주요 개선 사항

### 1. 인증서 자동 탐지 개선 (라인 66-111)

**변경 전:**
- "3rd Party Mac Developer Application" 인증서만 탐지
- 구 명칭 기준으로 하드코딩

**변경 후:**
- **"Apple Distribution"** 우선 탐지 (최신 명칭)
- "3rd Party Mac Developer Application"을 fallback으로 사용
- **"Mac Installer Distribution"** 자동 탐지 추가
- 더 명확한 에러 메시지 제공

```bash
# 자동 탐지 예시:
✅ Auto-detected: Apple Distribution: Your Name (TEAM_ID)
✅ Auto-detected: Mac Installer Distribution: Your Name (TEAM_ID)
```

### 2. PKG 서명 검증 강화 (라인 262-311)

**변경 전:**
- `pkgutil` 출력을 `/dev/null`로 보내서 에러 확인 불가
- 단순 성공/실패만 표시

**변경 후:**
- 상세한 에러 메시지 출력
- 실패 시 원인 분석 및 해결 방법 제시
- 인터랙티브 확인 (실패 시 계속할지 물어봄)
- PKG 서명 상세 정보 표시

```bash
# 출력 예시:
📋 PKG Signature Details:
   Status: signed by a developer certificate issued by Apple
   Certificate: Mac Installer Distribution: Your Name (TEAM_ID)
```

### 3. App Bundle 서명 검증 강화 (라인 313-376)

**변경 전:**
- 간단한 `codesign --verify` 체크만 수행
- 서명 상세 정보 확인 불가

**변경 후:**
- `--deep --strict` 옵션으로 철저한 검증
- 서명 Authority, TeamIdentifier 등 상세 정보 표시
- **Python 런타임 서명 확인 추가** (afterSign.js 검증)
- 실패 시 빌드 중단

```bash
# Python 서명 확인 예시:
🔍 Checking Python runtime signature...
✅ Python runtime signed: darwin-arm64
```

### 4. CFBundleVersion 설정 개선 (라인 246-258)

**변경 전:**
- `--config.buildVersion` 파라미터 사용 (electron-builder가 인식하지 못할 수 있음)

**변경 후:**
- `ELECTRON_BUILDER_BUILD_NUMBER` 환경 변수 사용 (공식 방법)
- electron-builder 자동 처리에 맡김

```bash
export ELECTRON_BUILDER_BUILD_NUMBER="$BUILD_NUMBER"
```

---

## 🔍 Electron-Builder MAS 서명 프로세스 이해

### 인증서 역할 명확화

| 인증서 | 용도 | electron-builder 사용 방법 |
|--------|------|---------------------------|
| **Apple Distribution** | .app 내부 바이너리 서명 | `CSC_NAME` 환경 변수 |
| **Mac Installer Distribution** | .pkg 파일 서명 | `CSC_INSTALLER_NAME` 또는 **자동 탐지** |

### 서명 흐름

```
1. electron-builder가 .app 빌드
   ↓
2. CSC_NAME으로 모든 바이너리 서명
   - Electron 프레임워크
   - Helper 프로세스 (GPU, Renderer, Plugin)
   - 모든 .dylib, .node 파일
   ↓
3. .pkg 생성
   ↓
4. CSC_INSTALLER_NAME (또는 자동 탐지)로 .pkg 서명
   ↓
5. 검증 완료
```

**Note**: `afterSign` 훅을 제거하여 electron-builder의 자동 서명에만 의존합니다.

### Python 번들링 제거

**변경**: Python 런타임을 앱에 번들링하지 **않음**
- 시스템 Python 사용 (사용자가 직접 설치)
- `extraResources`에 `appagent` Python 스크립트만 포함
- 번들 크기 감소 및 업데이트 용이성

**afterSign.js 제거**: Python 재서명이 불필요하므로 afterSign 훅 제거
- electron-builder가 모든 앱 바이너리를 자동 서명
- 충돌 가능성 제거
- 빌드 프로세스 단순화

---

## 📋 package.json 변경 사항

### 변경 전:
```json
"build": {
  "appId": "com.klever.desktop",
  "productName": "Klever Desktop",
  "afterSign": "scripts/afterSign.js",  // ❌ Python 번들링 안 하므로 불필요
  ...
},
"mas": {
  "type": "distribution",
  "hardenedRuntime": false,
  "entitlements": "build/entitlements.mas.plist",
  "entitlementsInherit": "build/entitlements.mas.inherit.plist",
  "provisioningProfile": "klever.provisionprofile",  // ❌ 상대 경로 불명확
  "notarize": false,
  "identity": "JooHyung Park (ZQC7QNZ4J8)",  // ❌ Team ID 형식 (잘못된 값)
  "minimumSystemVersion": "12.0"
}
```

### 변경 후:
```json
"build": {
  "appId": "com.klever.desktop",
  "productName": "Klever Desktop",
  // afterSign 제거 - electron-builder가 자동으로 모든 바이너리 서명
  ...
},
"mas": {
  "type": "distribution",
  "hardenedRuntime": false,
  "entitlements": "build/entitlements.mas.plist",
  "entitlementsInherit": "build/entitlements.mas.inherit.plist",
  "provisioningProfile": "build/embedded.provisionprofile",  // ✅ 명확한 경로
  "notarize": false,
  // identity 제거 → 환경 변수로 관리
  "minimumSystemVersion": "12.0"
}
```

**주요 변경:**
1. ✅ `afterSign` 훅 제거: Python 번들링하지 않으므로 불필요, electron-builder에 맡김
2. ✅ `provisioningProfile` 경로 명확화: `build/embedded.provisionprofile`
3. ✅ `identity` 설정 제거: 환경 변수 `CSC_NAME`으로 관리 (유연성 향상)

---

## 🚀 사용 방법

### 1. 환경 변수 설정 (선택사항)

스크립트가 자동으로 인증서를 탐지하지만, 명시적으로 설정하려면:

```bash
# .env.mas 파일 생성 (템플릿 복사)
cp .env.mas.example .env.mas

# 값 입력
nano .env.mas

# 환경 변수 로드
source .env.mas
```

**필수 변수 (업로드 시):**
- `APPLE_ID`: Apple ID 이메일
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Team ID (e.g., ZQC7QNZ4J8)

**선택 변수 (자동 탐지 가능):**
- `CSC_NAME`: Apple Distribution 인증서 이름
- `CSC_INSTALLER_NAME`: Mac Installer Distribution 인증서 이름

### 2. Provisioning Profile 준비

1. [Apple Developer Portal](https://developer.apple.com/account/resources/profiles)에서 Mac App Store 프로비저닝 프로파일 다운로드
2. `build/embedded.provisionprofile`로 저장

### 3. 빌드 실행

```bash
# 전체 빌드 + 검증 + 업로드
AUTO_UPLOAD=true ./scripts/build-appstore.sh

# 빌드만 (업로드 생략)
./scripts/build-appstore.sh

# 빌드 번호 환경 변수로 지정
BUILD_NUMBER=5 ./scripts/build-appstore.sh
```

### 4. 출력 확인

개선된 스크립트는 다음을 확인합니다:

```bash
✅ Auto-detected: Apple Distribution: Your Name (TEAM_ID)
✅ Auto-detected: Mac Installer Distribution: Your Name (TEAM_ID)
✅ Icons generated successfully
✅ Dependencies installed
✅ Application built successfully
✅ Mac App Store package created

🔍 Verifying build...
✅ PKG file found: dist-electron/mas/Klever Desktop-2.0.0.pkg (150M)
   ✅ PKG signature valid

   📋 PKG Signature Details:
      Status: signed Apple Mac OS X Installer Package
      Certificate: Mac Installer Distribution: Your Name (TEAM_ID)

   ✅ App bundle signature valid

   📋 App Signature Details:
      Authority=Apple Distribution: Your Name (TEAM_ID)
      TeamIdentifier=YOUR_TEAM_ID
      Identifier=com.klever.desktop

✅ Build verification completed
```

---

## 🔧 문제 해결

### PKG 서명 실패

**증상:**
```
❌ PKG signature verification FAILED!
```

**원인:**
1. Mac Installer Distribution 인증서가 Keychain에 없음
2. 인증서가 만료되었음
3. electron-builder가 인증서를 찾지 못함

**해결:**
```bash
# 1. 인증서 확인
security find-identity -v -p codesigning

# 2. Mac Installer Distribution 인증서가 있는지 확인
# 없으면 Xcode에서 생성하거나 Apple Developer Portal에서 다운로드

# 3. 명시적으로 인증서 지정
export CSC_INSTALLER_NAME="Mac Installer Distribution: Your Name (TEAM_ID)"
./scripts/build-appstore.sh
```

### .app은 생성되지만 .pkg가 생성되지 않음

**증상:**
```
❌ Error: PKG file not found in dist-electron
```

**원인:**
- electron-builder가 .pkg 생성 단계에서 실패
- provisioning profile 누락 또는 잘못됨

**해결:**
```bash
# 1. provisioning profile 확인
ls -la build/embedded.provisionprofile

# 2. provisioning profile이 올바른 Bundle ID를 포함하는지 확인
security cms -D -i build/embedded.provisionprofile | grep -A2 "application-identifier"

# 3. 디버그 모드로 상세 로그 확인
DEBUG=electron-builder ./scripts/build-appstore.sh 2>&1 | tee build.log
```

---

## 📚 추가 리소스

- **MAS_BUILD_GUIDE.md**: 전체 MAS 빌드 가이드 (인증서 생성, 프로비저닝 프로파일 등)
- **scripts/afterSign.js**: Python 런타임 재서명 로직
- **.env.mas.example**: 환경 변수 템플릿

---

## ✨ 다음 단계

빌드 성공 후:

1. **테스트**: mas-dev 빌드로 로컬 테스트
   ```bash
   # package.json에서 type을 "development"로 변경 후
   ./scripts/build-appstore.sh
   open "dist-electron/mas-dev/Klever Desktop.app"
   ```

2. **업로드**: Transporter 앱 또는 altool 사용
   ```bash
   AUTO_UPLOAD=true ./scripts/build-appstore.sh
   ```

3. **App Store Connect**: 빌드 선택 및 제출
   - [App Store Connect](https://appstoreconnect.apple.com)
   - "Activity" 탭에서 처리 상태 확인 (5-30분)
   - "App Store" 탭에서 빌드 선택
   - 심사 제출

---

**개선 완료! 🎉**

이제 electron-builder의 자동 서명 프로세스를 최대한 활용하고, 명확한 검증 및 에러 메시지를 제공합니다.
