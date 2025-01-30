package com.klever.desktop.browser

import mu.KotlinLogging
import org.openqa.selenium.By
import org.openqa.selenium.OutputType
import org.openqa.selenium.WebDriver
import org.openqa.selenium.WebElement
import org.openqa.selenium.support.ui.ExpectedConditions
import org.openqa.selenium.support.ui.WebDriverWait
import java.time.Duration
import java.io.File
import javax.imageio.ImageIO
import java.awt.Rectangle
import java.awt.Robot
import java.awt.Toolkit

private val logger = KotlinLogging.logger {}

class BrowserActions(
    private val driver: WebDriver,
    private val defaultTimeout: Int = 10
) {
    private val wait = WebDriverWait(driver, Duration.ofSeconds(defaultTimeout.toLong()))

    fun navigateTo(url: String) {
        try {
            driver.get(url)
            logger.info { "Navigated to: $url" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to navigate to: $url" }
            throw e
        }
    }

    fun click(selector: String) {
        try {
            val element = waitForElement(selector)
            element.click()
            logger.info { "Clicked element: $selector" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to click element: $selector" }
            throw e
        }
    }

    fun type(selector: String, text: String) {
        try {
            val element = waitForElement(selector)
            element.clear()
            element.sendKeys(text)
            logger.info { "Typed text into element: $selector" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to type text into element: $selector" }
            throw e
        }
    }

    fun takeScreenshot(path: String): File {
        try {
            // Capture entire screen
            val screenRect = Rectangle(Toolkit.getDefaultToolkit().screenSize)
            val capture = Robot().createScreenCapture(screenRect)
            
            // Save file
            val file = File(path)
            file.parentFile?.mkdirs()
            ImageIO.write(capture, "png", file)
            
            logger.info { "Screenshot saved to: $path" }
            return file
        } catch (e: Exception) {
            logger.error(e) { "Failed to take screenshot" }
            throw e
        }
    }

    fun waitForElement(selector: String): WebElement {
        return wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector(selector)))
    }

    fun waitForElementVisible(selector: String): WebElement {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(By.cssSelector(selector)))
    }

    fun waitForElementClickable(selector: String): WebElement {
        return wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector(selector)))
    }

    fun getCurrentUrl(): String {
        return driver.currentUrl
    }

    fun getPageTitle(): String {
        return driver.title
    }
}
