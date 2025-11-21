# GitHub Actions 자동 빌드 파이프라인

Mac App Store용 자동 빌드·배포 파이프라인 가이드입니다.

## 📖 목차

1. [개요](#개요)
2. [빠른 시작](#빠른-시작)
3. [워크플로우 동작 방식](#워크플로우-동작-방식)
4. [트리거 조건](#트리거-조건)
5. [수동 실행](#수동-실행)
6. [문제 해결](#문제-해결)

---

## 개요

이 파이프라인은 다음을 자동화합니다:

```
코드 변경 → 빌드 → 서명 → 업로드 → App Store Connect
```

### 자동화되는 작업

✅ **인증서 설치** - Apple Distribution 및 Installer 인증서 자동 설치
✅ **프로비저닝 프로파일** - Mac App Store 프로파일 자동 설치
✅ **Universal 빌드** - x64 + ARM64 통합 바이너리 생성
✅ **코드 서명** - 모든 Electron 프로세스 서명
✅ **PKG 생성** - App Store 배포용 패키지 생성
✅ **자동 업로드** - App Store Connect에 자동 업로드
✅ **정리** - 빌드 완료 후 아티팩트 자동 삭제

---

## 빠른 시작

### 1️⃣ GitHub Secrets 설정

먼저 필요한 인증 정보를 GitHub Secrets에 추가해야 합니다.

📚 **상세 가이드**: [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md)

#### 필수 Secrets 목록

| Secret 이름 | 설명 |
|------------|------|
| `APPLE_ID` | Apple ID 이메일 |
| `APPLE_APP_SPECIFIC_PASSWORD` | 앱 전용 암호 |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `CSC_NAME` | Apple Distribution 인증서 이름 |
| `CSC_INSTALLER_NAME` | Installer 인증서 이름 |
| `CERTIFICATE_P12_BASE64` | Apple Distribution 인증서 (Base64) |
| `CERTIFICATE_PASSWORD` | Apple Distribution 인증서 비밀번호 |
| `INSTALLER_CERTIFICATE_P12_BASE64` | Installer 인증서 (Base64) |
| `INSTALLER_CERTIFICATE_PASSWORD` | Installer 인증서 비밀번호 |
| `PROVISIONING_PROFILE_BASE64` | 프로비저닝 프로파일 (Base64) |

#### 빠른 인코딩

인증서와 프로파일을 Base64로 인코딩:

```bash
# 스크립트 사용 (권장)
./scripts/encode-secrets.sh certificate.p12 installer.p12 embedded.provisionprofile

# 수동 인코딩
base64 -i certificate.p12 | pbcopy  # macOS
base64 -w 0 certificate.p12         # Linux
```

---

### 2️⃣ 버전/빌드 번호 업데이트

파이프라인은 다음 파일의 변경을 감지합니다:

#### 앱 버전 변경 (`package.json`)

```json
{
  "version": "2.0.0"  // → "2.1.0"으로 변경
}
```

#### 빌드 번호 변경 (`forge.config.js`)

```javascript
module.exports = {
  packagerConfig: {
    buildVersion: '13',  // → '14'로 변경
    // ...
  },
  // ...
}
```

---

### 3️⃣ Push 및 자동 실행

```bash
# 변경사항 커밋
git add package.json forge.config.js
git commit -m "chore: bump version to 2.1.0 (build 14)"

# main 브랜치에 푸시
git push origin main
```

푸시 즉시 GitHub Actions가 자동으로 실행됩니다!

---

## 워크플로우 동작 방식

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Checkout Code                                            │
├─────────────────────────────────────────────────────────────┤
│ 2. Extract Version & Build Number                           │
│    - package.json → version                                 │
│    - forge.config.js → buildVersion                         │
├─────────────────────────────────────────────────────────────┤
│ 3. Setup Node.js 20 + npm ci                                │
├─────────────────────────────────────────────────────────────┤
│ 4. Install Apple Certificates                               │
│    - Decode Base64 → .p12 files                             │
│    - Create temporary keychain                              │
│    - Import certificates to keychain                        │
├─────────────────────────────────────────────────────────────┤
│ 5. Install Provisioning Profile                             │
│    - Decode Base64 → .provisionprofile                      │
│    - Extract UUID                                           │
│    - Install to ~/Library/MobileDevice/Provisioning Profiles│
├─────────────────────────────────────────────────────────────┤
│ 6. Build MAS Universal                                      │
│    - npm run make -- --platform=mas --arch=universal        │
│    - Sign all Electron processes                            │
│    - Create PKG for App Store                               │
├─────────────────────────────────────────────────────────────┤
│ 7. Verify Build                                             │
│    - Check PKG file exists                                  │
│    - Verify PKG signature                                   │
├─────────────────────────────────────────────────────────────┤
│ 8. Upload to App Store Connect                              │
│    - Run scripts/upload-appstore.sh                         │
│    - Upload via xcrun altool                                │
├─────────────────────────────────────────────────────────────┤
│ 9. Upload Artifacts (GitHub)                                │
│    - Save PKG for 30 days                                   │
├─────────────────────────────────────────────────────────────┤
│ 10. Cleanup                                                 │
│    - Delete keychain                                        │
│    - Remove provisioning profiles                           │
│    - Delete build artifacts (if upload succeeded)           │
└─────────────────────────────────────────────────────────────┘
```

### 빌드 시간

- **전체 소요 시간**: 약 15-25분
  - 환경 설정: 2-3분
  - 빌드: 8-12분
  - 업로드: 5-10분

---

## 트리거 조건

워크플로우는 다음 조건에서 자동 실행됩니다:

### 1. 파일 변경 감지 (push to main)

```yaml
on:
  push:
    branches:
      - main
    paths:
      - 'package.json'           # 앱 버전 변경
      - 'forge.config.js'        # 빌드 번호 변경
```

### 2. 워크플로우 자체 수정

```yaml
paths:
  - '.github/workflows/build-mas.yml'  # 워크플로우 변경 시 테스트
```

### 3. 수동 실행

GitHub UI에서 언제든지 수동 실행 가능:

```yaml
on:
  workflow_dispatch:  # "Run workflow" 버튼 활성화
```

---

## 수동 실행

자동 트리거 없이 언제든지 수동으로 실행할 수 있습니다.

### 방법 1: GitHub UI

1. **Repository** → **Actions** 탭 클릭
2. **"Build & Upload Mac App Store"** 워크플로우 선택
3. **"Run workflow"** 드롭다운 클릭
4. 브랜치 선택 (기본값: main)
5. **"Run workflow"** 버튼 클릭

### 방법 2: GitHub CLI

```bash
# 설치 (없는 경우)
brew install gh

# 인증
gh auth login

# 워크플로우 실행
gh workflow run build-mas.yml

# 실행 상태 확인
gh run list --workflow=build-mas.yml
```

---

## 빌드 상태 확인

### GitHub Actions UI

1. **Repository** → **Actions** 탭
2. 최신 워크플로우 실행 클릭
3. 각 단계별 로그 확인

### 주요 확인 포인트

- ✅ **Install Apple certificates** - 인증서 설치 성공 여부
- ✅ **Build MAS Universal** - 빌드 성공 여부
- ✅ **Verify build artifacts** - PKG 서명 검증
- ✅ **Upload to App Store Connect** - 업로드 성공 여부

### App Store Connect 확인

업로드 완료 후:

1. https://appstoreconnect.apple.com 방문
2. **앱 선택** → **Activity** 탭
3. **Processing** 상태 확인 (5-30분 소요)
4. 처리 완료 후 **빌드 선택** → **Submit for Review**

---

## 문제 해결

### 🔴 인증서 설치 실패

**증상**: "Install Apple certificates" 단계 실패

**원인**:
- Base64 디코딩 실패
- 잘못된 인증서 비밀번호

**해결**:
1. Secrets 확인: `CERTIFICATE_P12_BASE64` 올바른지 확인
2. 비밀번호 확인: `CERTIFICATE_PASSWORD` 정확한지 확인
3. 재인코딩: `./scripts/encode-secrets.sh` 재실행

---

### 🔴 빌드 서명 실패

**증상**: "Build MAS Universal" 단계에서 서명 오류

**원인**:
- 인증서 이름 불일치
- 프로비저닝 프로파일 문제

**해결**:
```bash
# 로컬에서 인증서 이름 확인
security find-identity -v -p codesigning

# 출력 예시:
# 1) ABC123 "Apple Distribution: Your Name (TEAM_ID)"
# 2) DEF456 "3rd Party Mac Developer Installer: Your Name (TEAM_ID)"

# GitHub Secrets의 CSC_NAME과 정확히 일치하는지 확인
```

---

### 🔴 업로드 실패

**증상**: "Upload to App Store Connect" 단계 실패

**원인**:
- 잘못된 Apple ID 정보
- 만료된 App-Specific Password
- 네트워크 오류

**해결**:
1. **App-Specific Password 재생성**:
   - https://appleid.apple.com/account/manage
   - 새 암호 생성
   - GitHub Secrets 업데이트

2. **Team ID 확인**:
   - https://developer.apple.com/account/#!/membership
   - `APPLE_TEAM_ID` Secret 확인

3. **재시도**: 네트워크 일시적 오류일 수 있음

---

### 🔴 빌드는 성공했으나 App Store Connect에 표시 안 됨

**증상**: 업로드 성공 메시지는 나왔지만 App Store Connect에 빌드가 안 보임

**원인**:
- Processing 중 (최대 30분 소요)
- Bundle ID 불일치
- 앱이 App Store Connect에 생성되지 않음

**해결**:
1. **Processing 대기**: 5-30분 대기 후 새로고침
2. **이메일 확인**: Apple에서 오류 이메일 발송 여부 확인
3. **Bundle ID 확인**:
   ```javascript
   // forge.config.js
   appBundleId: 'com.klever.desktop'  // App Store Connect와 일치해야 함
   ```

---

### 🔴 정리 단계 실패

**증상**: "Cleanup" 단계 오류

**원인**: 권한 문제 (무시해도 됨)

**영향**: 없음 (GitHub Actions runner는 매번 새로 생성됨)

---

## 보안 고려사항

### ✅ Secrets 관리

- **절대 코드에 하드코딩 금지**
- **Secrets는 GitHub UI에서만 관리**
- **로컬 인증서 파일은 즉시 삭제**

### ✅ 인증서 보호

```bash
# ❌ 절대 금지
git add certificate.p12
git commit -m "Add certificate"

# ✅ 올바른 방법
./scripts/encode-secrets.sh certificate.p12 installer.p12 profile.provisionprofile
# → GitHub Secrets에 추가
rm certificate.p12 installer.p12 profile.provisionprofile  # 즉시 삭제
```

### ✅ .gitignore 확인

```gitignore
# 인증서 및 프로파일 (절대 커밋 금지)
*.p12
*.mobileprovision
*.provisionprofile
*.cer
*.certSigningRequest

# 환경 변수
.env
.env.local
.env.*.local
```

---

## 고급 사용법

### 특정 브랜치에서 빌드

```yaml
# .github/workflows/build-mas.yml 수정
on:
  push:
    branches:
      - main
      - release/*  # release/v2.0.0 등에서도 실행
```

### 태그 기반 트리거

```yaml
on:
  push:
    tags:
      - 'v*'  # v2.0.0 태그 푸시 시 실행
```

### 빌드 시간 단축

```yaml
# 캐시 활용
- name: Cache node modules
  uses: actions/cache@v3
  with:
    path: node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('package-lock.json') }}
```

---

## 추가 자료

- 📚 [GitHub Secrets 설정 가이드](./GITHUB_SECRETS_SETUP.md)
- 📚 [Mac App Store 빌드 가이드](../MAS_BUILD_TROUBLESHOOTING.md)
- 🔗 [Electron - MAS Submission Guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- 🔗 [GitHub Actions - Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- 🔗 [Apple - App Store Connect](https://developer.apple.com/app-store-connect/)

---

## 지원

문제가 발생하면:

1. **Actions 로그 확인**: 상세한 에러 메시지 확인
2. **문제 해결 섹션** 참조
3. **Issue 생성**: 로그와 함께 이슈 등록

---

## 변경 이력

- **2024-11-21**: 초기 버전 작성
  - Mac App Store 자동 빌드 파이프라인 구축
  - Universal binary 지원
  - 자동 업로드 기능 추가
