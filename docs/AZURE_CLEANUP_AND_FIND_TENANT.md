# Azure Portal 정리 및 Entra ID 찾기 가이드
## 개인 Microsoft 계정 (dussakapark@hotmail.com)용

이 가이드는 Azure Portal에서 불필요한 디렉토리를 정리하고, 개인 계정에 해당하는 Entra ID를 찾는 방법을 설명합니다.

## 목차
1. [Azure Portal 로그인](#azure-portal-로그인)
2. [현재 디렉토리 확인](#현재-디렉토리-확인)
3. [불필요한 디렉토리 삭제](#불필요한-디렉토리-삭제)
4. [개인 계정 Entra ID 찾기](#개인-계정-entra-id-찾기)
5. [테넌트 ID 확인 및 저장](#테넌트-id-확인-및-저장)

---

## Azure Portal 로그인

### 1단계: Azure Portal 접속
1. 브라우저에서 [Azure Portal](https://portal.azure.com) 접속
2. **dussakapark@hotmail.com** 계정으로 로그인
3. 로그인 후 대시보드가 표시됩니다

---

## 현재 디렉토리 확인

### 1단계: 디렉토리 전환 메뉴 확인
1. Azure Portal 상단 오른쪽에 있는 **계정 아이콘** (이메일 주소 옆) 클릭
2. **"디렉토리 + 구독"** (Directory + subscription) 선택
   - 또는 바로 아래 "디렉토리 전환" 메뉴에서 확인 가능

### 2단계: 현재 활성 디렉토리 확인
- 현재 활성화된 디렉토리가 강조되어 표시됩니다
- 각 디렉토리의 이름과 기본 도메인 확인

**참고**: 
- 개인 Microsoft 계정의 경우 **"기본 디렉토리"** 또는 **"Microsoft 계정"** 디렉토리가 자동 생성됩니다
- 이 디렉토리가 실제로 사용할 Entra ID입니다

---

## 불필요한 디렉토리 삭제

### 주의사항 ⚠️
**디렉토리 삭제 전 확인사항:**
- 디렉토리 내에 리소스가 있는지 확인
- 삭제된 디렉토리는 복구할 수 없습니다
- 디렉토리를 삭제하려면 **전역 관리자 권한**이 필요합니다

### 1단계: 디렉토리 상세 정보 확인
1. **디렉토리 + 구독** 창에서 삭제하려는 디렉토리 선택
2. **"전환"** 버튼 클릭하여 해당 디렉토리로 이동

### 2단계: 디렉토리 내 리소스 확인
1. Azure Portal 왼쪽 메뉴에서 **"모든 리소스"** (All resources) 클릭
2. 리소스 목록 확인:
   - 리소스가 있다면 먼저 삭제해야 디렉토리 삭제 가능
   - 리소스가 없다면 바로 삭제 가능

### 3단계: 디렉토리 삭제

#### 방법 1: 디렉토리 설정에서 삭제
1. Azure Portal 왼쪽 메뉴에서 **"Microsoft Entra ID"** (또는 "Azure Active Directory") 선택
2. 왼쪽 메뉴에서 **"개요"** (Overview) 클릭
3. 오른쪽 상단에서 **"테넌트 삭제"** (Delete tenant) 버튼 찾기
   - 또는 **"속성"** (Properties) 메뉴에서 삭제 옵션 확인

#### 방법 2: Azure Active Directory 설정에서 삭제
1. **Microsoft Entra ID** > **"속성"** (Properties) 선택
2. 페이지 하단으로 스크롤
3. **"Azure Active Directory 삭제"** 또는 **"조직 삭제"** 섹션 찾기
4. **"조직 삭제"** 링크 클릭

#### 방법 3: Azure Active Directory Enterprise Applications에서 확인
1. **Microsoft Entra ID** > **"엔터프라이즈 애플리케이션"** (Enterprise applications) 선택
2. 등록된 앱이 있는지 확인
3. 앱이 있다면 먼저 삭제해야 디렉토리 삭제 가능

### 4단계: 삭제 확인
1. 삭제 확인 창이 나타남
2. 디렉토리 이름 입력하여 확인
3. **"삭제"** 버튼 클릭

**참고**: 
- 삭제 프로세스는 즉시 시작되지만 완전히 삭제되는데 시간이 걸릴 수 있습니다 (수 분 ~ 수 시간)
- 삭제 중인 디렉토리는 "삭제 중" 상태로 표시됩니다

---

## 개인 계정 Entra ID 찾기

### 1단계: 기본 디렉토리로 전환
1. 상단 오른쪽 **계정 아이콘** 클릭
2. **"디렉토리 + 구독"** 선택
3. **개인 Microsoft 계정 디렉토리** 선택:
   - 이름: **"기본 디렉토리"** 또는 **"Microsoft 계정"**
   - 또는 dussakapark@hotmail.com과 연결된 디렉토리
4. **"전환"** 클릭

### 2단계: Microsoft Entra ID 확인
1. Azure Portal 왼쪽 상단 **"리소스, 서비스 및 문서 검색"** 클릭
2. **"Microsoft Entra ID"** 또는 **"Azure Active Directory"** 입력
3. 검색 결과에서 선택

**또는**

1. 왼쪽 메뉴에서 **"Microsoft Entra ID"** 직접 선택 (이미 있다면)

### 3단계: Entra ID 속성 확인
1. **Microsoft Entra ID** 페이지에서 왼쪽 메뉴 **"개요"** (Overview) 클릭
2. 다음 정보 확인:
   - **테넌트 이름**: 일반적으로 "기본 디렉토리" 또는 개인 계정 이름
   - **기본 도메인**: `dussakapark.onmicrosoft.com` 형태
   - **테넌트 ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` (GUID 형식) ⭐ **이게 중요!**

---

## 테넌트 ID 확인 및 저장

### 1단계: 테넌트 ID 복사
1. **Microsoft Entra ID** > **개요** 페이지로 이동
2. **"테넌트 ID"** (Tenant ID) 필드 찾기
   - 페이지 중앙 또는 오른쪽 "Essentials" 패널에 표시됨
3. **테넌트 ID 클릭** 또는 **복사 아이콘** 클릭하여 복사
   - 형식: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 2단계: 테넌트 정보 확인
개요 페이지에서 확인 가능한 정보:
- ✅ **테넌트 이름**: 개인 계정 디렉토리 이름
- ✅ **테넌트 ID**: Store Submission API에 필요한 값
- ✅ **기본 도메인**: `dussakapark.onmicrosoft.com` 형태
- ✅ **디렉토리 ID**: 테넌트 ID와 동일

### 3단계: 테넌트 ID 저장
`.env` 파일에 저장할 값:

```env
# Microsoft Store Submission API
# Azure AD 테넌트 ID (위에서 복사한 값)
MS_STORE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 빠른 확인 체크리스트

다음을 확인하세요:

- [ ] Azure Portal에 dussakapark@hotmail.com으로 로그인됨
- [ ] 불필요한 디렉토리 삭제 완료
- [ ] 기본 디렉토리로 전환됨
- [ ] Microsoft Entra ID > 개요에서 테넌트 ID 확인
- [ ] 테넌트 ID 복사하여 `.env` 파일에 저장

---

## 문제 해결

### 문제 1: "디렉토리를 찾을 수 없음"
**해결**:
1. 계정 아이콘 > 디렉토리 + 구독에서 모든 디렉토리 확인
2. 개인 계정 디렉토리가 없으면 자동으로 생성됨 (첫 앱 등록 시)

### 문제 2: "디렉토리 삭제 버튼이 없음"
**원인**: 전역 관리자 권한이 없거나, 디렉토리에 리소스가 있습니다.

**해결**:
1. **속성** 메뉴에서 디렉토리 삭제 옵션 확인
2. 모든 리소스 삭제 후 다시 시도
3. 전역 관리자 권한 확인

### 문제 3: "기본 디렉토리가 보이지 않음"
**해결**:
1. 디렉토리 + 구독에서 "모든 디렉토리" 확인
2. 이름이 "기본 디렉토리"가 아닐 수 있음 (개인 계정 이름으로 표시될 수 있음)
3. dussakapark@hotmail.com과 연결된 디렉토리 선택

### 문제 4: "테넌트 ID가 표시되지 않음"
**해결**:
1. Microsoft Entra ID > 개요 페이지로 이동
2. 오른쪽 "Essentials" 패널 확장
3. 또는 "속성" (Properties) 메뉴에서 확인
4. "디렉토리 ID" (Directory ID)도 테넌트 ID와 동일

---

## 다음 단계

테넌트 ID를 확인했다면:
1. `.env` 파일에 `MS_STORE_TENANT_ID` 값 저장
2. [PARTNER_CENTER_SETUP.md](./PARTNER_CENTER_SETUP.md) 가이드 따라 앱 등록 진행
3. 파트너센터에서 Azure AD 앱 연결

---

## 참고 링크

- [Azure Portal](https://portal.azure.com)
- [Microsoft Entra ID 관리](https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/~/Overview)
- [Azure 디렉토리 및 구독 관리](https://portal.azure.com/#view/Microsoft_Azure_Billing/SubscriptionsBlade)
