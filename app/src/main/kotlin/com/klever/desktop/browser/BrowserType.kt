package com.klever.desktop.browser

import kotlinx.serialization.Serializable

@Serializable
enum class BrowserType(val displayName: String) {
    SAFARI("Safari"),
    EDGE("Microsoft Edge"),
    CHROME("Google Chrome"),
    FIREFOX("Firefox");
    
    companion object {
        /**
         * Get preferred browsers for the current platform
         * Returns in priority order (first = highest priority)
         */
        fun getPreferredBrowsers(): List<BrowserType> {
            return when {
                System.getProperty("os.name").lowercase().contains("mac") -> {
                    // macOS: Safari (built-in) > Chrome > Edge
                    listOf(SAFARI, CHROME, EDGE)
                }
                System.getProperty("os.name").lowercase().contains("win") -> {
                    // Windows: Edge (built-in) > Chrome
                    listOf(EDGE, CHROME)
                }
                else -> {
                    // Linux: Chrome > Firefox
                    listOf(CHROME, FIREFOX)
                }
            }
        }
    }
}

