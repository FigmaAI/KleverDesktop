package com.klever.desktop.browser

import io.github.bonigarcia.wdm.WebDriverManager
import org.openqa.selenium.WebDriver
import org.openqa.selenium.safari.SafariDriver
import org.openqa.selenium.safari.SafariOptions
import mu.KotlinLogging
import java.io.File

private val logger = KotlinLogging.logger {}

/**
 * Safari WebDriver implementation
 * Safari is the default browser on macOS
 */
class SafariDriverImpl : BrowserDriver {
    
    override fun getBrowserType(): BrowserType = BrowserType.SAFARI
    
    override fun isAvailable(): Boolean {
        // Safari is only available on macOS
        if (!System.getProperty("os.name").lowercase().contains("mac")) {
            return false
        }
        
        // Check if Safari.app exists
        val safariPath = File("/Applications/Safari.app")
        return safariPath.exists()
    }
    
    override fun getBrowserPath(): String? {
        return if (isAvailable()) {
            "/Applications/Safari.app"
        } else {
            null
        }
    }
    
    override fun setupDriver() {
        try {
            // Safari driver (safaridriver) comes pre-installed on macOS
            // Enable it with: sudo safaridriver --enable
            logger.info { "Safari driver is built-in on macOS" }
            
            // Note: Users may need to enable "Allow Remote Automation" in Safari's Develop menu
            logger.info { "Note: Enable 'Allow Remote Automation' in Safari > Develop menu" }
        } catch (e: Exception) {
            logger.warn(e) { "Safari driver setup note: ${e.message}" }
        }
    }
    
    override fun createDriver(userDataDir: File): WebDriver {
        try {
            logger.info { "Creating Safari WebDriver..." }
            
            val options = SafariOptions().apply {
                // Safari-specific options
                setAutomaticInspection(false)
                setAutomaticProfiling(false)
                
                // Note: Safari doesn't support custom user data directory like Chrome
                // It uses the default Safari profile
            }
            
            val driver = SafariDriver(options)
            logger.info { "Safari WebDriver created successfully" }
            
            return driver
        } catch (e: Exception) {
            logger.error(e) { "Failed to create Safari driver: ${e.message}" }
            throw RuntimeException("Safari driver creation failed. Please enable 'Allow Remote Automation' in Safari > Develop menu", e)
        }
    }
}

