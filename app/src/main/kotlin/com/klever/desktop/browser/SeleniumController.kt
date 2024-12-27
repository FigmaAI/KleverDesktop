package com.klever.desktop.browser

import io.github.bonigarcia.wdm.WebDriverManager
import org.openqa.selenium.*
import org.openqa.selenium.chrome.ChromeDriver
import org.openqa.selenium.chrome.ChromeOptions
import org.openqa.selenium.interactions.Actions
import org.openqa.selenium.support.ui.ExpectedConditions
import org.openqa.selenium.support.ui.WebDriverWait
import java.time.Duration
import mu.KotlinLogging
import org.opencv.core.Point
import org.opencv.core.Scalar
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import java.io.File
import javax.imageio.ImageIO
import java.awt.Rectangle
import java.awt.Robot
import java.awt.Toolkit

private val logger = KotlinLogging.logger {}

class SeleniumController(
    private val url: String,
    private val password: String? = null
) {
    private var driver: WebDriver? = null
    private var wait: WebDriverWait? = null
    
    fun initialize() {
        try {
            logger.info { "Starting browser initialization..." }
            WebDriverManager.chromedriver().setup()
            
            logger.debug { "Setting up Chrome options..." }
            val options = ChromeOptions().apply {
                addArguments("--start-maximized")
                addArguments("--remote-allow-origins=*")
                addArguments("user-data-dir=./User_Data")
                addArguments("disable-blink-features=AutomationControlled")
                setExperimentalOption("detach", true)
            }
            
            logger.info { "Creating ChromeDriver instance..." }
            driver = ChromeDriver(options)
            wait = WebDriverWait(driver!!, Duration.ofSeconds(10))
            
            logger.info { "Navigating to URL: $url" }
            driver?.get(url)
            
            // Handle password protection if needed
            logger.info { "Checking for password protection..." }
            handlePasswordProtection()
            
            logger.info { "Browser initialization completed successfully" }
            
        } catch (e: Exception) {
            logger.error(e) { "Failed to initialize browser: ${e.message}" }
            logger.error { "Stack trace: ${e.stackTraceToString()}" }
            throw RuntimeException("Browser initialization failed", e)
        }
    }
    
    private fun handlePasswordProtection() {
        if (password == null) return
        
        try {
            // 짧은 대기 시간으로 패스워드 폼 확인
            val passwordForm = try {
                wait?.until(
                    ExpectedConditions.presenceOfElementLocated(By.id("link-password-form"))
                ) ?: return
            } catch (e: TimeoutException) {
                return
            }
            
            // 패스워드 입력
            val passwordInput = passwordForm.findElement(By.name("password"))
                ?: throw RuntimeException("Password input field not found")
            passwordInput.sendKeys(password)
            
            // 제출
            val continueButton = passwordForm.findElement(
                By.xpath("//button[@type='submit']")
            ) ?: throw RuntimeException("Submit button not found")
            continueButton.click()
            
            // 페이지 로딩 대기
            Thread.sleep(2000)
            
        } catch (e: Exception) {
            if (e is TimeoutException) return
            throw RuntimeException("Failed to handle password protection", e)
        }
    }

    fun close() {
        try {
            driver?.quit()
            driver = null
            wait = null
        } catch (e: Exception) {
            logger.error(e) { "Error closing browser: ${e.message}" }
        }
    }

    // Canvas related functions
    fun getCanvasSize(): Pair<Int, Int> {
        try {
            wait = WebDriverWait(driver!!, Duration.ofSeconds(20))
            val canvas = wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")))
                ?: throw RuntimeException("Canvas element not found")
                
            val style = canvas.getAttribute("style")
                ?: throw RuntimeException("Canvas style not found")
                
            logger.debug { "Canvas style: $style" }
            
            val widthMatch = Regex("""width: (\d+(?:\.\d+)?)px""").find(style)
            val heightMatch = Regex("""height: (\d+(?:\.\d+)?)px""").find(style)
            
            if (widthMatch == null || heightMatch == null) {
                throw RuntimeException("Cannot find width or height in style attribute")
            }
            
            val width = widthMatch.groupValues[1].toFloat().toInt()
            val height = heightMatch.groupValues[1].toFloat().toInt()
            
            return Pair(width, height)
        } catch (e: Exception) {
            throw RuntimeException("Failed to get canvas size: ${e.message}")
        }
    }

    // Mouse/Keyboard Actions
    fun tap(x: Int, y: Int) {
        try {
            val actions = Actions(driver!!)
            actions.moveByOffset(x, y)
                .click()
                .moveByOffset(-x, -y)  // Reset position
                .perform()
        } catch (e: Exception) {
            logger.error(e) { "Failed to perform tap at ($x, $y): ${e.message}" }
            throw RuntimeException("Tap action failed", e)
        }
    }

    fun longPress(x: Int, y: Int, duration: Long = 1000) {
        try {
            val actions = Actions(driver!!)
            actions.moveByOffset(x, y)
                .clickAndHold()
                .pause(duration)
                .release()
                .moveByOffset(-x, -y)  // Reset position
                .perform()
        } catch (e: Exception) {
            logger.error(e) { "Failed to perform long press at ($x, $y): ${e.message}" }
            throw RuntimeException("Long press action failed", e)
        }
    }

    fun swipe(x: Int, y: Int, direction: SwipeDirection, distance: SwipeDistance = SwipeDistance.MEDIUM) {
        try {
            val (width, height) = getCanvasSize()
            val offset = when (direction) {
                SwipeDirection.UP -> Pair(0, -height * distance.factor)
                SwipeDirection.DOWN -> Pair(0, height * distance.factor)
                SwipeDirection.LEFT -> Pair(-width * distance.factor, 0)
                SwipeDirection.RIGHT -> Pair(width * distance.factor, 0)
            }

            val actions = Actions(driver!!)
            actions.moveByOffset(x, y)
                .clickAndHold()
                .moveByOffset(offset.first.toInt(), offset.second.toInt())
                .release()
                .moveByOffset(-x - offset.first.toInt(), -y - offset.second.toInt())  // Reset position
                .perform()
        } catch (e: Exception) {
            logger.error(e) { "Failed to perform swipe at ($x, $y): ${e.message}" }
            throw RuntimeException("Swipe action failed", e)
        }
    }

    fun inputText(text: String) {
        try {
            val actions = Actions(driver!!)
            actions.sendKeys(text).perform()
        } catch (e: Exception) {
            logger.error(e) { "Failed to input text: ${e.message}" }
            throw RuntimeException("Text input failed", e)
        }
    }

    // Supporting enums for swipe actions
    enum class SwipeDirection {
        UP, DOWN, LEFT, RIGHT
    }

    enum class SwipeDistance(val factor: Double) {
        SHORT(0.1),
        MEDIUM(0.2),
        LONG(0.3)
    }

    // Screenshot & Image Processing
    fun takeScreenshot(outputPath: String): File {
        try {
            // 전체 화면 캡처
            val screenRect = Rectangle(Toolkit.getDefaultToolkit().screenSize)
            val capture = Robot().createScreenCapture(screenRect)
            
            // 파일 저장
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            ImageIO.write(capture, "png", file)
            
            logger.info { "Screenshot saved to: $outputPath" }
            return file
        } catch (e: Exception) {
            logger.error(e) { "Failed to take screenshot: ${e.message}" }
            throw RuntimeException("Screenshot failed", e)
        }
    }

    fun drawBoundingBox(
        imagePath: String,
        predictions: List<UIElementPrediction>,
        outputPath: String,
        darkMode: Boolean = false
    ) {
        try {
            val image = Imgcodecs.imread(imagePath)
            var count = 1
            
            predictions.forEach { prediction ->
                try {
                    val left = (prediction.x - prediction.width / 2).toInt()
                    val top = (prediction.y - prediction.height / 2).toInt()
                    val right = (prediction.x + prediction.width / 2).toInt()
                    val bottom = (prediction.y + prediction.height / 2).toInt()
                    
                    // Draw rectangle
                    val color = if (darkMode) 
                        Scalar(255.0, 250.0, 250.0) 
                    else 
                        Scalar(10.0, 10.0, 10.0)
                    
                    Imgproc.rectangle(
                        image,
                        Point(left.toDouble(), top.toDouble()),
                        Point(right.toDouble(), bottom.toDouble()),
                        color,
                        2
                    )
                    
                    // Add label
                    Imgproc.putText(
                        image,
                        count.toString(),
                        Point(left.toDouble(), (top - 10).toDouble()),
                        Imgproc.FONT_HERSHEY_SIMPLEX,
                        0.9,
                        color,
                        2
                    )
                    
                    count++
                } catch (e: Exception) {
                    logger.error(e) { "Error drawing bounding box for prediction: ${e.message}" }
                }
            }
            
            Imgcodecs.imwrite(outputPath, image)
        } catch (e: Exception) {
            logger.error(e) { "Failed to draw bounding boxes: ${e.message}" }
            throw RuntimeException("Drawing bounding boxes failed", e)
        }
    }

    // Data class for UI element predictions
    data class UIElementPrediction(
        val x: Double,
        val y: Double,
        val width: Double,
        val height: Double,
        val detectionId: String
    )

    // Canvas Navigation & Node Management
    fun findCanvasId(nodeId: String, nodes: List<Map<String, Any>>, canvasId: String? = null): String? {
        for (node in nodes) {
            if (node["type"] == "CANVAS") {
                val currentCanvasId = node["id"] as String
                logger.debug { "Found canvas with ID: $currentCanvasId" }
            }
            
            if (node["id"] == nodeId) {
                return canvasId
            }
            
            @Suppress("UNCHECKED_CAST")
            val children = node["children"] as? List<Map<String, Any>>
            if (children != null) {
                val foundCanvasId = findCanvasId(nodeId, children, canvasId)
                if (foundCanvasId != null) {
                    return foundCanvasId
                }
            }
        }
        return null
    }

    fun findNodeById(nodeId: String, nodes: List<Map<String, Any>>): Map<String, Any>? {
        for (node in nodes) {
            if (node["id"] == nodeId) {
                return node
            }
            
            @Suppress("UNCHECKED_CAST")
            val children = node["children"] as? List<Map<String, Any>>
            if (children != null) {
                val foundNode = findNodeById(nodeId, children)
                if (foundNode != null) {
                    return foundNode
                }
            }
        }
        return null
    }

    fun listAllDevices(nodeId: String, nodes: List<Map<String, Any>>): List<String> {
        val deviceList = mutableListOf<String>()
        val canvasId = findCanvasId(nodeId, nodes)
        
        for (node in nodes) {
            if (node["id"] == canvasId) {
                deviceList.add(node.getOrDefault("prototypeDevice", "N/A") as String)
                return deviceList
            }
            
            @Suppress("UNCHECKED_CAST")
            val children = node["children"] as? List<Map<String, Any>>
            if (children != null) {
                listAllDevices(canvasId ?: "", children)
            }
        }
        
        return deviceList
    }

    // UI Element Processing
    data class UIElement(
        val uid: String,
        val bbox: List<List<Int>>
    ) {
        companion object {
            fun createElemList(predictions: List<UIElementPrediction>): List<UIElement> {
                return predictions.map { prediction ->
                    UIElement(
                        uid = prediction.detectionId,
                        bbox = listOf(
                            listOf(
                                (prediction.x - prediction.width / 2).toInt(),
                                (prediction.y - prediction.height / 2).toInt()
                            ),
                            listOf(
                                (prediction.x + prediction.width / 2).toInt(),
                                (prediction.y + prediction.height / 2).toInt()
                            )
                        )
                    )
                }
            }

            fun processNodeData(nodeData: Map<String, Any>): List<UIElement> {
                val elemList = mutableListOf<UIElement>()
                
                @Suppress("UNCHECKED_CAST")
                val rootBbox = nodeData["absoluteBoundingBox"] as Map<String, Double>
                
                fun convertNodeToUIElement(node: Map<String, Any>): UIElement {
                    @Suppress("UNCHECKED_CAST")
                    val nodeBbox = node["absoluteBoundingBox"] as Map<String, Double>
                    
                    return UIElement(
                        uid = node["id"] as String,
                        bbox = listOf(
                            listOf(
                                (nodeBbox["x"]!! - rootBbox["x"]!!).toInt(),
                                (nodeBbox["y"]!! - rootBbox["y"]!!).toInt()
                            ),
                            listOf(
                                (nodeBbox["x"]!! - rootBbox["x"]!! + nodeBbox["width"]!!).toInt(),
                                (nodeBbox["y"]!! - rootBbox["y"]!! + nodeBbox["height"]!!).toInt()
                            )
                        )
                    )
                }

                val nodesToProcess = mutableListOf(nodeData)
                while (nodesToProcess.isNotEmpty()) {
                    val node = nodesToProcess.removeAt(0)
                    
                    if (node["visible"] as? Boolean != false) {
                        if (node["type"] in listOf("FRAME", "INSTANCE", "COMPONENT", "GROUP")) {
                            elemList.add(convertNodeToUIElement(node))
                        }
                        
                        @Suppress("UNCHECKED_CAST")
                        val children = node["children"] as? List<Map<String, Any>>
                        if (children != null) {
                            nodesToProcess.addAll(children)
                        }
                    }
                }
                
                return elemList
            }
        }
    }
} 