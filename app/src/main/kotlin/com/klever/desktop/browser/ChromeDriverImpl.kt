package com.klever.desktop.browser

import io.github.bonigarcia.wdm.WebDriverManager
import org.openqa.selenium.WebDriver
import org.openqa.selenium.chrome.ChromeDriver
import org.openqa.selenium.chrome.ChromeOptions
import mu.KotlinLogging
import java.io.File
import java.nio.file.Path

private val logger = KotlinLogging.logger {}

/**
 * Google Chrome WebDriver implementation
 */
class ChromeDriverImpl : BrowserDriver {
    
    override fun getBrowserType(): BrowserType = BrowserType.CHROME
    
    override fun isAvailable(): Boolean {
        val chromePath = getBrowserPath()
        return chromePath != null && File(chromePath).exists()
    }
    
    override fun getBrowserPath(): String? {
        return when {
            System.getProperty("os.name").lowercase().contains("win") -> {
                // Windows Chrome locations
                val possibleLocations = listOf(
                    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
                    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
                    System.getProperty("user.home") + "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
                )
                possibleLocations.find { File(it).exists() }
            }
            System.getProperty("os.name").lowercase().contains("mac") -> {
                // macOS Chrome location
                val chromePath = "/Applications/Google Chrome.app"
                if (File(chromePath).exists()) chromePath else null
            }
            else -> {
                // Linux Chrome locations
                val possibleLocations = listOf(
                    "/usr/bin/google-chrome",
                    "/usr/bin/google-chrome-stable",
                    "/usr/bin/chromium-browser",
                    "/usr/bin/chromium"
                )
                possibleLocations.find { File(it).exists() }
            }
        }
    }
    
    override fun setupDriver() {
        try {
            val wdmCachePath = Path.of(
                System.getProperty("user.home"),
                ".kleverdesktop",
                "webdriver"
            ).toString()
            
            System.setProperty("wdm.cachePath", wdmCachePath)
            System.setProperty("wdm.timeout", "60")
            System.setProperty("wdm.log", "true")
            
            logger.info { "Setting up Chrome WebDriver..." }
            WebDriverManager.chromedriver()
                .clearDriverCache()
                .clearResolutionCache()
                .setup()
            logger.info { "Chrome WebDriver setup completed" }
        } catch (e: Exception) {
            logger.error(e) { "Chrome driver setup failed: ${e.message}" }
            
            // Fallback: Try to find ChromeDriver in system PATH
            val chromeDriverPath = findChromeDriverInPath()
            if (chromeDriverPath != null) {
                System.setProperty("webdriver.chrome.driver", chromeDriverPath)
                logger.info { "Using ChromeDriver from PATH: $chromeDriverPath" }
            } else {
                logger.error { "ChromeDriver not found in PATH" }
                throw e
            }
        }
    }
    
    override fun createDriver(userDataDir: File): WebDriver {
        try {
            logger.info { "Creating Chrome WebDriver..." }
            
            // Create user data directory if it doesn't exist
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
                
                // Platform-specific options
                when {
                    System.getProperty("os.name").lowercase().contains("win") -> {
                        addArguments("--start-maximized")
                        addArguments("--disable-gpu")
                        addArguments("--no-sandbox")
                    }
                    System.getProperty("os.name").lowercase().contains("mac") -> {
                        addArguments("--start-maximized")
                    }
                    else -> {
                        addArguments("--start-maximized")
                        addArguments("--no-sandbox")
                    }
                }
            }
            
            val driver = ChromeDriver(options)
            logger.info { "Chrome WebDriver created successfully" }
            
            return driver
        } catch (e: Exception) {
            logger.error(e) { "Failed to create Chrome driver: ${e.message}" }
            throw RuntimeException("Chrome driver creation failed", e)
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
            .find { it.exists() && it.canExecute() }
            ?.absolutePath
    }
}

