package com.klever.desktop.browser

import io.github.bonigarcia.wdm.WebDriverManager
import org.openqa.selenium.By
import org.openqa.selenium.WebDriver
import org.openqa.selenium.chrome.ChromeDriver
import org.openqa.selenium.chrome.ChromeOptions
import org.openqa.selenium.support.ui.ExpectedConditions
import org.openqa.selenium.support.ui.WebDriverWait
import java.time.Duration
import org.openqa.selenium.OutputType
import java.io.File
import javax.imageio.ImageIO
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import org.openqa.selenium.interactions.Actions
import org.opencv.core.*
import org.opencv.imgcodecs.Imgcodecs
import org.opencv.imgproc.Imgproc
import org.openqa.selenium.JavascriptExecutor

class SeleniumController {
    private var driver: WebDriver? = null
    private var wait: WebDriverWait? = null
    
    fun initialize() {
        try {
            WebDriverManager.chromedriver().setup()
            
            val options = ChromeOptions().apply {
                addArguments("--start-maximized")
                addArguments("--remote-allow-origins=*")
            }
            
            driver = ChromeDriver(options)
            wait = WebDriverWait(driver!!, Duration.ofSeconds(10))
        } catch (e: Exception) {
            throw RuntimeException("Failed to initialize browser: ${e.message}")
        }
    }
    
    fun openFigmaPrototype(url: String, password: String?) {
        try {
            driver?.get(url)
            
            // 비밀번호가 있는 경우 처리
            password?.let { pwd ->
                wait?.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("input[type='password']")))
                    ?.sendKeys(pwd)
                driver?.findElement(By.cssSelector("button[type='submit']"))?.click()
            }
            
            // Figma 프로토타입이 로드될 때까지 대기
            // iframe이 로드될 때까지 대기
            wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("iframe")))
            
            // 필요한 경우 iframe으로 전환
            val iframe = driver?.findElement(By.tagName("iframe"))
            driver?.switchTo()?.frame(iframe)
            
            // 프로토타입 컨텐츠가 로드될 때까지 대기
            wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")))
        } catch (e: Exception) {
            throw RuntimeException("Failed to open Figma prototype: ${e.message}")
        }
    }
    
    fun takeScreenshot(x: Int, y: Int, width: Int, height: Int, savePath: String) {
        try {
            // Take a screenshot of the canvas element
            val canvas = driver?.findElement(By.tagName("canvas"))
            val screenshot = canvas?.getScreenshotAs(OutputType.BYTES)
                ?: throw RuntimeException("Failed to take screenshot")
            
            // Convert screenshot to BufferedImage
            val inputStream = ByteArrayInputStream(screenshot)
            val fullImage = ImageIO.read(inputStream)
            
            // Crop the image to specified area
            val croppedImage = fullImage.getSubimage(x, y, width, height)
            
            // Save the cropped image
            ImageIO.write(croppedImage, "PNG", File(savePath))
        } catch (e: Exception) {
            throw RuntimeException("Failed to take screenshot: ${e.message}")
        }
    }
    
    fun close() {
        try {
            driver?.quit()
            driver = null
            wait = null
        } catch (e: Exception) {
            println("Error while closing browser: ${e.message}")
        }
    }
    
    fun getCanvasSize(): Pair<Int, Int> {
        try {
            // Wait for canvas with longer timeout (20 seconds)
            wait = WebDriverWait(driver!!, Duration.ofSeconds(20))
            wait?.until(ExpectedConditions.presenceOfElementLocated(By.tagName("canvas")))
            
            val canvas = driver?.findElement(By.tagName("canvas"))
                ?: throw RuntimeException("Canvas element not found")
                
            val style = canvas.getAttribute("style")
                ?: throw RuntimeException("Canvas style not found")
                
            println("Canvas style: $style") // Debug log
            
            // Extract width and height using regex
            val widthMatch = Regex("""width: (\d+(?:\.\d+)?)px""").find(style)
            val heightMatch = Regex("""height: (\d+(?:\.\d+)?)px""").find(style)
            
            if (widthMatch == null || heightMatch == null) {
                throw RuntimeException("Cannot find width or height in the style attribute")
            }
            
            val width = widthMatch.groupValues[1].toFloat().toInt()
            val height = heightMatch.groupValues[1].toFloat().toInt()
            
            return Pair(width, height)
        } catch (e: Exception) {
            throw RuntimeException("Failed to get canvas size: ${e.message}")
        }
    }
    
    // Helper function to calculate device position in canvas
    fun calculatePosition(
        deviceWidth: Int,
        deviceHeight: Int,
        canvasWidth: Int,
        canvasHeight: Int
    ): Pair<Int, Int> {
        val x = (canvasWidth - deviceWidth) / 2
        val y = (canvasHeight - deviceHeight) / 2
        return Pair(x, y)
    }
    
    // Helper function to zoom out until canvas fits
    fun zoomOutUntilCanvasFits(deviceWidth: Int, deviceHeight: Int) {
        var (canvasWidth, canvasHeight) = getCanvasSize()
        
        while (canvasWidth < deviceWidth + 64 || canvasHeight < deviceHeight + 64) {
            // Cast driver to JavascriptExecutor
            val jsExecutor = driver as JavascriptExecutor
            jsExecutor.executeScript("document.body.style.zoom='80%'")
            
            // Refresh browser after zooming out
            driver?.navigate()?.refresh()
            
            // Wait for canvas and get new size
            val newSize = getCanvasSize()
            canvasWidth = newSize.first
            canvasHeight = newSize.second
        }
    }
    
    fun getCanvasBounds(): Pair<Pair<Int, Int>, Pair<Int, Int>> {
        val canvas = driver?.findElement(By.tagName("canvas"))
            ?: throw RuntimeException("Canvas not found")
            
        val location = canvas.location
        val size = canvas.size
        
        val topLeft = Pair(location.x, location.y)
        val bottomRight = Pair(location.x + size.width, location.y + size.height)
        
        return Pair(topLeft, bottomRight)
    }
    
    // Basic mouse events
    fun tap(x: Int, y: Int) {
        try {
            Actions(driver).apply {
                moveByOffset(x, y)
                click()
                moveByOffset(-x, -y)  // Reset mouse position
                perform()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to perform tap: ${e.message}")
        }
    }
    
    fun longPress(x: Int, y: Int, duration: Long = 1000) {
        try {
            Actions(driver).apply {
                moveByOffset(x, y)
                clickAndHold()
                pause(Duration.ofMillis(duration))
                release()
                moveByOffset(-x, -y)  // Reset mouse position
                perform()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to perform long press: ${e.message}")
        }
    }
    
    fun swipe(x: Int, y: Int, direction: SwipeDirection, dist: SwipeDistance = SwipeDistance.MEDIUM, quick: Boolean = false) {
        try {
            val (offsetX, offsetY) = calculateSwipeOffset(direction, dist)
            val duration = if (quick) 200L else 500L
            
            Actions(driver).apply {
                moveByOffset(x, y)
                clickAndHold()
                pause(Duration.ofMillis(100))  // Small pause before moving
                moveByOffset(offsetX, offsetY)
                pause(Duration.ofMillis(duration))
                release()
                moveByOffset(-x - offsetX, -y - offsetY)  // Reset mouse position
                perform()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to perform swipe: ${e.message}")
        }
    }
    
    // Keyboard events
    fun inputText(text: String) {
        try {
            Actions(driver).apply {
                sendKeys(text)
                perform()
            }
        } catch (e: Exception) {
            throw RuntimeException("Failed to input text: ${e.message}")
        }
    }
    
    // Browser control
    fun back() {
        try {
            driver?.navigate()?.back()
        } catch (e: Exception) {
            throw RuntimeException("Failed to go back: ${e.message}")
        }
    }
    
    // Helper enums and functions
    enum class SwipeDirection {
        UP, DOWN, LEFT, RIGHT
    }
    
    enum class SwipeDistance {
        SHORT, MEDIUM, LONG
    }
    
    private fun calculateSwipeOffset(direction: SwipeDirection, distance: SwipeDistance): Pair<Int, Int> {
        val baseDistance = when (distance) {
            SwipeDistance.SHORT -> 100
            SwipeDistance.MEDIUM -> 200
            SwipeDistance.LONG -> 300
        }
        
        return when (direction) {
            SwipeDirection.UP -> Pair(0, -baseDistance)
            SwipeDirection.DOWN -> Pair(0, baseDistance)
            SwipeDirection.LEFT -> Pair(-baseDistance, 0)
            SwipeDirection.RIGHT -> Pair(baseDistance, 0)
        }
    }
    
    fun drawCircle(x: Int, y: Int, imgPath: String, radius: Int = 10, thickness: Int = 2) {
        try {
            val img = Imgcodecs.imread(imgPath)
            Imgproc.circle(
                img,
                Point(x.toDouble(), y.toDouble()),
                radius,
                Scalar(0.0, 0.0, 255.0),  // BGR Red color
                thickness
            )
            Imgcodecs.imwrite(imgPath, img)
        } catch (e: Exception) {
            throw RuntimeException("Failed to draw circle: ${e.message}")
        }
    }
    
    fun drawArrow(
        x: Int, 
        y: Int, 
        direction: SwipeDirection, 
        dist: SwipeDistance, 
        imagePath: String,
        arrowColor: Scalar = Scalar(0.0, 255.0, 0.0),  // BGR Green color
        thickness: Int = 2
    ) {
        try {
            val img = Imgcodecs.imread(imagePath)
            val (offsetX, offsetY) = calculateSwipeOffset(direction, dist)
            
            Imgproc.arrowedLine(
                img,
                Point(x.toDouble(), y.toDouble()),
                Point((x + offsetX).toDouble(), (y + offsetY).toDouble()),
                arrowColor,
                thickness,
                Imgproc.LINE_8,
                0,
                0.3  // Arrow size relative to line length
            )
            
            Imgcodecs.imwrite(imagePath, img)
        } catch (e: Exception) {
            throw RuntimeException("Failed to draw arrow: ${e.message}")
        }
    }
    
    fun drawBBoxMulti(
        imgPath: String,
        outputPath: String,
        predictions: List<Prediction>,
        darkMode: Boolean = false
    ) {
        try {
            val img = Imgcodecs.imread(imgPath)
            var count = 1
            
            for (prediction in predictions) {
                val left = (prediction.x - prediction.width / 2).toInt()
                val top = (prediction.y - prediction.height / 2).toInt()
                val right = (prediction.x + prediction.width / 2).toInt()
                val bottom = (prediction.y + prediction.height / 2).toInt()
                
                val textColor = if (darkMode) 
                    Scalar(10.0, 10.0, 10.0) 
                else 
                    Scalar(255.0, 250.0, 250.0)
                
                val bgColor = if (darkMode) 
                    Scalar(255.0, 250.0, 250.0) 
                else 
                    Scalar(10.0, 10.0, 10.0)
                
                // Draw rectangle
                Imgproc.rectangle(
                    img,
                    Point(left.toDouble(), top.toDouble()),
                    Point(right.toDouble(), bottom.toDouble()),
                    bgColor,
                    2
                )
                
                // Put text
                Imgproc.putText(
                    img,
                    count.toString(),
                    Point(left.toDouble(), (top - 10).toDouble()),
                    Imgproc.FONT_HERSHEY_SIMPLEX,
                    0.9,
                    textColor,
                    2
                )
                
                count++
            }
            
            Imgcodecs.imwrite(outputPath, img)
        } catch (e: Exception) {
            throw RuntimeException("Failed to draw bounding boxes: ${e.message}")
        }
    }
    
    // Data class for predictions
    data class Prediction(
        val x: Double,
        val y: Double,
        val width: Double,
        val height: Double
    )
} 