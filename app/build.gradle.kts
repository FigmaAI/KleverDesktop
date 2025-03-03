import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    kotlin("jvm")
    id("org.jetbrains.compose")
    kotlin("plugin.serialization") version "1.9.22"
}

// Add Gradle 9.0 compatibility settings
kotlin {
    jvmToolchain(17) // Use explicit JVM toolchain
}

// Use type-safe configuration
tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += "-opt-in=kotlin.RequiresOptIn"
    }
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

        // Use explicit configuration for nativeDistributions
        nativeDistributions {
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Exe)
            packageName = "KleverDesktop"
            packageVersion = "1.0.1"
            
            modules("java.instrument", "java.management", "jdk.unsupported")
            
            // Add required JDK modules (include JRE in distribution)
            includeAllModules = true
            
            // Runtime image compression settings
            // Use the newer syntax for JDK configuration
            javaHome = System.getProperty("java.home")
            
            // Memory settings
            jvmArgs += listOf("-Xmx2g")

            macOS {
                bundleID = "com.klever.desktop"
                dockName = "Klever Desktop"
                iconFile.set(project.file("src/main/resources/icon.icns"))
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
}

tasks.named("build") {
    dependsOn("copyResources")
}