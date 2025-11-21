# 🚀 빠른 시작 체크리스트

GitHub Actions 자동 빌드 파이프라인 설정을 위한 단계별 체크리스트입니다.

---

## ✅ 사전 준비 (로컬)

### 1. 인증서 내보내기

- [ ] **Keychain Access** 실행
- [ ] **"Apple Distribution: Your Name (TEAM_ID)"** 인증서 찾기
- [ ] 인증서 + 개인 키 선택 → 우클릭 → **"Export 2 items..."**
- [ ] 파일명: `certificate.p12`, 암호 설정 (나중에 `CERTIFICATE_PASSWORD`로 사용)
- [ ] 저장 위치 기억 (예: `~/Desktop/certificate.p12`)

- [ ] **"3rd Party Mac Developer Installer: Your Name (TEAM_ID)"** 인증서 찾기
- [ ] 인증서 + 개인 키 선택 → 우클릭 → **"Export 2 items..."**
- [ ] 파일명: `installer.p12`, 암호 설정 (나중에 `INSTALLER_CERTIFICATE_PASSWORD`로 사용)
- [ ] 저장 위치 기억 (예: `~/Desktop/installer.p12`)

---

### 2. 프로비저닝 프로파일 다운로드

- [ ] https://developer.apple.com/account/resources/profiles/list 방문
- [ ] Mac App Store용 프로파일 찾기
- [ ] 다운로드 → 저장 위치 기억 (예: `~/Desktop/embedded.provisionprofile`)

또는 로컬에 있는 경우:
```bash
ls ~/Library/MobileDevice/Provisioning\ Profiles/
```

---

### 3. Base64 인코딩

#### 방법 A: 스크립트 사용 (권장)

```bash
cd /path/to/KleverDesktop
./scripts/encode-secrets.sh ~/Desktop/certificate.p12 ~/Desktop/installer.p12 ~/Desktop/embedded.provisionprofile
```

- [ ] 스크립트 실행
- [ ] 출력된 Base64 문자열 복사 준비

#### 방법 B: 수동 인코딩

```bash
# Apple Distribution 인증서
base64 -i ~/Desktop/certificate.p12 | pbcopy

# Installer 인증서
base64 -i ~/Desktop/installer.p12 | pbcopy

# 프로비저닝 프로파일
base64 -i ~/Desktop/embedded.provisionprofile | pbcopy
```

- [ ] 각 파일 인코딩 후 Base64 문자열 저장

---

### 4. Apple 정보 수집

#### Apple ID
- [ ] Apple ID 이메일 주소 확인 (예: `your@email.com`)

#### App-Specific Password
- [ ] https://appleid.apple.com/account/manage 방문
- [ ] "Sign-In and Security" → "App-Specific Passwords"
- [ ] "Generate Password" 클릭
- [ ] 이름 입력: "GitHub Actions"
- [ ] 생성된 암호 복사 (형식: `xxxx-xxxx-xxxx-xxxx`)

#### Team ID
- [ ] https://developer.apple.com/account/#!/membership 방문
- [ ] "Team ID" 확인 (예: `ZQC7QNZ4J8`)

---

### 5. 인증서 이름 확인

```bash
security find-identity -v -p codesigning
```

출력에서:
- [ ] **CSC_NAME** 복사 (예: `Apple Distribution: Your Name (TEAM_ID)`)
- [ ] **CSC_INSTALLER_NAME** 복사 (예: `3rd Party Mac Developer Installer: Your Name (TEAM_ID)`)

---

## ✅ GitHub 설정

### 6. GitHub Secrets 추가

**Repository** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

각 Secret 추가:

#### Apple 계정 정보
- [ ] `APPLE_ID` = `your@email.com`
- [ ] `APPLE_APP_SPECIFIC_PASSWORD` = `xxxx-xxxx-xxxx-xxxx`
- [ ] `APPLE_TEAM_ID` = `ZQC7QNZ4J8`

#### 인증서 정보
- [ ] `CSC_NAME` = `Apple Distribution: Your Name (TEAM_ID)`
- [ ] `CSC_INSTALLER_NAME` = `3rd Party Mac Developer Installer: Your Name (TEAM_ID)`

#### 인증서 파일 (Base64)
- [ ] `CERTIFICATE_P12_BASE64` = (Step 3에서 복사한 Base64 문자열)
- [ ] `CERTIFICATE_PASSWORD` = (Step 1에서 설정한 certificate.p12 비밀번호)
- [ ] `INSTALLER_CERTIFICATE_P12_BASE64` = (Step 3에서 복사한 Base64 문자열)
- [ ] `INSTALLER_CERTIFICATE_PASSWORD` = (Step 1에서 설정한 installer.p12 비밀번호)

#### 프로비저닝 프로파일
- [ ] `PROVISIONING_PROFILE_BASE64` = (Step 3에서 복사한 Base64 문자열)

---

### 7. Secrets 확인

- [ ] 총 **10개** Secrets가 추가되었는지 확인
- [ ] 각 Secret 이름 오타 없는지 확인 (대소문자 구분!)

---

## ✅ 로컬 정리

### 8. 민감한 파일 삭제

```bash
# 인증서 및 프로파일 삭제
rm ~/Desktop/certificate.p12
rm ~/Desktop/installer.p12
rm ~/Desktop/embedded.provisionprofile
```

- [ ] 인증서 파일 삭제 확인
- [ ] 프로비저닝 프로파일 삭제 확인
- [ ] 휴지통 비우기

---

## ✅ 테스트 실행

### 9. 수동 워크플로우 실행

- [ ] **GitHub Repository** 이동
- [ ] **Actions** 탭 클릭
- [ ] **"Build & Upload Mac App Store"** 워크플로우 선택
- [ ] **"Run workflow"** 드롭다운 클릭
- [ ] 브랜치 선택: `main`
- [ ] **"Run workflow"** 버튼 클릭

---

### 10. 빌드 상태 모니터링

- [ ] 워크플로우 실행 클릭하여 로그 확인
- [ ] **"Install Apple certificates"** 단계 성공 확인
- [ ] **"Build MAS Universal"** 단계 성공 확인
- [ ] **"Upload to App Store Connect"** 단계 성공 확인

---

### 11. App Store Connect 확인

- [ ] https://appstoreconnect.apple.com 방문
- [ ] 앱 선택 → **Activity** 탭
- [ ] Processing 상태 확인 (5-30분 대기)
- [ ] 빌드 처리 완료 확인

---

## ✅ 자동화 설정 (선택사항)

### 12. 버전/빌드 번호 변경으로 자동 트리거 테스트

#### package.json 수정
```json
{
  "version": "2.0.1"  // 버전 증가
}
```

#### forge.config.js 수정
```javascript
buildVersion: '14',  // 빌드 번호 증가
```

#### Commit & Push
```bash
git add package.json forge.config.js
git commit -m "chore: bump version to 2.0.1 (build 14)"
git push origin main
```

- [ ] 변경사항 커밋 및 푸시
- [ ] GitHub Actions 자동 실행 확인
- [ ] 빌드 성공 확인

---

## 🎉 완료!

모든 체크박스를 완료했다면 자동 빌드 파이프라인이 정상 작동하는 것입니다!

---

## 📚 추가 자료

- [상세 설정 가이드](./GITHUB_SECRETS_SETUP.md)
- [사용 가이드](./ACTIONS_README.md)
- [문제 해결](../MAS_BUILD_TROUBLESHOOTING.md)

---

## 🔍 문제 발생 시

### 인증서 설치 실패
→ [문제 해결: 인증서 설치](./ACTIONS_README.md#🔴-인증서-설치-실패)

### 빌드 서명 실패
→ [문제 해결: 빌드 서명](./ACTIONS_README.md#🔴-빌드-서명-실패)

### 업로드 실패
→ [문제 해결: 업로드](./ACTIONS_README.md#🔴-업로드-실패)

---

## ⏱️ 예상 소요 시간

- **초기 설정**: 30-60분
- **테스트 실행**: 15-25분 (빌드 + 업로드)
- **총 소요 시간**: 약 1-1.5시간

---

**마지막 업데이트**: 2024-11-21
