import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm")
    id("org.jetbrains.compose")
    kotlin("plugin.serialization") version "1.9.22"
}

// Add Gradle 9.0 compatibility settings
kotlin {
    jvmToolchain(21) // AWS Corretto 21 사용
}

// Use type-safe configuration
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "21"
        freeCompilerArgs += "-opt-in=kotlin.RequiresOptIn"
    }
}

dependencies {
    // Kotlin
    implementation(platform("org.jetbrains.kotlin:kotlin-bom"))
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    
    // Config
    implementation("com.typesafe:config:1.4.2")
    
    // WebSocket
    implementation("org.java-websocket:Java-WebSocket:1.5.4")
    
    // JSON Processing
    implementation("com.fasterxml.jackson.core:jackson-databind:2.15.2")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.2")
    
    // JSON Serialization (중복 제거, 최신 버전만 유지)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
    
    // HTTP Client - OkHttp (AzureModel, OpenAIModel에서 사용)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Selenium - 모든 브라우저 지원
    implementation("org.seleniumhq.selenium:selenium-java:4.18.1")
    
    // WebDriverManager
    implementation("io.github.bonigarcia:webdrivermanager:5.7.0")
    
    // Logging (중복 제거, 최신 버전만 유지)
    implementation("ch.qos.logback:logback-classic:1.4.11")
    implementation("io.github.microutils:kotlin-logging:3.0.5")
    
    // Compose Desktop
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.foundation)
    
    // Ktor client dependencies (OkHttp 제거, Ktor만 사용)
    val ktorVersion = "2.3.7"
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion")
    implementation("io.ktor:ktor-client-content-negotiation:$ktorVersion")
    implementation("io.ktor:ktor-serialization-kotlinx-json:$ktorVersion")
    implementation("io.ktor:ktor-client-json:$ktorVersion")
    implementation("io.ktor:ktor-client-apache:$ktorVersion")
}

compose.desktop {
    application {
        mainClass = "com.klever.desktop.AppKt"

        // Use explicit configuration for nativeDistributions
        nativeDistributions {
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Exe)
            packageName = "KleverDesktop"
            packageVersion = "1.1.0"
            
            // 필요한 JRE 모듈만 명시적으로 추가 (약 70-80MB 절감)
            modules(
                "java.base",            // 필수: 기본 Java API
                "java.desktop",         // 필수: Compose GUI, AWT
                "java.prefs",           // 필수: 설정 저장
                "java.net.http",        // 필수: HTTP 통신 (Ktor, Selenium)
                "java.logging",         // 필수: 로깅
                "java.naming",          // 필수: JNDI, 네트워크 서비스
                "java.xml",             // 필수: XML 처리
                "java.sql",             // 선택: JDBC (Jackson이 사용할 수 있음)
                "java.instrument",      // 선택: Instrumentation
                "java.management",      // 선택: JMX Management
                "jdk.unsupported"       // 선택: Unsafe API (일부 라이브러리가 사용)
            )
            
            // includeAllModules 제거 - 불필요한 모듈 포함 방지
            // includeAllModules = true
            
            javaHome = System.getProperty("java.home")
            
            // Memory settings
            jvmArgs += listOf("-Xmx2g")

            macOS {
                bundleID = "com.klever.desktop"
                dockName = "Klever Desktop"
                iconFile.set(project.file("src/main/resources/icon.icns"))
                
                // App Store required settings
                infoPlist {
                    extraKeysRawXml = """
                        <key>LSApplicationCategoryType</key>
                        <string>public.app-category.productivity</string>
                        <key>LSMinimumSystemVersion</key>
                        <string>12.0</string>
                    """
                }
                
                // Build for both Intel and Apple Silicon
                // For App Store: need universal binary OR set minimum OS to 12.0+ for arm64-only
                // Currently targeting macOS 12.0+ for arm64-only
                
                signing {
                    sign.set(false) // Explicitly set signing option
                }
            }

            windows {
                dirChooser = true
                menuGroup = "KleverDesktop"
                upgradeUuid = "FCDFDD35-04EB-4698-89F5-3CCAB516B324"
                iconFile.set(project.file("src/main/resources/icon.ico"))
                // Add Windows-specific JVM arguments
                jvmArgs += listOf("-Djava.library.path=runtime/bin")
            }
        }
    }
}

sourceSets {
    main {
        kotlin {
            exclude("**/figma-client/**")
        }
    }
}

// Use type-safe task configuration
tasks.register<Copy>("copyResources") {
    description = "Copies resources to the build directory"
    group = "build"
    
    from("src/main/resources")
    into(layout.buildDirectory.dir("resources/main"))
}

tasks.withType<Jar>().configureEach {
    setDuplicatesStrategy(org.gradle.api.file.DuplicatesStrategy.EXCLUDE)
    
    dependsOn("copyResources")
    
    from("src/main/resources") {
        include("**/*")
    }
    
    // JAR 압축 최적화
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}

tasks.named("build") {
    dependsOn("copyResources")
}