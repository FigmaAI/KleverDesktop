# Microsoft Store Submission API 이해하기
## 개인 Microsoft 계정을 위한 완전 가이드

이 문서는 개인 Microsoft 계정으로 Microsoft Store에 앱을 배포할 때, Submission API를 사용하기 위해 Azure AD 앱 등록이 왜 필요한지, 그리고 전체 구조가 어떻게 작동하는지 설명합니다.

---

## 목차
1. [현재 상황](#현재-상황)
2. [왜 Azure AD 앱 등록이 필요한가?](#왜-azure-ad-앱-등록이-필요한가)
3. [전체 구조 이해하기](#전체-구조-이해하기)
4. [인증 흐름](#인증-흐름)
5. [단계별 프로세스](#단계별-프로세스)
6. [비유로 이해하기](#비유로-이해하기)
7. [실제 사용 예시](#실제-사용-예시)

---

## 현재 상황

### 수동 업로드 방식
- ✅ 개인 Microsoft 계정 (dusskapark@hotmail.com)으로 Partner Center 사용
- ✅ 브라우저를 통해 수동으로 앱 패키지(MSI) 업로드
- ❌ 반복적이고 시간 소모적인 작업

### 자동화 목표
- 🎯 빌드 스크립트에서 자동으로 Store에 제출
- 🎯 CI/CD 파이프라인 구축
- 🎯 **Microsoft Store Submission API** 사용

---

## 왜 Azure AD 앱 등록이 필요한가?

### 질문
> "나는 이미 개인 Microsoft 계정으로 Partner Center에 접근할 수 있는데, 왜 Azure AD 앱을 만들어야 하나?"

### 답변

**Microsoft Store Submission API는 OAuth 2.0 인증을 사용합니다.**

#### 수동 로그인 vs API 인증

| 방식 | 인증 방법 | 사용 사례 |
|------|-----------|-----------|
| **브라우저 (수동)** | 사용자 ID/비밀번호 → 인터랙티브 로그인 | 사람이 직접 작업 |
| **API (자동)** | Client ID + Secret → Access Token | 스크립트/자동화 |

**API는 사용자 ID/비밀번호를 받지 않습니다!**
- 보안상의 이유로 사용자 자격증명을 스크립트에 저장할 수 없음
- 대신 "애플리케이션 자격증명"을 사용
- 이것이 바로 **Azure AD 앱 등록**

---

## 전체 구조 이해하기

### 3가지 핵심 요소

```
┌─────────────────────┐
│   Azure AD          │  ← 인증 서버 (Identity Provider)
│   (인증 담당)       │     "이 앱이 누군지 확인해줌"
└─────────────────────┘
          ↓ Access Token 발급
┌─────────────────────┐
│   Azure AD 앱       │  ← 로봇 직원 (Application Identity)
│   (자동화 도구)     │     "나는 Client ID와 Secret을 가진 앱이에요"
└─────────────────────┘
          ↓ Token을 가지고 API 호출
┌─────────────────────┐
│   Partner Center    │  ← 리소스 서버 (Resource Owner)
│   (앱 저장소)       │     "Token 확인 후 권한에 따라 작업 수행"
└─────────────────────┘
```

### 각 요소의 역할

#### 1. Azure AD (Azure Active Directory / Entra ID)
- **역할**: 인증 서버
- **기능**: 
  - 앱의 신원 확인
  - Access Token 발급
  - 권한 관리
- **비유**: 회사 HR 부서 (직원 신원 확인)

#### 2. Azure AD 앱 등록
- **역할**: 애플리케이션 신원
- **구성 요소**:
  - `Client ID`: 앱의 고유 ID (공개 가능)
  - `Client Secret`: 앱의 비밀 키 (절대 공개 불가)
  - `Tenant ID`: 조직(디렉토리) ID
- **비유**: 로봇 직원 (자동화 도구)

#### 3. Partner Center
- **역할**: 리소스 서버
- **기능**:
  - 앱 패키지 저장
  - 제출(Submission) 관리
  - 앱 메타데이터 관리
- **비유**: 회사 업무 시스템

---

## 인증 흐름

### OAuth 2.0 Client Credentials Flow

```
┌─────────────────┐
│  빌드 스크립트  │
└────────┬────────┘
         │ 1. Token 요청
         │    - Tenant ID
         │    - Client ID
         │    - Client Secret
         ↓
┌─────────────────┐
│   Azure AD      │
│  (로그인 서버)  │
└────────┬────────┘
         │ 2. 신원 확인 후
         │    Access Token 발급
         │    (60분 유효)
         ↓
┌─────────────────┐
│  빌드 스크립트  │
└────────┬────────┘
         │ 3. API 호출
         │    - Authorization: Bearer {token}
         │    - Application ID
         │    - Submission 데이터
         ↓
┌─────────────────┐
│ Partner Center  │
│ Submission API  │
└────────┬────────┘
         │ 4. Token 검증
         │    - 유효한가?
         │    - 권한이 있는가?
         │    - 이 앱에 접근 가능한가?
         ↓
┌─────────────────┐
│   응답          │
│ (성공/실패)     │
└─────────────────┘
```

### 상세 단계

#### Step 1: Token 요청
```http
POST https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={YOUR_CLIENT_ID}
&client_secret={YOUR_CLIENT_SECRET}
&scope=https://manage.devcenter.microsoft.com/.default
&grant_type=client_credentials
```

#### Step 2: Token 응답
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbG...",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

#### Step 3: API 호출
```http
POST https://manage.devcenter.microsoft.com/v1.0/my/applications/{app_id}/submissions
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbG...
Content-Type: application/json

{
  "applicationPackages": [...]
}
```

---

## 단계별 프로세스

### 전체 설정 흐름

```
┌──────────────────────────────────────────────────────────────┐
│ 1단계: Azure AD 앱 등록 생성                                 │
│    → Azure Portal 또는 CLI에서 앱 등록                       │
│    → Client ID 확보                                          │
│    → Client Secret 생성                                      │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 2단계: Partner Center에 Azure AD 앱 연결 ⭐ 중요!           │
│    → Partner Center → Account Settings → Users              │
│    → Azure AD applications 탭                               │
│    → Client ID 입력                                          │
│    → 역할 부여 (Manager 권한)                                │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 3단계: 환경 변수 설정                                        │
│    → .env 파일에 저장:                                       │
│       MS_STORE_TENANT_ID                                     │
│       MS_STORE_CLIENT_ID                                     │
│       MS_STORE_CLIENT_SECRET                                 │
│       MS_STORE_APPLICATION_ID                                │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ 4단계: 스크립트 실행                                         │
│    → build-windows-store.ps1 -UploadToStore                 │
│    → 자동으로 Token 획득 → API 호출 → 제출 완료             │
└──────────────────────────────────────────────────────────────┘
```

### ⭐ 핵심: 2단계가 없으면 작동하지 않음!

Azure AD 앱을 만들었다고 해서 바로 Partner Center API를 사용할 수 있는 것이 **아닙니다**.

**반드시 Partner Center에서 이 Azure AD 앱을 "승인"해야 합니다.**

#### 왜 이 단계가 필요한가?

```
Azure AD 앱을 만듦
   → "저는 dusskapark_hotmail.com 테넌트의 앱입니다"
   
BUT!
   
Partner Center는 아직 이 앱을 모름
   → "너가 누군데? 우리 계정에 접근하려고?"
   
Partner Center에 앱 등록
   → "아, 이 Client ID는 우리가 승인한 앱이구나!"
   → "Manager 권한을 줬으니 제출 관리를 할 수 있어"
```

---

## 비유로 이해하기

### 회사 업무 시스템 비유

#### 상황
당신은 회사(Partner Center)의 업무 시스템에 매일 출근해서 수동으로 작업(앱 업로드)을 하고 있습니다. 이제 로봇 직원(자동화 스크립트)을 고용해서 자동으로 작업하게 만들고 싶습니다.

#### 과정

| 단계 | 실제 작업 | 비유 |
|------|-----------|------|
| **1. 로봇 제작** | Azure AD 앱 등록 | 로봇 직원 제작 (ID카드 발급) |
| **2. 회사에 고용** | Partner Center에 앱 연결 | 로봇을 회사 시스템에 등록 |
| **3. 권한 부여** | Manager 역할 할당 | 로봇에게 업무 권한 부여 |
| **4. 출근** | 스크립트 실행 → Token 요청 | 로봇이 ID카드로 출근 |
| **5. 신원 확인** | Azure AD가 Token 발급 | 경비실에서 ID카드 확인 |
| **6. 업무 수행** | API로 제출 생성 | 시스템에 로그인해서 작업 |

#### 핵심 포인트

- 로봇을 만들기만 하면 안 됨 (Azure AD 앱만 만들면 안 됨)
- **회사에 정식으로 고용해야 함** (Partner Center에 연결)
- 고용하면서 권한을 부여해야 함 (Manager 역할)
- 그래야 로봇이 회사 시스템(Partner Center API)에 접근 가능

---

## 실제 사용 예시

### 환경 변수 (`.env` 파일)

```env
# Azure AD 테넌트 ID (디렉토리 ID)
MS_STORE_TENANT_ID=373da59a-5488-433a-ad1b-110cfc47835c

# Azure AD 앱 클라이언트 ID
MS_STORE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Azure AD 앱 클라이언트 시크릿
MS_STORE_CLIENT_SECRET=xxxx~xxxxxxxxxxxxxxxxxxxxxxxxx

# Partner Center 앱 ID (예: 9WZDNCRDXXXX)
MS_STORE_APPLICATION_ID=9WZDNCRDXXXX
```

### PowerShell 스크립트 사용

```powershell
# 1. 환경 변수 로드
. .\scripts\Load-DotEnv.ps1
Load-DotEnv

# 2. 빌드 및 Store 제출
.\scripts\build-windows-store.ps1 -UploadToStore

# 내부 동작:
# - Azure AD에서 Access Token 요청
#   → Tenant ID, Client ID, Client Secret 사용
# - Token 획득 (60분 유효)
# - Store Submission API 호출
#   → Authorization: Bearer {token}
# - 제출 생성 및 패키지 업로드
```

### 스크립트 내부 흐름 (`submit-to-store.ps1`)

```powershell
# Step 1: Token 획득
function Get-MSAccessToken {
    $tokenUrl = "https://login.microsoftonline.com/$TenantId/oauth2/v2.0/token"
    
    $body = @{
        client_id     = $ClientId
        client_secret = $ClientSecret
        scope         = "https://manage.devcenter.microsoft.com/.default"
        grant_type    = "client_credentials"
    }
    
    $response = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body
    return $response.access_token
}

# Step 2: Submission 생성
function Get-StoreSubmission {
    param($AccessToken, $ApplicationId)
    
    $headers = @{
        "Authorization" = "Bearer $AccessToken"
        "Content-Type"  = "application/json"
    }
    
    $url = "https://manage.devcenter.microsoft.com/v1.0/my/applications/$ApplicationId/submissions"
    
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers
    return $response
}

# Step 3: 패키지 업로드
# Step 4: Commit (선택)
```

---

## 요약

### 핵심 개념

1. **API는 사용자 비밀번호를 받지 않는다**
   - OAuth 2.0 Client Credentials Flow 사용
   - 애플리케이션 자격증명 필요

2. **Azure AD 앱 = 자동화를 위한 로봇 직원**
   - Client ID: 로봇의 이름표
   - Client Secret: 로봇의 비밀키
   - Tenant ID: 로봇이 속한 조직

3. **Partner Center 연결은 필수**
   - Azure AD 앱만 만들면 안 됨
   - Partner Center에서 명시적으로 승인 필요
   - 권한(역할) 부여 필요

4. **전체 흐름**
   ```
   앱 등록 → Partner Center 연결 → 권한 부여 → Token 획득 → API 호출
   ```

### 필수 단계 체크리스트

- [ ] Azure Portal에 로그인 (개인 Microsoft 계정)
- [ ] Azure AD에서 앱 등록 생성
- [ ] Client ID 복사
- [ ] Client Secret 생성 및 복사
- [ ] Tenant ID 확인
- [ ] **Partner Center → Account Settings → Users → Azure AD applications**
- [ ] **Client ID 입력 및 Manager 역할 부여** ⭐
- [ ] Partner Center에서 Application ID 확인
- [ ] `.env` 파일에 모든 값 저장
- [ ] 스크립트 실행 및 테스트

---

## 다음 단계

이제 개념을 이해했다면, 실제 설정을 진행하세요:

1. **[Azure 정리 가이드](./AZURE_CLEANUP_AND_FIND_TENANT.md)** - 불필요한 테넌트 정리
2. **[Partner Center 설정 가이드](./PARTNER_CENTER_SETUP.md)** - 실제 설정 단계별 가이드

---

## 참고 자료

- [Microsoft Store Submission API 공식 문서](https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api)
- [Azure AD OAuth 2.0 Client Credentials Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)
- [Partner Center API 인증](https://learn.microsoft.com/en-us/windows/apps/publish/create-and-manage-submissions-using-windows-store-services#obtain-an-azure-ad-access-token)

