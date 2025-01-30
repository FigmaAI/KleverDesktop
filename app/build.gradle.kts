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
    
    // Ktor client dependencies
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
            targetFormats(TargetFormat.Dmg, TargetFormat.Exe, TargetFormat.Msi)
            packageName = "KleverDesktop"
            packageVersion = "1.0.0"
            
            windows {
                menuGroup = "Klever Desktop (Beta)"
                iconFile.set(project.file("src/main/resources/icon.ico"))
                upgradeUuid = "FCDFDD35-04EB-4698-89F5-3CCAB516B324"
                msiPackageVersion = "1.0.0"
                exePackageVersion = "1.0.0"
            }
            
            macOS {
                bundleID = "com.klever.desktop"
                dockName = "Klever Desktop (Beta)"
                iconFile.set(project.file("src/main/resources/icon.icns"))
                dmgPackageVersion = "1.0.0"
                
                signing {
                    sign.set(false)  // disable signing
                }
                
                // additional JVM options
                jvmArgs += listOf(
                    "-Dapple.awt.application.appearance=system"
                )
                
                // additional Info.plist settings
                infoPlist {
                    extraKeysRawXml = """
                        <key>CFBundlePackageType</key>
                        <string>APPL</string>
                        <key>CFBundleSignature</key>
                        <string>????</string>
                        <key>LSApplicationCategoryType</key>
                        <string>public.app-category.developer-tools</string>
                        <key>LSMinimumSystemVersion</key>
                        <string>10.13</string>
                        <key>CFBundleShortVersionString</key>
                        <string>1.0.0-beta</string>
                        <key>CFBundleVersion</key>
                        <string>1.0.0-beta</string>
                        <key>NSAppleEventsUsageDescription</key>
                        <string>KleverDesktop needs to control the browser.</string>
                        <key>NSHighResolutionCapable</key>
                        <true/>
                        <key>com.apple.security.automation.apple-events</key>
                        <true/>
                    """
                }
            }

            // common distribution settings
            modules("java.sql")
            modules("java.net.http")
            modules("jdk.crypto.ec")
            
            // package information
            description = "Klever Desktop Application"
            copyright = "© 2025 Klever. All rights reserved."
            vendor = "Klever"
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