# 📚 Klever Desktop 최적화 문서

이 폴더에는 Klever Desktop 빌드 최적화와 관련된 문서와 도구가 포함되어 있습니다.

## 📄 문서 목록

### ⭐ [FINAL_OPTIMIZATION_REPORT.md](./FINAL_OPTIMIZATION_REPORT.md) ⭐
**최종 최적화 보고서** (먼저 읽어보세요!)
- 전체 최적화 내역 요약
- 적용된 모든 변경사항
- 예상 효과 및 절감량 (~240MB)
- 개발 환경 설정 (AWS Corretto 21)
- 빌드 및 테스트 가이드
- 문서 구조 안내

**추천:** 프로젝트 전체 상황을 한눈에 파악하려면 이 문서부터!

---

### 1. 🎉 [OPTIMIZATION_SUMMARY.md](./OPTIMIZATION_SUMMARY.md)
**최적화 완료 요약** (상세 버전)
- 적용된 모든 최적화 내역
- 예상 절감 효과 (~260MB)
- 테스트 방법 및 체크리스트
- 변경된 파일 목록
- 문제 해결 가이드

**추천:** 먼저 이 문서를 읽고 전체 변경사항을 파악하세요!

---

### 2. 📖 [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)
**전체 최적화 가이드**
- 빌드 파일 용량이 큰 이유 분석
- 단계별 최적화 방안
- OpenCV 제거 방법
- JRE 모듈 최적화
- Selenium 의존성 최적화
- 중복 의존성 제거

**예상 효과:** 총 180-300MB 절감

---

### 3. 🔍 [CHECK_REQUIRED_MODULES.md](./CHECK_REQUIRED_MODULES.md)
**JRE 모듈 요구사항 확인 가이드**
- 애플리케이션이 필요로 하는 JRE 모듈 분석
- 의존성별 필요 모듈 매핑
- 테스트 방법 (JRE 없는 환경)
- `jdeps` 도구 사용법
- 단계적 최적화 접근 방법

---

### 4. ✅ [SAFE_MODULE_CONFIG.md](./SAFE_MODULE_CONFIG.md)
**안전한 JRE 모듈 설정**
- "JRE 모듈을 일부만 포함해도 안전한가?" 질문에 대한 상세 답변
- Self-Contained 애플리케이션 구조 설명
- 3가지 레벨 설정 (초보수적/보수적/최소화)
- 에러 발생 시 대처 방법
- 최종 권장 설정

---

### 5. 🛠️ [build.gradle.kts.optimized](./build.gradle.kts.optimized)
**최적화된 빌드 설정 파일**
- 중복 의존성 제거
- Selenium 의존성 최적화
- JRE 모듈 명시적 설정
- JAR 압축 최적화

**사용 방법:**
```bash
cd /Users/jude.park/Sites/KleverDesktop/app
cp build.gradle.kts build.gradle.kts.backup
cp ../docs/build.gradle.kts.optimized build.gradle.kts
```

---

### 6. 🚀 [APPLY_OPTIMIZATION.sh](./APPLY_OPTIMIZATION.sh)
**자동 최적화 적용 스크립트**
- 백업 자동 생성
- 최적화 설정 적용
- 크기 분석
- 다음 단계 안내

**사용 방법:**
```bash
cd /Users/jude.park/Sites/KleverDesktop

# Dry run (확인만)
./docs/APPLY_OPTIMIZATION.sh --dry-run

# 실제 적용
./docs/APPLY_OPTIMIZATION.sh
```

---

### 7. 📖 [New-README.md](./New-README.md)
**영문 프로젝트 설명서**
- System Architecture
- Core Components
- Communication Flow
- Development Setup Guide
- API Documentation

---

## 🎯 빠른 시작

### Option 1: 자동 적용 (권장)
```bash
cd /Users/jude.park/Sites/KleverDesktop
./docs/APPLY_OPTIMIZATION.sh
```

### Option 2: 수동 적용
1. `OPTIMIZATION_GUIDE.md` 읽기
2. 단계별로 따라하기
3. 각 단계마다 테스트

---

## 📊 최적화 요약

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| OpenCV | ~150MB | 0MB | -150MB |
| JRE 모듈 | ~150MB | ~70MB | -80MB |
| Selenium | ~50MB | ~50MB | 0MB (유지) |
| 중복 의존성 | ~20MB | 0MB | -20MB |
| **총합** | **~370MB** | **~120MB** | **-250MB** |

**최종 빌드 크기: ~120-170MB (기존 대비 60-65% 감소)**

---

## ⚠️ 주의사항

1. **백업 필수**: 적용 전 반드시 백업하세요
2. **테스트 필수**: JRE 없는 환경에서 철저히 테스트하세요
3. **단계별 적용**: 한 번에 모든 것을 바꾸지 말고 단계별로 적용하세요

---

## 🔄 복원 방법

문제 발생 시:
```bash
# 백업에서 복원
cp backups_YYYYMMDD_HHMMSS/build.gradle.kts.backup app/build.gradle.kts
cp backups_YYYYMMDD_HHMMSS/SeleniumController.kt.backup app/src/main/kotlin/com/klever/desktop/browser/SeleniumController.kt

# 또는 Git에서 복원
git checkout app/build.gradle.kts
git checkout app/src/main/kotlin/com/klever/desktop/browser/SeleniumController.kt
```

---

## 📞 문제 해결

각 문서에 상세한 문제 해결 방법이 포함되어 있습니다:
- OpenCV 대체 코드 → `OPTIMIZATION_GUIDE.md`
- 모듈 누락 에러 → `CHECK_REQUIRED_MODULES.md`
- JRE 설정 질문 → `SAFE_MODULE_CONFIG.md`

---

## 💡 참고

- 이 문서들은 `.gitignore`에 포함되어 Git에 커밋되지 않습니다
- 로컬 개발 및 빌드 최적화 참고 자료입니다
- 모든 최적화는 기능을 유지하면서 용량만 줄이는 것입니다

