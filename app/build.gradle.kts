plugins {
    kotlin("jvm")
    id("org.openjfx.javafxplugin")
    application
}

group = "com.klever.desktop"
version = "1.0-SNAPSHOT"

dependencies {
    // Kotlin
    implementation("org.jetbrains.kotlin:kotlin-stdlib")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    
    // JavaFX
    implementation("org.openjfx:javafx-controls:21.0.1")
    implementation("org.openjfx:javafx-fxml:21.0.1")
    
    // Selenium
    implementation("org.seleniumhq.selenium:selenium-java:4.18.1")
    implementation("io.github.bonigarcia:webdrivermanager:5.6.3")
    
    // WebSocket
    implementation("org.java-websocket:Java-WebSocket:1.5.4")
    
    // JSON 처리
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin:2.15.3")
    
    // 로깅
    implementation("ch.qos.logback:logback-classic:1.4.14")
    
    // 테스트
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
    testImplementation("io.mockk:mockk:1.13.9")
}

javafx {
    version = "21.0.1"
    modules = listOf("javafx.controls", "javafx.fxml")
}

application {
    mainClass.set("com.klever.desktop.AppKt")
}

tasks.test {
    useJUnitPlatform()
}