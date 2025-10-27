package com.klever.desktop.server.repositories

import java.util.prefs.Preferences
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import com.klever.desktop.server.config.BrowserConfig
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

private val json = Json {
    ignoreUnknownKeys = true
    prettyPrint = true
}

class BrowserConfigRepository {
    private val preferences = Preferences.userRoot().node("com.klever.desktop.browser")

    fun saveConfig(config: BrowserConfig) {
        preferences.put("browser_config", json.encodeToString(config))
        logger.info { "Browser configuration saved: browser=${config.browserType.displayName}, autoDetect=${config.autoDetect}" }
    }

    fun loadConfig(): BrowserConfig? {
        val configJson = preferences.get("browser_config", null) ?: return null
        
        return try {
            json.decodeFromString<BrowserConfig>(configJson)
        } catch (e: Exception) {
            logger.error(e) { "Failed to deserialize browser config" }
            null
        }
    }

    fun clearConfig() {
        preferences.remove("browser_config")
        logger.info { "Browser configuration cleared" }
    }
}

