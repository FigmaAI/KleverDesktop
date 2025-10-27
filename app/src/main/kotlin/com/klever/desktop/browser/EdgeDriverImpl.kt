package com.klever.desktop.browser

import io.github.bonigarcia.wdm.WebDriverManager
import org.openqa.selenium.WebDriver
import org.openqa.selenium.edge.EdgeDriver
import org.openqa.selenium.edge.EdgeOptions
import mu.KotlinLogging
import java.io.File
import java.nio.file.Path

private val logger = KotlinLogging.logger {}

/**
 * Microsoft Edge WebDriver implementation
 * Edge is the default browser on Windows 10/11
 */
class EdgeDriverImpl : BrowserDriver {
    
    override fun getBrowserType(): BrowserType = BrowserType.EDGE
    
    override fun isAvailable(): Boolean {
        val edgePath = getBrowserPath()
        return edgePath != null && File(edgePath).exists()
    }
    
    override fun getBrowserPath(): String? {
        return when {
            System.getProperty("os.name").lowercase().contains("win") -> {
                // Windows Edge locations
                val possibleLocations = listOf(
                    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
                    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
                    System.getProperty("user.home") + "\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe"
                )
                possibleLocations.find { File(it).exists() }
            }
            System.getProperty("os.name").lowercase().contains("mac") -> {
                // macOS Edge location
                val edgePath = "/Applications/Microsoft Edge.app"
                if (File(edgePath).exists()) edgePath else null
            }
            else -> {
                // Linux Edge locations
                val possibleLocations = listOf(
                    "/usr/bin/microsoft-edge",
                    "/usr/bin/microsoft-edge-stable",
                    "/opt/microsoft/msedge/msedge"
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
            
            logger.info { "Setting up Edge WebDriver..." }
            WebDriverManager.edgedriver()
                .clearDriverCache()
                .clearResolutionCache()
                .setup()
            logger.info { "Edge WebDriver setup completed" }
        } catch (e: Exception) {
            logger.error(e) { "Edge driver setup failed: ${e.message}" }
            throw e
        }
    }
    
    override fun createDriver(userDataDir: File): WebDriver {
        try {
            logger.info { "Creating Edge WebDriver..." }
            
            // Create user data directory if it doesn't exist
            if (!userDataDir.exists()) {
                userDataDir.mkdirs()
                logger.debug { "Created user data directory: ${userDataDir.absolutePath}" }
            }
            
            val options = EdgeOptions().apply {
                // Common options
                addArguments("--remote-allow-origins=*")
                addArguments("--user-data-dir=${userDataDir.absolutePath}")
                addArguments("disable-features=msEdgeEnableNurturingFramework")
                setExperimentalOption("detach", true)
                
                // Platform-specific options
                when {
                    System.getProperty("os.name").lowercase().contains("win") -> {
                        addArguments("--start-maximized")
                        addArguments("--disable-gpu")
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
            
            val driver = EdgeDriver(options)
            logger.info { "Edge WebDriver created successfully" }
            
            return driver
        } catch (e: Exception) {
            logger.error(e) { "Failed to create Edge driver: ${e.message}" }
            throw RuntimeException("Edge driver creation failed", e)
        }
    }
}

