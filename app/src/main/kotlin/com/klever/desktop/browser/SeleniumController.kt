package com.klever.desktop.browser

import org.openqa.selenium.*
import org.openqa.selenium.interactions.Actions
import org.openqa.selenium.support.ui.ExpectedConditions
import org.openqa.selenium.support.ui.WebDriverWait
import java.time.Duration
import mu.KotlinLogging
import java.io.File
import javax.imageio.ImageIO
import java.awt.Color
import java.awt.Font
import java.awt.Graphics2D
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.awt.BasicStroke
import java.awt.Rectangle
import java.awt.Robot
import java.awt.Toolkit
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.Base64
import java.nio.file.Path

private val logger = KotlinLogging.logger {}

class SeleniumController(
    private val url: String,
    private val password: String? = null,
    private val screenWidth: Int? = null,
    private val screenHeight: Int? = null
) {
    private var driver: WebDriver? = null
    private var wait: WebDriverWait? = null
    private var browserDriver: BrowserDriver? = null
    
    fun initialize() {
        try {
            logger.info { "Starting browser initialization..." }
            
            // Load browser configuration
            val browserConfigRepo = com.klever.desktop.server.repositories.BrowserConfigRepository()
            val browserConfig = browserConfigRepo.loadConfig()
            
            // Detect and create browser driver based on config
            browserDriver = if (browserConfig != null && !browserConfig.autoDetect) {
                logger.info { "Using configured browser: ${browserConfig.browserType.displayName}" }
                BrowserFactory.getBrowserDriver(browserConfig.browserType)
                    ?: run {
                        logger.warn { "Configured browser ${browserConfig.browserType.displayName} not available, falling back to auto-detect" }
                        BrowserFactory.createBrowserDriver()
                    }
            } else {
                logger.info { "Auto-detecting browser..." }
                BrowserFactory.createBrowserDriver()
            }
            
            logger.info { "Using browser: ${browserDriver!!.getBrowserType().displayName}" }
            
            // Setup the browser driver (download/configure driver executable)
            browserDriver!!.setupDriver()
            
            // Determine user data directory based on platform
            val userDataDir = when {
                System.getProperty("os.name").lowercase().contains("win") -> {
                    Path.of(
                        System.getProperty("user.home"),
                        "AppData",
                        "Local",
                        "KleverDesktop",
                        "User_Data_${browserDriver!!.getBrowserType().name}"
                    ).toFile()
                }
                System.getProperty("os.name").lowercase().contains("mac") -> {
                    Path.of(
                        System.getProperty("user.home"),
                        "Library",
                        "Application Support",
                        "KleverDesktop",
                        "User_Data_${browserDriver!!.getBrowserType().name}"
                    ).toFile()
                }
                else -> {
                    Path.of(
                        System.getProperty("user.home"),
                        ".kleverdesktop",
                        "User_Data_${browserDriver!!.getBrowserType().name}"
                    ).toFile()
                }
            }
            
            logger.info { "Creating ${browserDriver!!.getBrowserType().displayName} WebDriver instance..." }
            driver = browserDriver!!.createDriver(userDataDir)
            wait = WebDriverWait(driver!!, Duration.ofSeconds(10))
            
            // Set window size
            if (screenWidth != null && screenHeight != null) {
                logger.info { "Setting window size to ${screenWidth}x${screenHeight}" }
                driver?.manage()?.window()?.size = Dimension(screenWidth, screenHeight)
            } else {
                logger.info { "Maximizing window to full screen" }
                driver?.manage()?.window()?.maximize()
            }
            
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
            
            logger.info { "[SCREENSHOT] Starting screenshot capture..." }
            logger.info { "[SCREENSHOT] Target crop area: ($x, $y) ${width}x${height}" }
            
            // CRITICAL: Wait for canvas to fully render
            // Figma uses WebGL which needs time to render
            logger.info { "[SCREENSHOT] Waiting for canvas to render..." }
            Thread.sleep(1000)  // Give canvas time to render
            
            // Check if canvas is actually rendered and has content
            val jsExecutor = driver as JavascriptExecutor
            val canvasInfo = jsExecutor.executeScript(
                """
                var canvas = arguments[0];
                var ctx = canvas.getContext('2d') || canvas.getContext('webgl') || canvas.getContext('webgl2');
                return {
                    width: canvas.width,
                    height: canvas.height,
                    offsetWidth: canvas.offsetWidth,
                    offsetHeight: canvas.offsetHeight,
                    hasContext: ctx !== null,
                    contextType: ctx ? (canvas.getContext('webgl') ? 'webgl' : 'webgl2' ? 'webgl2' : '2d') : 'none'
                };
                """.trimIndent(),
                canvas
            ) as Map<*, *>
            
            logger.info { "[SCREENSHOT] Canvas info: $canvasInfo" }
            
            // Try different screenshot methods based on reliability
            // Chrome/Edge: canvas.getScreenshotAs() works well (Method 1)
            // Safari: Needs full page screenshot + crop (Method 2)
            val img = try {
                // Method 1: Direct Selenium screenshot of canvas element (BEST for Chrome/Edge)
                logger.info { "[SCREENSHOT] Method 1: Trying Selenium canvas.getScreenshotAs()..." }
                val screenshot = canvas.getScreenshotAs(OutputType.BYTES)
                val image = ImageIO.read(ByteArrayInputStream(screenshot))
                
                if (image == null) {
                    throw Exception("ImageIO.read returned null")
                }
                
                logger.info { "[SCREENSHOT] ✓ Method 1 succeeded: ${image.width}x${image.height}" }
                image
            } catch (method1Error: Exception) {
                logger.warn { "[SCREENSHOT] ✗ Method 1 failed: ${method1Error.javaClass.simpleName}: ${method1Error.message}" }
                
                try {
                    // Method 2: Full page screenshot + crop (FALLBACK for Safari/WebGL)
                    logger.info { "[SCREENSHOT] Method 2: Trying full page screenshot + crop..." }
                    val fullScreenshot = (driver as TakesScreenshot).getScreenshotAs(OutputType.BYTES)
                    val fullImage = ImageIO.read(ByteArrayInputStream(fullScreenshot))
                    
                    if (fullImage == null) {
                        throw Exception("Full page screenshot returned null")
                    }
                    
                    // Get canvas position and size
                    val rect = canvas.rect
                    val canvasX = rect.x
                    val canvasY = rect.y
                    val canvasWidth = rect.width
                    val canvasHeight = rect.height
                    
                    logger.info { "[SCREENSHOT] Canvas rect: position=($canvasX, $canvasY), size=${canvasWidth}x${canvasHeight}" }
                    logger.info { "[SCREENSHOT] Full page size: ${fullImage.width}x${fullImage.height}" }
                    
                    // Validate crop area
                    if (canvasX < 0 || canvasY < 0 || canvasX + canvasWidth > fullImage.width || canvasY + canvasHeight > fullImage.height) {
                        throw Exception("Canvas area ($canvasX, $canvasY, ${canvasWidth}x${canvasHeight}) exceeds full image (${fullImage.width}x${fullImage.height})")
                    }
                    
                    // Crop to canvas area
                    val croppedCanvas = fullImage.getSubimage(canvasX, canvasY, canvasWidth, canvasHeight)
                    logger.info { "[SCREENSHOT] ✓ Method 2 succeeded: ${croppedCanvas.width}x${croppedCanvas.height}" }
                    
                    // Check if image is blank (may indicate rendering issue)
                    val isBlank = isImageBlank(croppedCanvas)
                    if (isBlank) {
                        logger.warn { "[SCREENSHOT] WARNING: Image appears blank! Retrying after delay..." }
                        Thread.sleep(2000)
                        
                        val retryScreenshot = (driver as TakesScreenshot).getScreenshotAs(OutputType.BYTES)
                        val retryImage = ImageIO.read(ByteArrayInputStream(retryScreenshot))
                        retryImage?.getSubimage(canvasX, canvasY, canvasWidth, canvasHeight) ?: croppedCanvas
                    } else {
                        croppedCanvas
                    }
                } catch (method2Error: Exception) {
                    logger.warn { "[SCREENSHOT] ✗ Method 2 failed: ${method2Error.javaClass.simpleName}: ${method2Error.message}" }
                    
                    // Method 3: JavaScript canvas.toDataURL() (LAST RESORT)
                    logger.info { "[SCREENSHOT] Method 3: Trying JavaScript canvas.toDataURL()..." }
                    
                    val base64Image = jsExecutor.executeScript(
                        """
                        var canvas = arguments[0];
                        try {
                            return canvas.toDataURL('image/png').substring(22);
                        } catch(e) {
                            console.error('toDataURL failed:', e);
                            return null;
                        }
                        """.trimIndent(),
                        canvas
                    ) as? String
                    
                    if (base64Image == null || base64Image.isEmpty()) {
                        throw Exception("All screenshot methods failed")
                    }
                    
                    val imageBytes = Base64.getDecoder().decode(base64Image)
                    val image = ImageIO.read(ByteArrayInputStream(imageBytes))
                    logger.info { "[SCREENSHOT] ✓ Method 3 succeeded: ${image?.width}x${image?.height}" }
                    image ?: throw Exception("Method 3: ImageIO.read returned null")
                }
            }
            
            if (img == null) {
                throw RuntimeException("All screenshot methods returned null")
            }
            
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
    
    /**
     * Check if an image is blank or mostly black
     * This helps detect rendering issues where canvas appears black
     */
    private fun isImageBlank(image: BufferedImage): Boolean {
        val sampleSize = minOf(100, image.width * image.height)  // Sample up to 100 pixels
        var blackPixelCount = 0
        val threshold = 30  // RGB values below this are considered "black"
        
        // Sample pixels evenly across the image
        val stepX = maxOf(1, image.width / 10)
        val stepY = maxOf(1, image.height / 10)
        var sampledPixels = 0
        
        for (y in 0 until image.height step stepY) {
            for (x in 0 until image.width step stepX) {
                val rgb = image.getRGB(x, y)
                val red = (rgb shr 16) and 0xFF
                val green = (rgb shr 8) and 0xFF
                val blue = rgb and 0xFF
                
                // Check if pixel is very dark/black
                if (red < threshold && green < threshold && blue < threshold) {
                    blackPixelCount++
                }
                sampledPixels++
                
                if (sampledPixels >= sampleSize) break
            }
            if (sampledPixels >= sampleSize) break
        }
        
        // If more than 95% of sampled pixels are black, consider image blank
        val blackRatio = blackPixelCount.toFloat() / sampledPixels
        val isBlank = blackRatio > 0.95f
        
        if (isBlank) {
            logger.warn { "[SCREENSHOT] Image appears blank: ${blackPixelCount}/${sampledPixels} pixels are black (${String.format("%.1f", blackRatio * 100)}%)" }
        }
        
        return isBlank
    }

    fun drawBoundingBox(
        imagePath: String,
        predictions: List<UIElementPrediction>,
        outputPath: String,
        darkMode: Boolean = false
    ) {
        try {
            // Read image (using Java AWT)
            val image: BufferedImage = ImageIO.read(File(imagePath))
            val g2d: Graphics2D = image.createGraphics()
            
            // Enable anti-aliasing (for smoother rendering)
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
            g2d.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON)
            
            // Set color
            val color = if (darkMode) {
                Color(255, 250, 250) // Light color (for dark mode)
            } else {
                Color(10, 10, 10) // Dark color
            }
            g2d.color = color
            g2d.stroke = BasicStroke(2.0f)
            
            var count = 1
            
            predictions.forEach { prediction ->
                try {
                    val left = (prediction.x - prediction.width / 2).toInt()
                    val top = (prediction.y - prediction.height / 2).toInt()
                    val width = prediction.width.toInt()
                    val height = prediction.height.toInt()
                    
                    // Draw rectangle
                    g2d.drawRect(left, top, width, height)
                    
                    // Add text label
                    g2d.font = Font("Arial", Font.BOLD, 24)
                    val label = count.toString()
                    
                    // Text background (for better readability)
                    val fontMetrics = g2d.fontMetrics
                    val textHeight = fontMetrics.height
                    
                    // Calculate text position (above the rectangle)
                    val textX = left
                    val textY = maxOf(top - 10, textHeight)
                    
                    // Draw text
                    g2d.drawString(label, textX, textY)
                    
                    count++
                } catch (e: Exception) {
                    logger.error(e) { "Error drawing bounding box for prediction: ${e.message}" }
                }
            }
            
            // Release Graphics2D resources
            g2d.dispose()
            
            // Save image
            ImageIO.write(image, "png", File(outputPath))
            
            logger.info { "Successfully drew $count bounding boxes to $outputPath" }
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

} 