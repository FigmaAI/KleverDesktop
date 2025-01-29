import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm")
    id("org.jetbrains.compose") version "1.6.0"
    kotlin("plugin.serialization") version "1.9.22"
}

dependencies {
    // Kotlin
    implementation(platform("org.jetbrains.kotlin:kotlin-bom"))
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")
    
    // WebSocket
    implementation("org.java-websocket:Java-WebSocket:1.5.4")
    implementation("com.typesafe:config:1.4.2")
    
    // JSON Processing
    implementation("com.fasterxml.jackson.core:jackson-databind:2.15.2")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.2")
    
    // Selenium
    implementation("org.seleniumhq.selenium:selenium-java:4.18.1")
    implementation("org.seleniumhq.selenium:selenium-chrome-driver:4.18.1")
    implementation("org.seleniumhq.selenium:selenium-support:4.18.1")
    
    // WebDriverManager
    implementation("io.github.bonigarcia:webdrivermanager:5.7.0")
    
    // Logging
    implementation("ch.qos.logback:logback-classic:1.4.11")
    implementation("io.github.microutils:kotlin-logging:3.0.5")
    
    // OpenCV
    implementation("org.openpnp:opencv:4.7.0-0")
    
    // Config
    implementation("com.typesafe:config:1.4.2")
    
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.foundation)
    
    // JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
    
    // HTTP Client
    implementation("com.squareup.okhttp3:okhttp:4.9.0")
    
    // JSON Serialization
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.3.0")
    
    // Logging
    implementation("io.github.microutils:kotlin-logging:2.0.11")
    
    // Ktor client 의존성
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
        
        nativeDistributions {
            targetFormats(TargetFormat.Dmg)
            
            macOS {
                bundleID = "com.klever.desktop"
                dockName = "Klever Desktop"
                iconFile.set(project.file("src/main/resources/icon.icns"))
                
                // 백그라운드 앱 설정 임시 제거
                // infoPlist {
                //     extraKeysRawXml = """
                //         <key>LSUIElement</key>
                //         <string>1</string>
                //         <key>LSBackgroundOnly</key>
                //         <string>1</string>
                //         <key>CFBundlePackageType</key>
                //         <string>APPL</string>
                //         <key>CFBundleSignature</key>
                //         <string>????</string>
                //     """
                // }
                
                // jvmArgs += listOf("-Dapple.awt.UIElement=true")
            }
        }
    }
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        jvmTarget = "17"
    }
}

sourceSets {
    main {
        kotlin {
            exclude("**/figma-client/**")
        }
    }
}