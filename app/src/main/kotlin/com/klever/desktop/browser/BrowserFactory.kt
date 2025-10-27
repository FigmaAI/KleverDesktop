package com.klever.desktop.browser

import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * Factory for detecting and creating browser drivers
 * Automatically selects the best available browser based on platform
 */
object BrowserFactory {
    
    /**
     * Get all available browser drivers in priority order
     */
    private fun getAllDrivers(): List<BrowserDriver> {
        return listOf(
            SafariDriverImpl(),
            EdgeDriverImpl(),
            ChromeDriverImpl()
        )
    }
    
    /**
     * Detect and return the first available browser driver
     * Searches in platform-specific priority order
     * 
     * @return BrowserDriver instance or null if no browser is available
     */
    fun detectAvailableBrowser(): BrowserDriver? {
        logger.info { "Detecting available browsers..." }
        
        val preferredBrowsers = BrowserType.getPreferredBrowsers()
        val allDrivers = getAllDrivers()
        
        // Try preferred browsers first
        for (browserType in preferredBrowsers) {
            val driver = allDrivers.find { it.getBrowserType() == browserType }
            if (driver != null && driver.isAvailable()) {
                logger.info { "Found available browser: ${browserType.displayName} at ${driver.getBrowserPath()}" }
                return driver
            } else {
                logger.debug { "${browserType.displayName} is not available" }
            }
        }
        
        logger.warn { "No preferred browser found, checking all browsers..." }
        
        // If no preferred browser is available, try any available browser
        for (driver in allDrivers) {
            if (driver.isAvailable()) {
                logger.info { "Found fallback browser: ${driver.getBrowserType().displayName}" }
                return driver
            }
        }
        
        logger.error { "No browser is available on this system" }
        return null
    }
    
    /**
     * Get all available browsers on the system
     * 
     * @return Map of BrowserType to installation path
     */
    fun getAvailableBrowsers(): Map<BrowserType, String?> {
        val result = mutableMapOf<BrowserType, String?>()
        
        for (driver in getAllDrivers()) {
            if (driver.isAvailable()) {
                result[driver.getBrowserType()] = driver.getBrowserPath()
            }
        }
        
        return result
    }
    
    /**
     * Check if any browser is available on the system
     */
    fun isAnyBrowserAvailable(): Boolean {
        return getAllDrivers().any { it.isAvailable() }
    }
    
    /**
     * Get a specific browser driver by type
     * 
     * @param browserType The browser type to get
     * @return BrowserDriver instance or null if not available
     */
    fun getBrowserDriver(browserType: BrowserType): BrowserDriver? {
        val driver = when (browserType) {
            BrowserType.SAFARI -> SafariDriverImpl()
            BrowserType.EDGE -> EdgeDriverImpl()
            BrowserType.CHROME -> ChromeDriverImpl()
            BrowserType.FIREFOX -> null // Not implemented yet
        }
        
        return if (driver != null && driver.isAvailable()) {
            driver
        } else {
            null
        }
    }
    
    /**
     * Create a browser driver with automatic fallback
     * Tries to create the preferred browser, falls back to any available browser
     * 
     * @return BrowserDriver instance
     * @throws RuntimeException if no browser is available
     */
    fun createBrowserDriver(): BrowserDriver {
        val driver = detectAvailableBrowser()
            ?: throw RuntimeException(
                "No supported browser found. Please install one of: ${
                    BrowserType.getPreferredBrowsers().joinToString(", ") { it.displayName }
                }"
            )
        
        return driver
    }
}

