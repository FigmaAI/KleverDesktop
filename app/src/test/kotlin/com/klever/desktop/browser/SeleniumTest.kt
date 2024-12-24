package com.klever.desktop.browser

import javafx.application.Platform
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeAll
import org.junit.jupiter.api.AfterAll
import org.junit.jupiter.api.TestInstance

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SeleniumTest {
    private lateinit var controller: SeleniumController
    
    @BeforeAll
    fun setupJavaFX() {
        try {
            Platform.startup {}
        } catch (e: IllegalStateException) {
            // JavaFX runtime already initialized
        }
    }
    
    @BeforeEach
    fun setup() {
        controller = SeleniumController()
        controller.initialize()
    }
    
    @Test
    fun testFigmaPrototype() {
        try {
            println("Figma 프로토타입 열기...")
            val figmaUrl = "https://www.figma.com/proto/nhNFQGV8GMenTxMpKd6OdY/Android-Travel-App-Community?node-id=11-1273"
            controller.openFigmaPrototype(figmaUrl, null)
            
            println("초기 로딩 대기 중... (10초)")
            Thread.sleep(10000)
            
            println("캔버스 크기 확인 중...")
            val (width, height) = controller.getCanvasSize()
            println("캔버스 크기: ${width}x${height}")
            
            println("스크린샷 캡처 중...")
            controller.takeScreenshot(0, 0, width, height, "test_screenshot.png")
            println("스크린샷 저장됨: test_screenshot.png")
            
            println("중앙 지점 탭 테스트...")
            val centerX = width / 2
            val centerY = height / 2
            controller.tap(centerX, centerY)
            println("탭 완료: ($centerX, $centerY)")
            
        } catch (e: Exception) {
            println("오류 발생: ${e.message}")
            e.printStackTrace()
            throw e
        }
    }
    
    @AfterEach
    fun tearDown() {
        controller.close()
    }
    
    @AfterAll
    fun cleanupJavaFX() {
        Platform.exit()
    }
} 