import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.compose)
}

// Project version - centralized version management
// Use environment variable CI_COMMIT_TAG if available, otherwise use default
val appVersion = System.getenv("CI_COMMIT_TAG")
    // Parse the actual app version from the tag (e.g., "v1.0.2-prod" -> "1.0.2")
    ?.let { version -> version.split("-").first().split("v").last() } ?: "1.1.0"

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
    implementation(libs.kotlin.stdlib.jdk8)
    
    // WebSocket
    implementation(libs.java.websocket)
    implementation(libs.typesafe.config)
    
    // JSON Processing
    implementation(libs.jackson.databind)
    implementation(libs.jackson.module.kotlin)
    
    // Selenium
    implementation(libs.selenium.java)
    implementation(libs.selenium.chrome.driver)
    implementation(libs.selenium.support)
    
    // WebDriverManager
    implementation(libs.webdrivermanager)
    
    // Logging
    implementation(libs.logback.classic)
    implementation(libs.kotlin.logging3)
    
    // OpenCV
    implementation(libs.opencv)
    
    // Config
    implementation(libs.typesafe.config)
    
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.foundation)
    
    // JSON Serialization
    implementation(libs.kotlinx.serialization.json16)
    
    // HTTP Client
    implementation(libs.okhttp)
    
    // JSON Serialization (older version)
    implementation(libs.kotlinx.serialization.json13)
    
    // Logging (older version)
    implementation(libs.kotlin.logging2)
    
    // Ktor client dependencies
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.cio)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.ktor.client.json)
    implementation(libs.ktor.client.apache)
}

compose.desktop {
    application {
        mainClass = "com.klever.desktop.AppKt"

        // Use explicit configuration for nativeDistributions
        nativeDistributions {
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Exe)
            packageName = "KleverDesktop"
            packageVersion = appVersion
            
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

// Simple version print task - configuration cache compatible
tasks.register("printVersion") {
    // Disable configuration cache for this task
    notCompatibleWithConfigurationCache("This task uses script properties and println")

    doLast {
        println(appVersion)
    }
}