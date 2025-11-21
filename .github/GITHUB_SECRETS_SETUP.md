# GitHub Secrets 설정 가이드

이 문서는 Mac App Store 자동 빌드 파이프라인에 필요한 GitHub Secrets를 설정하는 방법을 안내합니다.

## 📋 필요한 Secrets 목록

### 1. Apple 계정 정보
- `APPLE_ID` - Apple ID 이메일
- `APPLE_APP_SPECIFIC_PASSWORD` - 앱 전용 암호
- `APPLE_TEAM_ID` - Apple Developer Team ID

### 2. 코드 서명 인증서 정보
- `CSC_NAME` - Apple Distribution 인증서 이름
- `CSC_INSTALLER_NAME` - Installer 인증서 이름

### 3. 인증서 파일 (Base64 인코딩)
- `CERTIFICATE_P12_BASE64` - Apple Distribution 인증서 (Base64)
- `CERTIFICATE_PASSWORD` - Apple Distribution 인증서 비밀번호
- `INSTALLER_CERTIFICATE_P12_BASE64` - Installer 인증서 (Base64)
- `INSTALLER_CERTIFICATE_PASSWORD` - Installer 인증서 비밀번호

### 4. 프로비저닝 프로파일
- `PROVISIONING_PROFILE_BASE64` - Mac App Store 프로비저닝 프로파일 (Base64)

---

## 🔧 설정 단계

### Step 1: Apple 계정 정보 수집

#### 1.1. Apple ID
- 본인의 Apple ID 이메일 주소

#### 1.2. App-Specific Password 생성
1. https://appleid.apple.com 방문
2. "Sign-In and Security" → "App-Specific Passwords" 클릭
3. "Generate Password" 클릭
4. 이름 입력 (예: "GitHub Actions")
5. 생성된 암호 복사 (형식: `xxxx-xxxx-xxxx-xxxx`)

#### 1.3. Team ID 확인
1. https://developer.apple.com/account/#!/membership 방문
2. "Team ID" 확인 (예: `ZQC7QNZ4J8`)

---

### Step 2: 코드 서명 인증서 정보 확인

#### 2.1. CSC_NAME (Apple Distribution)
터미널에서 다음 명령어 실행:
```bash
security find-identity -v -p codesigning
```

출력 예시:
```
1) 1234567890ABCDEF "Apple Distribution: Your Name (TEAM_ID)"
2) 0987654321FEDCBA "3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
```

`CSC_NAME`에 사용할 값:
```
Apple Distribution: Your Name (TEAM_ID)
```

#### 2.2. CSC_INSTALLER_NAME (Installer)
위 명령어 출력에서 "3rd Party Mac Developer Installer" 라인 복사:
```
3rd Party Mac Developer Installer: Your Name (TEAM_ID)
```

---

### Step 3: 인증서를 P12 파일로 내보내기

#### 3.1. Keychain Access 열기
1. Applications → Utilities → Keychain Access

#### 3.2. Apple Distribution 인증서 내보내기
1. "My Certificates" 카테고리 선택
2. "Apple Distribution: Your Name (TEAM_ID)" 인증서 찾기
3. 인증서와 **개인 키 모두 선택** (화살표 펼쳐서 확인)
4. 우클릭 → "Export 2 items..." 선택
5. 파일명: `certificate.p12`
6. 암호 입력 (나중에 `CERTIFICATE_PASSWORD`로 사용)
7. 저장

#### 3.3. Installer 인증서 내보내기
1. "3rd Party Mac Developer Installer: Your Name (TEAM_ID)" 인증서 찾기
2. 인증서와 **개인 키 모두 선택**
3. 우클릭 → "Export 2 items..."
4. 파일명: `installer.p12`
5. 암호 입력 (나중에 `INSTALLER_CERTIFICATE_PASSWORD`로 사용)
6. 저장

---

### Step 4: 프로비저닝 프로파일 다운로드

#### 4.1. Apple Developer 포털
1. https://developer.apple.com/account/resources/profiles/list 방문
2. Mac App Store용 프로비저닝 프로파일 찾기
3. 다운로드 (파일명: `embedded.provisionprofile` 또는 유사)

또는 로컬에 이미 있는 경우:
```bash
# 프로비저닝 프로파일 위치
ls ~/Library/MobileDevice/Provisioning\ Profiles/
```

---

### Step 5: 파일을 Base64로 인코딩

프로젝트 루트에 `scripts/encode-secrets.sh` 스크립트를 사용하거나 수동으로 인코딩:

#### 5.1. 수동 인코딩 (macOS/Linux)
```bash
# Apple Distribution 인증서
base64 -i certificate.p12 | pbcopy
# 클립보드에 복사됨 → CERTIFICATE_P12_BASE64

# Installer 인증서
base64 -i installer.p12 | pbcopy
# 클립보드에 복사됨 → INSTALLER_CERTIFICATE_P12_BASE64

# 프로비저닝 프로파일
base64 -i embedded.provisionprofile | pbcopy
# 클립보드에 복사됨 → PROVISIONING_PROFILE_BASE64
```

#### 5.2. 스크립트 사용 (권장)
```bash
# 인코딩 스크립트 실행
chmod +x scripts/encode-secrets.sh
./scripts/encode-secrets.sh certificate.p12 installer.p12 embedded.provisionprofile
```

출력된 Base64 문자열을 복사하여 GitHub Secrets에 추가합니다.

---

### Step 6: GitHub Repository에 Secrets 추가

1. **GitHub Repository 페이지** 이동
2. **Settings** 탭 클릭
3. **Secrets and variables** → **Actions** 클릭
4. **New repository secret** 클릭

각 Secret을 다음과 같이 추가:

| Secret Name | Value | 예시 |
|-------------|-------|------|
| `APPLE_ID` | Apple ID 이메일 | `your@email.com` |
| `APPLE_APP_SPECIFIC_PASSWORD` | 앱 전용 암호 | `xxxx-xxxx-xxxx-xxxx` |
| `APPLE_TEAM_ID` | Team ID | `ZQC7QNZ4J8` |
| `CSC_NAME` | Apple Distribution 인증서 이름 | `Apple Distribution: Your Name (TEAM_ID)` |
| `CSC_INSTALLER_NAME` | Installer 인증서 이름 | `3rd Party Mac Developer Installer: Your Name (TEAM_ID)` |
| `CERTIFICATE_P12_BASE64` | Apple Distribution 인증서 Base64 | (Step 5에서 복사한 긴 문자열) |
| `CERTIFICATE_PASSWORD` | Apple Distribution 인증서 비밀번호 | (Step 3.2에서 설정한 암호) |
| `INSTALLER_CERTIFICATE_P12_BASE64` | Installer 인증서 Base64 | (Step 5에서 복사한 긴 문자열) |
| `INSTALLER_CERTIFICATE_PASSWORD` | Installer 인증서 비밀번호 | (Step 3.3에서 설정한 암호) |
| `PROVISIONING_PROFILE_BASE64` | 프로비저닝 프로파일 Base64 | (Step 5에서 복사한 긴 문자열) |

---

## ✅ 설정 확인

모든 Secrets를 추가한 후:

1. **GitHub Actions** 탭으로 이동
2. **"Build & Upload Mac App Store"** 워크플로우 선택
3. **"Run workflow"** 클릭하여 수동 실행
4. 로그를 확인하여 인증서 설치 및 빌드가 성공하는지 확인

---

## 🔒 보안 주의사항

1. **.p12 파일과 프로비저닝 프로파일은 로컬에서 삭제**
   - Base64 인코딩 후 GitHub Secrets에 추가했다면 로컬 파일은 안전하게 삭제

2. **앱 전용 암호 재사용 금지**
   - GitHub Actions 전용으로 별도 생성
   - 필요시 언제든지 재발급 가능

3. **인증서 비밀번호는 강력하게 설정**
   - 최소 12자 이상 권장

4. **Secrets는 절대 코드에 하드코딩하지 않기**
   - 모든 민감 정보는 GitHub Secrets로 관리

---

## 🚀 자동화 트리거

설정 완료 후, 다음 조건에서 자동 빌드가 실행됩니다:

1. **`package.json`의 `version` 변경**
   - 예: `2.0.0` → `2.1.0`

2. **`forge.config.js`의 `buildVersion` 변경**
   - 예: `buildVersion: '13'` → `buildVersion: '14'`

3. **수동 실행**
   - GitHub Actions 탭에서 "Run workflow" 클릭

---

## ❓ 문제 해결

### 인증서 설치 실패
- **원인**: Base64 디코딩 실패 또는 잘못된 암호
- **해결**: Base64 문자열과 암호를 다시 확인

### 빌드 서명 실패
- **원인**: 인증서 이름 불일치
- **해결**: `security find-identity -v -p codesigning` 출력과 정확히 일치하는지 확인

### 업로드 실패
- **원인**: 잘못된 Apple ID 정보 또는 네트워크 문제
- **해결**: App-Specific Password 재생성 또는 재시도

### 프로비저닝 프로파일 오류
- **원인**: 만료되었거나 Bundle ID 불일치
- **해결**: Apple Developer 포털에서 새 프로파일 생성

---

## 📚 추가 자료

- [Apple Developer - App Store Connect](https://developer.apple.com/app-store-connect/)
- [Electron - Mac App Store Submission Guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)
- [GitHub - Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
