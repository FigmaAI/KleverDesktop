package com.grabtaxi.klever.browser

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
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.nio.file.Path
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.nio.file.Files
import java.nio.file.StandardCopyOption

private val logger = KotlinLogging.logger {}

class SeleniumController(
    private val url: String,
    private val password: String? = null,
    private val screenWidth: Int? = null,
    private val screenHeight: Int? = null
) {
    private var driver: WebDriver? = null
    private var wait: WebDriverWait? = null
    
    fun initialize() {
        try {
            logger.info { "Starting browser initialization..." }
            
            // Improve WebDriverManager setup
            try {
                // Set cache path (store in user home directory)
                val wdmCachePath = Path.of(
                    System.getProperty("user.home"),
                    ".kleverdesktop",
                    "webdriver"
                ).toString()
                
                System.setProperty("wdm.cachePath", wdmCachePath)
                
                // Increase timeout settings
                System.setProperty("wdm.timeout", "60")
                
                // Configure logging
                System.setProperty("wdm.log", "true")
                
                // Setup Chrome driver
                WebDriverManager.chromedriver()
                    .clearDriverCache() // Prevent cache issues
                    .clearResolutionCache() // Prevent resolution cache issues
                    .setup()
                
                logger.info { "WebDriverManager setup completed successfully" }
            } catch (e: Exception) {
                logger.error(e) { "WebDriverManager setup failed, attempting fallback: ${e.message}" }
                
                // Fallback: Try to find ChromeDriver in system PATH
                val chromeDriverPath = findChromeDriverInPath()
                if (chromeDriverPath != null) {
                    System.setProperty("webdriver.chrome.driver", chromeDriverPath)
                    logger.info { "Using ChromeDriver from PATH: $chromeDriverPath" }
                } else {
                    logger.error { "ChromeDriver not found in PATH, will rely on WebDriverManager" }
                    // Try default WebDriverManager setup
                    WebDriverManager.chromedriver().setup()
                }
            }
            
            logger.debug { "Setting up Chrome options..." }
            val userDataDir = when {
                System.getProperty("os.name").lowercase().contains("win") -> {
                    // Windows path
                    Path.of(
                        System.getProperty("user.home"),
                        "AppData",
                        "Local",
                        "KleverDesktop",
                        "User_Data"
                    ).toFile()
                }
                System.getProperty("os.name").lowercase().contains("mac") -> {
                    // macOS path
                    Path.of(
                        System.getProperty("user.home"),
                        "Library",
                        "Application Support",
                        "KleverDesktop",
                        "User_Data"
                    ).toFile()
                }
                else -> {
                    // Linux and other OS paths
                    Path.of(
                        System.getProperty("user.home"),
                        ".kleverdesktop",
                        "User_Data"
                    ).toFile()
                }
            }

            // Create directory if it doesn't exist
            if (!userDataDir.exists()) {
                userDataDir.mkdirs()
                logger.debug { "Created user data directory: ${userDataDir.absolutePath}" }
            }
            
            val options = ChromeOptions().apply {
                // Common options
                addArguments("--remote-allow-origins=*")
                addArguments("--user-data-dir=${userDataDir.absolutePath}")
                addArguments("disable-blink-features=AutomationControlled")
                setExperimentalOption("detach", true)
                
                // Add platform-specific options
                when {
                    System.getProperty("os.name").lowercase().contains("win") -> {
                        // Windows-specific options
                        addArguments("--start-maximized")
                        // Additional options needed for Windows
                        addArguments("--disable-gpu") // Prevent GPU acceleration issues on Windows
                        addArguments("--no-sandbox") // Required in some Windows environments
                    }
                    System.getProperty("os.name").lowercase().contains("mac") -> {
                        // macOS-specific options
                        addArguments("--start-maximized")
                        // Additional options needed for macOS
                    }
                    else -> {
                        // Linux and other OS-specific options
                        addArguments("--start-maximized")
                        addArguments("--no-sandbox")
                    }
                }
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
            // Check if the password form is present
            val passwordForm = try {
                wait?.until(
                    ExpectedConditions.presenceOfElementLocated(By.id("link-password-form"))
                ) ?: return
            } catch (e: TimeoutException) {
                return
            }
            
            // Enter the password
            val passwordInput = passwordForm.findElement(By.name("password"))
                ?: throw RuntimeException("Password input field not found")
            passwordInput.sendKeys(password)
            
            // Submit the password
            val continueButton = passwordForm.findElement(
                By.xpath("//button[@type='submit']")
            ) ?: throw RuntimeException("Submit button not found")
            continueButton.click()
            
            // Wait for the page to load
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
    fun getCanvasElement(): WebElement {
        return wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")))
            ?: throw RuntimeException("Canvas element not found")
    }

    // Mouse/Keyboard Actions
    fun tap(x: Int, y: Int) {
        try {
            val canvas = getCanvasElement()
            val rect = canvas.rect
            
            // Calculate the actual coordinates considering the canvas's position
            val actualX = rect.x + x
            val actualY = rect.y + y
            
            logger.info { "[MOUSE] Tap Action Details:" }
            logger.info { "  Canvas Info:" }
            logger.info { "    - Position: (${rect.x}, ${rect.y})" }
            logger.info { "    - Size: ${rect.width}x${rect.height}" }
            logger.info { "  Coordinates:" }
            logger.info { "    - Requested: ($x, $y)" }
            logger.info { "    - Actual: ($actualX, $actualY)" }
            
            val actions = Actions(driver!!)
            actions
                .moveByOffset(actualX, actualY)
                .click()
                .moveByOffset(-actualX, -actualY)
                .perform()
                
            logger.info { "[OK] Tap action completed successfully" }
            Thread.sleep(500)
        } catch (e: Exception) {
            logger.error(e) { "[ERROR] Tap action failed at ($x, $y): ${e.message}" }
            throw RuntimeException("Tap action failed", e)
        }
    }

    fun longPress(x: Int, y: Int, duration: Long = 1000) {
        try {
            val canvas = getCanvasElement()
            val rect = canvas.rect
            
            val actualX = rect.x + x
            val actualY = rect.y + y
            
            val actions = Actions(driver!!)
            actions
                .moveByOffset(actualX, actualY)
                .clickAndHold()
                .pause(Duration.ofMillis(duration))
                .release()
                .moveByOffset(-actualX, -actualY)
                .perform()
                
            Thread.sleep(500)
        } catch (e: Exception) {
            logger.error(e) { "Failed to perform long press at ($x, $y): ${e.message}" }
            throw RuntimeException("Long press action failed", e)
        }
    }

    fun swipe(x: Int, y: Int, direction: SwipeDirection, distance: SwipeDistance = SwipeDistance.MEDIUM) {
        try {
            val canvas = getCanvasElement()
            val rect = canvas.rect
            
            val actualX = rect.x + x
            val actualY = rect.y + y
            
            // Calculate the swipe distance
            val (offsetX, offsetY) = when (direction) {
                SwipeDirection.UP -> Pair(0, -(rect.height * distance.factor).toInt())
                SwipeDirection.DOWN -> Pair(0, (rect.height * distance.factor).toInt())
                SwipeDirection.LEFT -> Pair(-(rect.width * distance.factor).toInt(), 0)
                SwipeDirection.RIGHT -> Pair((rect.width * distance.factor).toInt(), 0)
            }
            
            logger.info { "👆 Swipe Action Details:" }
            logger.info { "  Canvas Info:" }
            logger.info { "    - Position: (${rect.x}, ${rect.y})" }
            logger.info { "    - Size: ${rect.width}x${rect.height}" }
            logger.info { "  Movement:" }
            logger.info { "    - Start: ($actualX, $actualY)" }
            logger.info { "    - Direction: $direction" }
            logger.info { "    - Distance Factor: ${distance.factor}" }
            logger.info { "    - Offset: ($offsetX, $offsetY)" }
            logger.info { "    - End: (${actualX + offsetX}, ${actualY + offsetY})" }
            
            val actions = Actions(driver!!)
            actions
                .moveByOffset(actualX, actualY)
                .clickAndHold()
                .pause(Duration.ofMillis(200))
                .moveByOffset(offsetX, offsetY)
                .pause(Duration.ofMillis(200))
                .release()
                .moveByOffset(-actualX - offsetX, -actualY - offsetY)
                .perform()
                
            logger.info { "✅ Swipe action completed successfully" }
            Thread.sleep(500)
        } catch (e: Exception) {
            logger.error(e) { "❌ Swipe action failed at ($x, $y): ${e.message}" }
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
    fun takeScreenshot(x: Int, y: Int, width: Int, height: Int, outputPath: String): File {
        try {
            // Find the canvas element
            val canvas = wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")))
                ?: throw RuntimeException("Canvas element not found")
            
            // Get the screenshot of the canvas
            val screenshot = canvas.getScreenshotAs(OutputType.BYTES)
            
            // Convert ByteArray to BufferedImage
            val img = ImageIO.read(ByteArrayInputStream(screenshot))
            
            // Log dimensions for debugging
            logger.info { "[INFO] Screenshot dimensions:" }
            logger.info { "  - Original image: ${img.width}x${img.height}" }
            logger.info { "  - Requested crop: ($x, $y) ${width}x$height" }
            
            // Validate coordinates
            if (x < 0 || y < 0 || x + width > img.width || y + height > img.height) {
                throw IllegalArgumentException(
                    "Invalid crop coordinates: ($x, $y, $width, $height) " +
                    "for image size: (${img.width}, ${img.height})"
                )
            }
            
            // Crop the image to the specified area
            val croppedImg = img.getSubimage(x, y, width, height)
            
            // Save the file
            val file = File(outputPath)
            file.parentFile?.mkdirs()
            ImageIO.write(croppedImg, "png", file)
            
            logger.info { "[OK] Screenshot saved to: $outputPath" }
            return file
            
        } catch (e: Exception) {
            logger.error(e) { "[ERROR] Failed to take screenshot: ${e.message}" }
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

    fun getCurrentUrl(): String? {
        return driver?.currentUrl
    }

    fun getCurrentActiveNodeId(): String? {
        try {
            val currentUrl = driver?.currentUrl ?: return null
            
            // Extract node-id from URL
            val nodeIdMatch = Regex("""node-id=([^&]+)""").find(currentUrl)
            if (nodeIdMatch != null) {
                // Convert format from 11-1403 to 11:1403
                return nodeIdMatch.groupValues[1].replace("-", ":")
            }
            
            return null
        } catch (e: Exception) {
            logger.error(e) { "Failed to get current active node ID: ${e.message}" }
            return null
        }
    }

    // Canvas size related methods
    fun getCanvasSize(): Pair<Int, Int> {
        try {
            val canvas = getCanvasElement()
            val rect = canvas.rect
            return Pair(rect.width.toInt(), rect.height.toInt())
        } catch (e: Exception) {
            logger.error(e) { "Failed to get canvas size: ${e.message}" }
            throw RuntimeException("Failed to get canvas size", e)
        }
    }

    // Helper method to find ChromeDriver in system PATH
    private fun findChromeDriverInPath(): String? {
        val isWindows = System.getProperty("os.name").lowercase().contains("win")
        val chromeDriverName = if (isWindows) "chromedriver.exe" else "chromedriver"
        
        val pathEnv = System.getenv("PATH") ?: return null
        val pathSeparator = if (isWindows) ";" else ":"
        
        return pathEnv.split(pathSeparator)
            .map { File(it, chromeDriverName) }
            .firstOrNull { it.exists() && it.canExecute() }
            ?.absolutePath
    }
} 