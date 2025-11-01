# Microsoft Partner Center 설정 가이드
## 개인 Microsoft 계정용 Store Submission API 설정

이 가이드는 개인 Microsoft 계정으로 파트너센터를 사용하는 경우, Store Submission API를 사용하기 위한 Azure AD 설정 방법을 설명합니다.

## 목차
1. [현재 상태 확인](#현재-상태-확인)
2. [Azure Portal에서 앱 등록](#azure-portal에서-앱-등록)
3. [파트너센터에서 Azure AD 앱 연결](#파트너센터에서-azure-ad-앱-연결)
4. [환경 변수 설정](#환경-변수-설정)
5. [테스트 및 검증](#테스트-및-검증)

---

## 현재 상태 확인

### 1. 파트너센터 계정 타입 확인
1. [Partner Center](https://partner.microsoft.com/dashboard)에 로그인
2. 계정 설정 확인:
   - **개인 계정**: Microsoft 계정(@outlook.com, @hotmail.com 등)으로 로그인
   - **조직 계정**: 회사 이메일로 로그인

### 2. Azure Portal 접근 가능 여부 확인
1. [Azure Portal](https://portal.azure.com)에 개인 Microsoft 계정으로 로그인
2. 왼쪽 메뉴에서 "Microsoft Entra ID" (이전 Azure Active Directory) 확인

**참고**: 개인 Microsoft 계정도 Azure Portal에 접근할 수 있으며, 자동으로 기본 디렉토리가 생성됩니다.

---

## Azure Portal에서 앱 등록

### 1단계: Azure Portal 로그인
1. [Azure Portal](https://portal.azure.com)에 접속
2. 개인 Microsoft 계정으로 로그인

### 2단계: Microsoft Entra ID로 이동
1. 왼쪽 상단 "리소스 만들기" 클릭
2. 검색창에 "Microsoft Entra ID" 또는 "Azure Active Directory" 입력
3. **이미 활성화되어 있을 가능성이 높습니다** - 확인만 하면 됩니다

### 3단계: 테넌트 ID 확인
1. Azure Portal에서 "Microsoft Entra ID" (또는 "Azure Active Directory") 선택
2. **개요(Overview)** 페이지로 이동
3. **테넌트 ID** (Tenant ID) 복사
   - 형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (GUID)
   - 이 값이 `.env` 파일의 `MS_STORE_TENANT_ID`가 됩니다

**중요**: 개인 계정의 경우 "기본 디렉토리" 또는 "개인 Microsoft 계정" 디렉토리를 사용합니다.

### 4단계: 앱 등록
1. 왼쪽 메뉴에서 **"앱 등록"** (App registrations) 클릭
2. **"+ 새 등록"** (New registration) 클릭

#### 앱 등록 정보 입력:
- **이름**: `Klever Desktop Store Submission` (또는 원하는 이름)
- **지원되는 계정 유형**: 
  - **개인 Microsoft 계정만**: "개인 Microsoft 계정만" 선택 (권장)
  - 또는 "모든 Microsoft 계정" 선택
- **리디렉션 URI**: **설정 불필요** (Server credentials flow 사용)

3. **등록** 클릭

### 5단계: Application (Client) ID 복사
1. 앱 등록 페이지에서 **개요(Overview)** 섹션 확인
2. **애플리케이션(클라이언트) ID** (Application (client) ID) 복사
   - 형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (GUID)
   - 이 값이 `.env` 파일의 `MS_STORE_CLIENT_ID`가 됩니다

### 6단계: 클라이언트 시크릿 생성
1. 왼쪽 메뉴에서 **"인증서 및 암호"** (Certificates & secrets) 클릭
2. **"+ 새 클라이언트 암호"** (New client secret) 클릭
3. 정보 입력:
   - **설명**: `Store Submission API Secret`
   - **만료**: 24개월 (또는 원하는 기간)
4. **추가** 클릭
5. **중요**: 시크릿 값(Secret Value)을 즉시 복사하여 안전한 곳에 저장
   - 이 값은 다시 볼 수 없습니다!
   - 형식: `xxxx~xxxxxxxxxxxxxxxxxxxxxxxxx`
   - 이 값이 `.env` 파일의 `MS_STORE_CLIENT_SECRET`가 됩니다

### 7단계: API 권한 확인 (선택사항)
현재 Store Submission API는 별도의 API 권한 설정이 필요하지 않을 수 있습니다.
- 왼쪽 메뉴에서 **"API 권한"** (API permissions) 확인
- 필요시 Microsoft Store 관련 권한이 있는지 확인

---

## 파트너센터에서 Azure AD 앱 연결

### 1단계: 파트너센터 로그인
1. [Partner Center](https://partner.microsoft.com/dashboard)에 로그인
2. 대시보드로 이동

### 2단계: Azure AD 앱 추가
1. 오른쪽 상단 **계정 아이콘** 클릭
2. **"계정 설정"** (Account settings) 선택
3. 왼쪽 메뉴에서 **"사용자"** (Users) 선택
4. 또는 직접 URL: https://partner.microsoft.com/dashboard/account/usermanagement

### 3단계: Azure AD 앱 등록
1. **"Azure AD 애플리케이션"** (Azure AD applications) 탭 클릭
2. **"+ 새 애플리케이션 추가"** 또는 **"애플리케이션 추가"** 클릭
3. **"Azure AD 애플리케이션 ID"** 입력:
   - 위에서 복사한 **클라이언트 ID** (Client ID) 입력
   - 형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 4단계: 역할 부여
1. 추가된 애플리케이션 옆에 **역할 할당** 영역 표시
2. **"Manager"** 역할 선택 (또는 필요한 역할)
   - Manager 역할은 Store Submission API에 필요한 권한을 제공합니다
3. **"저장"** 또는 **"추가"** 클릭

**참고**: 역할 부여가 성공하면 해당 애플리케이션이 파트너센터 계정에 연결됩니다.

---

## 환경 변수 설정

### 1단계: Application ID 확인
1. [Partner Center](https://partner.microsoft.com/dashboard)에서 앱 선택
2. **개요(Overview)** 페이지로 이동
3. **"Identity"** 섹션에서 **Application ID** 확인
   - 형식: `9WZDNCRDXXXX` (알파벳과 숫자 조합)
   - 이 값이 `.env` 파일의 `MS_STORE_APPLICATION_ID`가 됩니다

### 2단계: .env 파일 업데이트
프로젝트 루트의 `.env` 파일에 다음 내용 추가:

```env
# Microsoft Store Submission API
# Azure AD 테넌트 ID (Azure Portal > Microsoft Entra ID > 개요에서 확인)
MS_STORE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Azure AD 앱 클라이언트 ID (Azure Portal > 앱 등록 > 개요에서 확인)
MS_STORE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Azure AD 클라이언트 시크릿 (Azure Portal > 앱 등록 > 인증서 및 암호에서 생성)
MS_STORE_CLIENT_SECRET=xxxx~xxxxxxxxxxxxxxxxxxxxxxxxx

# 파트너센터 Application ID (Partner Center > 앱 > 개요 > Identity에서 확인)
MS_STORE_APPLICATION_ID=9WZDNCRDXXXX

# 자동 커밋 여부 (선택사항, 기본값: false)
MS_STORE_AUTO_COMMIT=false
```

### 3단계: 환경 변수 검증
PowerShell에서 다음 명령 실행:

```powershell
# .env 파일 로드
. .\scripts\Load-DotEnv.ps1
Load-DotEnv

# Store Submission 환경 변수 테스트
Test-DotEnvVariables -StoreSubmission
```

모든 변수가 올바르게 설정되었다면:
```
✅ All required Store Submission variables are set!
```

---

## 테스트 및 검증

### 1단계: 수동 토큰 테스트 (선택사항)
PowerShell에서 다음 스크립트로 토큰 획득 테스트:

```powershell
. .\scripts\submit-to-store.ps1

$token = Get-MSAccessToken `
    -TenantId $env:MS_STORE_TENANT_ID `
    -ClientId $env:MS_STORE_CLIENT_ID `
    -ClientSecret $env:MS_STORE_CLIENT_SECRET

if ($token) {
    Write-Host "✅ 토큰 획득 성공!" -ForegroundColor Green
} else {
    Write-Host "❌ 토큰 획득 실패" -ForegroundColor Red
}
```

### 2단계: 전체 빌드 및 제출 테스트
```powershell
# 빌드만 (제출 없이)
.\scripts\build-windows-store.ps1

# 빌드 + Store 제출 (커밋 안 함)
.\scripts\build-windows-store.ps1 -UploadToStore

# 빌드 + Store 제출 + 자동 커밋
.\scripts\build-windows-store.ps1 -UploadToStore -AutoCommit
```

---

## 문제 해결

### 문제 1: "AADSTS700016: Application not found in the directory"
**원인**: 클라이언트 ID가 잘못되었거나 다른 테넌트에 등록된 앱입니다.

**해결**:
1. Azure Portal에서 앱 등록의 클라이언트 ID 다시 확인
2. `.env` 파일의 `MS_STORE_CLIENT_ID` 값 확인

### 문제 2: "AADSTS7000215: Invalid client secret"
**원인**: 클라이언트 시크릿이 만료되었거나 잘못되었습니다.

**해결**:
1. Azure Portal > 앱 등록 > 인증서 및 암호에서 새 시크릿 생성
2. `.env` 파일의 `MS_STORE_CLIENT_SECRET` 업데이트

### 문제 3: "403 Forbidden" 또는 "Unauthorized" 오류
**원인**: 파트너센터에서 Azure AD 앱에 역할이 부여되지 않았습니다.

**해결**:
1. Partner Center > 계정 설정 > 사용자 > Azure AD 애플리케이션 확인
2. 앱에 "Manager" 역할이 할당되어 있는지 확인
3. 역할 재할당 후 잠시 대기 (권한 전파 시간 필요)

### 문제 4: "Application not found" (파트너센터)
**원인**: Application ID가 잘못되었습니다.

**해결**:
1. Partner Center > 앱 > 개요 > Identity에서 Application ID 다시 확인
2. 형식 확인: `9WZDNCRDXXXX` (알파벳과 숫자)
3. `.env` 파일의 `MS_STORE_APPLICATION_ID` 값 확인

### 문제 5: 개인 계정에서 테넌트 ID를 찾을 수 없음
**해결**:
1. Azure Portal > Microsoft Entra ID > 개요에서 확인
2. 개인 계정의 경우 "기본 디렉토리" 사용
3. 또는 "common" 사용 시도: `MS_STORE_TENANT_ID=common`

---

## 추가 참고 사항

### 개인 계정 vs 조직 계정
- **개인 Microsoft 계정**: Azure Portal 접근 가능, 기본 디렉토리 자동 생성
- **조직 계정**: 회사 Azure AD 사용, 관리자 권한 필요할 수 있음

### 보안 권장사항
1. 클라이언트 시크릿은 절대 공개 저장소에 커밋하지 마세요
2. `.env` 파일은 `.gitignore`에 포함되어 있는지 확인
3. 클라이언트 시크릿은 정기적으로 갱신하는 것을 권장

### API 제한 사항
- Access Token은 60분간 유효
- 하루 API 호출 제한이 있을 수 있음
- 제출 생성 후 커밋까지의 시간은 Microsoft의 검증 프로세스에 따라 다름

---

## 다음 단계

환경 변수가 모두 설정되면:
1. `Test-DotEnvVariables -StoreSubmission`로 검증
2. `.\scripts\build-windows-store.ps1 -UploadToStore` 실행
3. Partner Center에서 제출 상태 확인

자세한 정보는 [Microsoft Store Submission API 문서](https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api)를 참고하세요.
