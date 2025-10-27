package com.klever.desktop.server.repositories

import java.util.prefs.Preferences
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import com.klever.desktop.server.config.ModelConfig
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

private val json = Json {
    ignoreUnknownKeys = true
    prettyPrint = true
}

class ModelConfigRepository {
    private val preferences = Preferences.userRoot().node("com.klever.desktop")
    private val configChangeListeners = mutableListOf<() -> Unit>()

    fun saveConfig(config: ModelConfig) {
        // Clean API key and other fields from whitespace/newlines
        val cleanedConfig = config.copy(
            apiKey = config.apiKey.replace(Regex("\\s"), ""),
            baseUrl = config.baseUrl.replace(Regex("\\s"), ""),
            model = config.model.trim().replace(Regex("[\\n\\r]"), "")
        )
        
        preferences.put("config", json.encodeToString(cleanedConfig))
        logger.info { "Configuration saved: model=${cleanedConfig.model}" }
        notifyListeners()
    }

    fun loadCurrentConfig(): ModelConfig? {
        val configJson = preferences.get("config", null) ?: return null
        
        return try {
            val config = json.decodeFromString<ModelConfig>(configJson)
            // Clean loaded config in case old data has whitespace
            config.copy(
                apiKey = config.apiKey.replace(Regex("\\s"), ""),
                baseUrl = config.baseUrl.replace(Regex("\\s"), ""),
                model = config.model.trim().replace(Regex("[\\n\\r]"), "")
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to deserialize config" }
            null
        }
    }

    fun addConfigChangeListener(listener: () -> Unit): () -> Unit {
        configChangeListeners.add(listener)
        return listener
    }

    fun removeConfigChangeListener(listener: () -> Unit) {
        configChangeListeners.remove(listener)
    }

    private fun notifyListeners() {
        configChangeListeners.forEach { it() }
    }
}
