package com.klever.desktop.server.config

import com.klever.desktop.browser.BrowserType
import kotlinx.serialization.Serializable

/**
 * Browser configuration for Selenium WebDriver
 */
@Serializable
data class BrowserConfig(
    val browserType: BrowserType = BrowserType.SAFARI,
    val autoDetect: Boolean = true  // If true, automatically detect and use available browser
)

