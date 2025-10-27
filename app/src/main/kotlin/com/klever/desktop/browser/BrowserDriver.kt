package com.klever.desktop.browser

import org.openqa.selenium.WebDriver
import java.io.File

/**
 * Interface for browser driver implementations
 * Each browser (Safari, Chrome, Edge, etc.) implements this interface
 */
interface BrowserDriver {
    /**
     * Get the browser type
     */
    fun getBrowserType(): BrowserType
    
    /**
     * Check if this browser is available on the system
     */
    fun isAvailable(): Boolean
    
    /**
     * Get the installation path of the browser (if available)
     */
    fun getBrowserPath(): String?
    
    /**
     * Create and configure a WebDriver instance
     * @param userDataDir Directory for storing browser user data
     * @return Configured WebDriver instance
     */
    fun createDriver(userDataDir: File): WebDriver
    
    /**
     * Setup the browser driver (download/configure driver executable)
     */
    fun setupDriver()
}

