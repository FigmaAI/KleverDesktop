# Klever Desktop 빌드 용량 최적화 가이드

## 📊 현재 상황 분석

빌드 파일이 큰 주요 원인:
1. **OpenCV** (~150MB) - 네이티브 라이브러리 포함
2. **JRE 전체 모듈** (~50-100MB) - `includeAllModules = true`
3. **Selenium 전체 패키지** (~50MB) - 모든 브라우저 드라이버 포함
4. **중복 의존성** (~10-20MB)

**예상 총 절감량: 180-300MB**

---

## 🎯 최적화 방안

### 1단계: OpenCV 제거 (가장 큰 효과, ~150MB 절감)

#### 현재 상황
`SeleniumController.kt`에서 OpenCV를 이미지에 바운딩 박스를 그리는 용도로만 사용:
- `Imgcodecs.imread()` - 이미지 읽기
- `Imgproc.rectangle()` - 사각형 그리기
- `Imgproc.putText()` - 텍스트 추가
- `Imgcodecs.imwrite()` - 이미지 저장

#### 해결 방법
Java 표준 라이브러리(`java.awt`, `javax.imageio`)로 대체

#### 적용 방법

**A. `build.gradle.kts`에서 OpenCV 의존성 제거**
```kotlin
// 주석 처리 또는 삭제
// implementation("org.openpnp:opencv:4.7.0-0")
```

**B. `SeleniumController.kt` 수정**

기존 OpenCV import 제거:
```kotlin
// 삭제
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
```

새로운 Java AWT import 추가:
```kotlin
import java.awt.Color
import java.awt.Font
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.File
import javax.imageio.ImageIO
```

`drawBoundingBoxes` 함수 재작성:
```kotlin
private fun drawBoundingBoxes(
    imagePath: String,
    predictions: List<Prediction>,
    outputPath: String,
    darkMode: Boolean
) {
    try {
        // 이미지 읽기
        val image: BufferedImage = ImageIO.read(File(imagePath))
        val g2d: Graphics2D = image.createGraphics()
        
        // 안티앨리어싱 활성화
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        
        // 색상 설정
        val color = if (darkMode) Color(255, 250, 250) else Color(10, 10, 10)
        g2d.color = color
        g2d.stroke = java.awt.BasicStroke(2.0f)
        
        var count = 1
        
        predictions.forEach { prediction ->
            try {
                val left = (prediction.x - prediction.width / 2).toInt()
                val top = (prediction.y - prediction.height / 2).toInt()
                val right = (prediction.x + prediction.width / 2).toInt()
                val bottom = (prediction.y + prediction.height / 2).toInt()
                
                // 사각형 그리기
                g2d.drawRect(left, top, right - left, bottom - top)
                
                // 텍스트 추가
                g2d.font = Font("Arial", Font.BOLD, 24)
                g2d.drawString(count.toString(), left, top - 10)
                
                count++
            } catch (e: Exception) {
                logger.error(e) { "Failed to draw box for prediction: ${e.message}" }
            }
        }
        
        g2d.dispose()
        
        // 이미지 저장
        ImageIO.write(image, "png", File(outputPath))
        
    } catch (e: Exception) {
        logger.error(e) { "Failed to draw bounding boxes: ${e.message}" }
        throw RuntimeException("Drawing bounding boxes failed", e)
    }
}
```

---

### 2단계: JRE 모듈 최적화 (~50-100MB 절감)

#### 변경 전
```kotlin
includeAllModules = true  // 모든 JDK 모듈 포함
```

#### 변경 후
```kotlin
// 필요한 모듈만 명시적으로 추가
modules(
    "java.base",
    "java.desktop",
    "java.logging",
    "java.naming",
    "java.net.http",
    "java.prefs",
    "java.sql",
    "java.xml",
    "java.instrument",
    "java.management",
    "jdk.unsupported"
)

// includeAllModules = true  // 삭제 또는 주석 처리
```

---

### 3단계: Selenium 의존성 (변경 없음)

모든 브라우저를 지원하기 위해 원래대로 유지:

```kotlin
implementation("org.seleniumhq.selenium:selenium-java:4.18.1")  // 모든 브라우저 포함
```

**참고:** Chrome만 사용하는 경우 개별 드라이버만 추가하면 ~20-30MB 절감 가능하지만, 
유연성을 위해 모든 브라우저 지원을 유지합니다.

---

### 4단계: 중복 의존성 제거 (~10-20MB 절감)

#### 중복 제거 목록

```kotlin
// ❌ 중복 1: kotlinx-serialization-json
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.3.0")  // 삭제
// ✅ 최신 버전만 유지: 1.6.0

// ❌ 중복 2: kotlin-logging
implementation("io.github.microutils:kotlin-logging:3.0.5")
implementation("io.github.microutils:kotlin-logging:2.0.11")  // 삭제
// ✅ 최신 버전만 유지: 3.0.5

// ❌ 중복 3: config
implementation("com.typesafe:config:1.4.2")
implementation("com.typesafe:config:1.4.2")  // 삭제
// ✅ 하나만 유지

// ❌ 중복 4: HTTP 클라이언트
implementation("com.squareup.okhttp3:okhttp:4.9.0")  // 삭제
// ✅ Ktor만 사용
```

---

### 5단계: JAR 압축 최적화

```kotlin
tasks.withType<Jar>().configureEach {
    setDuplicatesStrategy(org.gradle.api.file.DuplicatesStrategy.EXCLUDE)
    
    // 압축 최적화
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
```

---

## 🚀 적용 순서

### 빠른 적용 (권장)
```bash
# 1. 최적화된 build.gradle.kts 백업 및 적용
cd /Users/jude.park/Sites/KleverDesktop/app
cp build.gradle.kts build.gradle.kts.backup
cp build.gradle.kts.optimized build.gradle.kts

# 2. SeleniumController.kt OpenCV 코드 수정
# (위의 코드 참조)

# 3. 빌드 테스트
cd /Users/jude.park/Sites/KleverDesktop
./gradlew clean build

# 4. 크기 확인
du -sh app/build/compose/binaries/main/dmg/
```

### 점진적 적용
1. **1단계만 먼저**: OpenCV 제거 (가장 큰 효과)
2. **테스트 후 2단계**: JRE 모듈 최적화
3. **테스트 후 3-4단계**: Selenium 및 중복 의존성 제거

---

## 📝 추가 최적화 (선택사항)

### ProGuard/R8 사용
코드 난독화 및 사용하지 않는 코드 제거:

```kotlin
// build.gradle.kts
tasks.withType<Jar>().configureEach {
    // Minimize JAR size
    minimize()
}
```

### 리소스 최적화
- 아이콘 파일 최적화 (PNG 압축)
- 불필요한 리소스 제거

---

## ⚠️ 주의사항

1. **OpenCV 제거 전**: `drawBoundingBoxes` 함수를 Java AWT로 재작성 필수
2. **JRE 모듈 변경 후**: 누락된 모듈이 있는지 런타임 테스트 필수
3. **Selenium 변경 후**: Chrome 외 다른 브라우저를 사용하지 않는지 확인

---

## 📊 예상 결과

| 항목 | 변경 전 | 변경 후 | 절감 |
|------|---------|---------|------|
| OpenCV | 150MB | 0MB | -150MB |
| JRE | 150MB | 70MB | -80MB |
| Selenium | 50MB | 50MB | 0MB |
| 중복 의존성 | 20MB | 0MB | -20MB |
| **총합** | **~370MB** | **~120MB** | **-250MB** |

**최종 빌드 크기: ~120-170MB (기존 대비 60-65% 감소)**

---

## 🔍 크기 확인 명령어

```bash
# 전체 빌드 디렉토리 크기
du -sh app/build/

# 최종 배포 파일 크기
ls -lh app/build/compose/binaries/main/dmg/*.dmg
ls -lh app/build/compose/binaries/main/msi/*.msi
ls -lh app/build/compose/binaries/main/exe/*.exe
```

---

## 💡 참고

- 이 최적화는 기능을 유지하면서 용량만 줄이는 것입니다
- 모든 변경 후 철저한 테스트가 필요합니다
- 문제 발생 시 백업 파일로 복원하세요

