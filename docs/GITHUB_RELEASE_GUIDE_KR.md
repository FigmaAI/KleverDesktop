# GitHub 릴리즈 배포 가이드

이 가이드는 Developer ID 서명(macOS)과 코드 서명(Windows)을 사용하여 GitHub 릴리즈를 통해 Klever Desktop을 빌드하고 배포하는 방법을 다룹니다.

## 개요

우리는 App Store 배포(Mac App Store와 Microsoft Store)에서 더 유연한 GitHub 릴리즈 전략으로 전환했습니다. 이를 통해 다음과 같은 이점을 얻을 수 있습니다:

- ✅ 더 빠른 릴리즈 주기 (스토어 심사 과정 없음)
- ✅ 사용자에게 직접 배포
- ✅ Squirrel(Windows) 및 내장 업데이터를 통한 자동 업데이트
- ✅ macOS용 Developer ID 서명 (샌드박스 제약 없음)
- ✅ Windows용 선택적 코드 서명

## 목차

1. [사전 요구사항](#사전-요구사항)
2. [macOS 배포](#macos-배포)
3. [Windows 배포](#windows-배포)
4. [Linux 배포](#linux-배포)
5. [빌드 및 배포](#빌드-및-배포)
6. [문제 해결](#문제-해결)

---

## 사전 요구사항

### 필수 도구

- **Node.js** 18+ 및 npm
- **Git** 및 GitHub 계정 접근 권한
- **Electron Forge** 7.10.2+ (이미 구성됨)
- **direnv** (선택사항, 환경 변수 관리용)

### 플랫폼별 요구사항

**macOS:**
- Apple Developer 계정 (연 $99)
- Developer ID Application 인증서
- Developer ID Installer 인증서 (선택사항, PKG용)
- Xcode Command Line Tools

**Windows:**
- 코드 서명 인증서 (선택사항이지만 권장)
  - 옵션: DigiCert, Sectigo, Certum Open Source Code Signing
  - 또는 GitHub의 Sigstore 사용 (무료, 실험적)

**Linux:**
- 특별한 요구사항 없음 (서명되지 않은 배포)

---

## macOS 배포

### 1. Developer ID 인증서 받기

**방법 A: Xcode 사용 (권장)**

1. Xcode → Preferences → Accounts 열기
2. Apple Developer 계정 추가
3. "Manage Certificates" 클릭
4. "+" 클릭 → "Developer ID Application" 선택
5. Xcode가 자동으로 인증서를 생성하고 설치합니다

**방법 B: Apple Developer Portal 사용**

1. https://developer.apple.com/account/resources/certificates/list 방문
2. "Developer ID Application" 인증서 생성
3. 다운로드하여 Keychain Access에 설치

**인증서 설치 확인:**

```bash
security find-identity -v -p codesigning
```

다음과 같이 표시되어야 합니다:
```
1) ABCDEF1234567890 "Developer ID Application: Your Name (TEAM_ID)"
```

### 2. 공증(Notarization) 설정

Apple은 App Store 외부에서 배포되는 앱에 대해 공증을 요구합니다.

**앱별 비밀번호 생성:**

1. https://appleid.apple.com/account/manage 방문
2. Apple ID로 로그인
3. "보안" → "앱 전용 암호" → 생성
4. 비밀번호 저장 (한 번만 표시됨)

**환경 변수 설정:**

`~/.zshrc`에 설정하거나, 프로젝트 루트에 `.envrc` 파일을 생성하여 관리할 수 있습니다 (권장).

**방법 A: .envrc 사용 (권장)**

1. `direnv` 설치 (macOS: `brew install direnv`)
2. 프로젝트 루트에 `.envrc` 파일 생성:
   ```bash
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # 앱별 비밀번호
   export APPLE_TEAM_ID="ABCDEF1234"  # 10자리 Team ID
   export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx" # 릴리즈 업로드용
   ```
3. `direnv allow` 실행하여 환경 변수 로드

**방법 B: 쉘 설정 파일 사용**

`~/.zshrc` 또는 `~/.bash_profile`에 다음을 추가:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # 앱별 비밀번호
export APPLE_TEAM_ID="ABCDEF1234"  # 10자리 Team ID
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

쉘 재로드:
```bash
source ~/.zshrc  # 또는 source ~/.bash_profile
```

**구성 확인:**

```bash
echo $APPLE_ID
echo $APPLE_ID_PASSWORD
echo $APPLE_TEAM_ID
```

### 3. macOS 패키지 빌드

빌드 프로세스는 자동으로 다음을 수행합니다:
1. Developer ID로 앱 서명
2. DMG 설치 파일 생성
3. Apple에 DMG 공증 요청
4. 공증 티켓 스테이플링

```bash
# 빌드 및 패키징
npm run make -- --platform=darwin

# 출력 파일 위치:
# out/make/dmg/darwin/arm64/Klever Desktop-2.0.0-arm64.dmg
# out/make/zip/darwin/arm64/klever-desktop-darwin-arm64-2.0.0.zip
```

**공증 프로세스:**

환경 변수가 설정되어 있으면 공증이 자동으로 수행됩니다. 프로세스는 2-10분 소요됩니다:

```
✔ Notarizing Klever Desktop-2.0.0-arm64.dmg
  - Uploading to Apple...
  - Waiting for notarization (this may take a few minutes)...
  - Notarization successful!
  - Stapling ticket to DMG...
```

**공증 확인:**

```bash
spctl -a -vv -t install "out/make/dmg/darwin/arm64/Klever Desktop-2.0.0-arm64.dmg"

# 다음과 같이 출력되어야 함:
# accepted
# source=Notarized Developer ID
```

### 4. macOS 서명 문제 해결

**문제: "Developer ID Application: not found"**

해결: Keychain Access에 인증서를 먼저 설치하세요.

**문제: "Invalid credentials"로 공증 실패**

해결:
- 환경 변수가 올바르게 설정되었는지 확인
- Apple ID 비밀번호가 아닌 앱별 비밀번호를 사용하는지 확인
- Team ID가 올바른지 확인 (10자)

**문제: "Could not find notarization credentials"**

해결: 세 가지 환경 변수가 모두 현재 쉘 세션에서 내보내졌는지 확인하세요.

**문제: 서명 후 앱이 실행 시 크래시**

해결: `build/entitlements.mac.plist`의 권한을 확인하세요. 다음을 확인:
- `com.apple.security.cs.allow-jit` 활성화됨 (Electron에 필요)
- `com.apple.security.cs.allow-unsigned-executable-memory` 활성화됨
- Developer ID 배포를 위해 샌드박스가 활성화되지 않음

---

## Windows 배포

### 1. 코드 서명 인증서 받기 (선택사항)

**무료 옵션: Certum Open Source Code Signing**

Certum은 오픈소스 프로젝트에 무료 코드 서명을 제공합니다:
1. https://www.certum.eu/en/cert_offer_code_signing_open_source/ 에서 신청
2. GitHub 저장소 링크 및 프로젝트 세부정보 제공
3. 1-2주 내에 인증서 수령

**유료 옵션:**
- DigiCert ($474/년)
- Sectigo ($199/년)
- SignPath (무료 티어 사용 가능)

**코드 서명 없이:**

서명되지 않은 Windows 앱을 배포할 수 있지만, 사용자에게 다음이 표시됩니다:
- "Windows에서 PC를 보호했습니다" SmartScreen 경고
- 설치 프로그램에서 "알 수 없는 게시자"

충분한 사용자가 앱을 다운로드하고 실행한 후 Windows SmartScreen이 평판을 구축하면 경고가 감소합니다.

### 2. 코드 서명 구성 (선택사항)

인증서가 있는 경우 환경 변수 설정:

```bash
# Windows (PowerShell)
$env:WINDOWS_CERT_FILE = "C:\path\to\certificate.pfx"
$env:WINDOWS_CERT_PASSWORD = "certificate-password"

# macOS/Linux (크로스 컴파일 시)
export WINDOWS_CERT_FILE="/path/to/certificate.pfx"
export WINDOWS_CERT_PASSWORD="certificate-password"
```

`forge.config.js`에서 인증서 라인 주석 해제:

```javascript
{
  name: '@electron-forge/maker-squirrel',
  config: {
    // ... 기타 구성
    certificateFile: process.env.WINDOWS_CERT_FILE,
    certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
  },
}
```

### 3. Windows 패키지 빌드

```bash
# Windows에서 빌드
npm run make -- --platform=win32

# 또는 macOS/Linux에서 크로스 컴파일 (Wine 필요)
npm run make -- --platform=win32 --arch=x64
```

출력 파일:
```
out/make/squirrel.windows/x64/
├── klever-desktop-2.0.0 Setup.exe     # 설치 프로그램 (사용자에게 배포)
├── RELEASES                           # 업데이트 메타데이터
└── klever-desktop-2.0.0-full.nupkg   # 전체 패키지 (자동 업데이트용)
```

**중요:** 사용자에게 `Setup.exe` 파일을 배포하세요. 자동 업데이트 기능을 위해 `RELEASES` 및 `.nupkg` 파일을 보관하세요.

### 4. Windows 빌드 문제 해결

**문제: 크로스 컴파일 시 "Wine not found"**

해결: macOS/Linux에 Wine 설치:
```bash
# macOS
brew install --cask wine-stable

# Ubuntu/Debian
sudo apt install wine64
```

**문제: Windows에서 빌드가 느림**

해결: 다음 항목에 대한 Windows Defender 제외 추가:
- `node_modules/`
- `out/`
- 프로젝트 디렉토리

**문제: 사용자에게 SmartScreen 경고**

해결:
- 코드 서명 인증서 받기
- 또는 SmartScreen 평판이 구축될 때까지 기다리기 (많은 다운로드 필요)
- 사용자에게 새 앱의 경우 정상적인 현상임을 알림

---

## Linux 배포

### Linux 패키지 빌드

```bash
# ZIP 아카이브 빌드 (휴대용)
npm run make -- --platform=linux

# 출력:
# out/make/zip/linux/x64/klever-desktop-linux-x64-2.0.0.zip
```

**선택사항: AppImage/DEB/RPM 생성**

Linux 전용 패키지를 만들려면 `forge.config.js`에 maker 추가:

```javascript
// makers 배열에 추가
{
  name: '@electron-forge/maker-deb',
  config: {
    options: {
      maintainer: 'Klever Team',
      homepage: 'https://github.com/FigmaAI/KleverDesktop'
    }
  },
  platforms: ['linux']
},
{
  name: '@electron-forge/maker-rpm',
  config: {
    options: {
      homepage: 'https://github.com/FigmaAI/KleverDesktop'
    }
  },
  platforms: ['linux']
}
```

Maker 설치:
```bash
npm install --save-dev @electron-forge/maker-deb @electron-forge/maker-rpm
```

---

## 빌드 및 배포

### 1. 모든 플랫폼 빌드

**macOS에서 (멀티 플랫폼 빌드 권장):**

```bash
# macOS DMG + ZIP
npm run make -- --platform=darwin --arch=arm64,x64

# Windows Setup (Wine 필요)
npm run make -- --platform=win32 --arch=x64

# Linux ZIP
npm run make -- --platform=linux --arch=x64
```

**Windows에서:**

```bash
# Windows만
npm run make -- --platform=win32 --arch=x64
```

**Linux에서:**

```bash
# Linux만
npm run make -- --platform=linux --arch=x64
```

### 2. 로컬에서 배포 (Manual Publish)

로컬 머신에서 직접 GitHub 릴리즈를 생성하고 아티팩트를 업로드하는 방법입니다.

**사전 요구사항:**

1. GitHub Personal Access Token 생성 (권한: `repo`)
2. 환경 변수 설정 (위의 `.envrc` 설정 참조):
   - `GITHUB_TOKEN`이 환경 변수로 설정되어 있어야 합니다.

**배포 명령:**

```bash
# 한 번에 빌드 및 배포
npm run publish

# 또는 빌드 후 수동으로 릴리즈 생성
npm run make
# 그런 다음 out/make/의 파일을 GitHub 릴리즈에 수동으로 업로드
```

`publish` 명령은 다음을 수행합니다:
1. 현재 플랫폼용 패키지 빌드
2. GitHub에 드래프트 릴리즈 생성
3. 모든 아티팩트 업로드
4. 릴리즈를 프리릴리즈로 표시 (기본값)

**릴리즈 편집:**

1. https://github.com/FigmaAI/KleverDesktop/releases 방문
2. 드래프트 릴리즈 찾기
3. 릴리즈 노트 편집 및 "Publish release" 클릭

### 3. CI/CD 자동 배포 (GitHub Actions)

GitHub Actions를 통해 태그 푸시 시 자동으로 빌드하고 배포할 수 있습니다. 이를 위해 GitHub 저장소에 Secrets를 설정해야 합니다.

**Secrets 설정:**

1. 저장소 설정(Settings) > Secrets and variables > Actions 로 이동
2. "New repository secret" 클릭하여 다음 변수들을 추가:

| Secret 이름 | 설명 | 상태/비고 |
|---|---|---|
| `APPLE_ID` | Apple Developer 계정 이메일 | ✅ 기존 `build-mas.yml`에 존재 |
| `APPLE_ID_PASSWORD` | 앱별 비밀번호 | ✅ 기존 `APPLE_APP_SPECIFIC_PASSWORD` 사용 가능 (이름 매핑 필요) |
| `APPLE_TEAM_ID` | 10자리 Team ID | ✅ 기존 `build-mas.yml`에 존재 |
| `GITHUB_TOKEN` | GitHub Token | ✅ GitHub Actions 자동 생성 |
| `CERTIFICATE_P12_BASE64` | **Developer ID Application** 인증서 (.p12)의 Base64 값 | ⚠️ 확인 필요: 기존 값은 MAS용(Apple Distribution)일 수 있음. GitHub 배포용은 **Developer ID**여야 함. |
| `CERTIFICATE_PASSWORD` | 인증서 비밀번호 | ✅ 기존 `CERTIFICATE_PASSWORD` 사용 가능 |
| `WINDOWS_CERT_FILE` | (Windows) PFX 인증서 Base64 | ❌ 신규 필요 (Windows 배포 시) |
| `WINDOWS_CERT_PASSWORD` | (Windows) 인증서 비밀번호 | ❌ 신규 필요 (Windows 배포 시) |

> **중요: 인증서 종류 확인**
> 기존 `build-mas.yml`에서 사용하던 `CERTIFICATE_P12_BASE64`가 **"Apple Distribution"** (App Store용) 인증서라면, GitHub 릴리즈용으로는 사용할 수 없습니다.
> **"Developer ID Application"** 인증서를 새로 내보내기 하여 Base64로 인코딩한 후 Secrets를 업데이트하거나, `DEVELOPER_ID_CERTIFICATE_P12_BASE64` 같은 새 이름으로 등록해야 합니다.

**Base64 인코딩 방법:**

```bash
# macOS
base64 -i certificate.p12 | pbcopy
```

> **참고**: `.github/workflows/build.yml` 워크플로우가 이 Secret들을 사용하여 빌드 및 서명을 수행합니다.

### 4. 릴리즈 체크리스트



배포 전:

- [ ] `package.json`에서 버전 업데이트
- [ ] `CHANGELOG.md` 업데이트
- [ ] 각 플랫폼에서 로컬 빌드 테스트
- [ ] 코드 서명 확인 (macOS: 공증, Windows: 인증서)
- [ ] 새 머신에서 설치 테스트
- [ ] 자동 업데이트 작동 확인 (첫 릴리즈 이후)
- [ ] 필요시 문서 업데이트
- [ ] git 태그 생성: `git tag v2.0.0 && git push --tags`

### 5. 자동 업데이트 구성

**Windows (Squirrel):**

자동 업데이트가 내장되어 있습니다. 사용자에게 자동으로 업데이트 알림이 표시됩니다.

**macOS (electron-updater):**

자동 업데이트를 활성화하려면 `electron-updater` 추가 (향후 개선 사항):

```bash
npm install electron-updater
```

메인 프로세스에서 구성:
```javascript
const { autoUpdater } = require('electron-updater');

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'FigmaAI',
  repo: 'KleverDesktop'
});

autoUpdater.checkForUpdatesAndNotify();
```

---

## 문제 해결

### 빌드 실패

**오류: "Cannot find module '@electron-forge/maker-dmg'"**

해결:
```bash
npm install --save-dev @electron-forge/maker-dmg @electron-forge/maker-squirrel @electron-forge/publisher-github
```

**오류: "Python not found"**

해결: Python 번들링 스크립트 실행:
```bash
npm run python:build
```

### 서명 문제

**macOS: "The application cannot be opened"**

해결:
- 인증서가 유효한지 확인: `security find-identity -v -p codesigning`
- 권한 파일 존재 확인: `build/entitlements.mac.plist`
- 공증이 성공적으로 완료되었는지 확인

**Windows: "This app might harm your device"**

해결:
- 서명되지 않은 앱의 경우 정상
- 코드 서명 인증서 받기
- 또는 사용자에게 "자세한 정보" → "실행" 클릭 안내

### 배포 문제

**오류: 배포 시 "Not found (404)"**

해결:
- `forge.config.js`에서 저장소 이름 및 소유자 확인
- GITHUB_TOKEN에 `repo` 범위가 있는지 확인
- 저장소가 존재하고 쓰기 권한이 있는지 확인

**오류: "Release already exists"**

해결:
- GitHub에서 드래프트 릴리즈 삭제
- 또는 `package.json`에서 버전 증가

---

## 다음 단계

1. **CI/CD 설정**: GitHub Actions로 빌드 자동화
2. **자동 업데이트 구성**: 원활한 업데이트를 위한 electron-updater 구현
3. **다운로드 모니터링**: GitHub API를 통한 릴리즈 다운로드 추적
4. **피드백 수집**: 분석 또는 피드백 메커니즘 추가

---

## 추가 리소스

- [Electron Forge 문서](https://www.electronforge.io/)
- [macOS 코드 서명 가이드](https://developer.apple.com/support/code-signing/)
- [Windows 코드 서명 모범 사례](https://docs.microsoft.com/en-us/windows/apps/desktop/modernize/windows-app-sdk-security-and-identity)
- [GitHub 릴리즈 API](https://docs.github.com/en/rest/releases)

---

**마지막 업데이트**: 2025-11-23
**버전**: 2.0.0
