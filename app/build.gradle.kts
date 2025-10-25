import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm")
    id("org.jetbrains.compose")
    kotlin("plugin.serialization") version "1.9.22"
}

// Add Gradle 9.0 compatibility settings
kotlin {
    jvmToolchain(21) // Using AWS Corretto 21
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
    
    // JSON Serialization (removed duplicates, keeping latest version only)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")
    
    // HTTP Client - OkHttp (used in AzureModel, OpenAIModel)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    
    // Selenium - Support for all browsers
    implementation("org.seleniumhq.selenium:selenium-java:4.18.1")
    
    // WebDriverManager
    implementation("io.github.bonigarcia:webdrivermanager:5.7.0")
    
    // Logging (removed duplicates, keeping latest version only)
    implementation("ch.qos.logback:logback-classic:1.4.11")
    implementation("io.github.microutils:kotlin-logging:3.0.5")
    
    // Compose Desktop
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.foundation)
    
    // Ktor client dependencies (removed OkHttp, using Ktor only)
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
            
            // Explicitly add only required JRE modules (saves approximately 70-80MB)
            modules(
                "java.base",            // Required: Base Java API
                "java.desktop",         // Required: Compose GUI, AWT
                "java.prefs",           // Required: Settings storage
                "java.net.http",        // Required: HTTP communication (Ktor, Selenium)
                "java.logging",         // Required: Logging
                "java.naming",          // Required: JNDI, network services
                "java.xml",             // Required: XML processing
                "java.sql",             // Optional: JDBC (may be used by Jackson)
                "java.instrument",      // Optional: Instrumentation
                "java.management",      // Optional: JMX Management
                "jdk.unsupported"       // Optional: Unsafe API (used by some libraries)
            )
            
            // Removed includeAllModules - prevents including unnecessary modules
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
                // dirChooser = true // Removed for silent install (MS Store Policy 10.2.9)
                perUserInstall = true // Minimize UAC and per-user installation
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
    
    // JAR compression optimization
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}

tasks.named("build") {
    dependsOn("copyResources")
}