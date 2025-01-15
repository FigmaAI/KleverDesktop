package com.klever.desktop.server.repositories

import java.util.prefs.Preferences
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.modules.SerializersModule
import kotlinx.serialization.modules.polymorphic
import kotlinx.serialization.modules.subclass
import com.klever.desktop.server.config.ModelConfig
import com.klever.desktop.server.config.OpenAIConfig
import com.klever.desktop.server.config.AzureConfig
import com.klever.desktop.server.config.OllamaConfig
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

private val json = Json {
    ignoreUnknownKeys = true
    serializersModule = SerializersModule {
        polymorphic(ModelConfig::class) {
            subclass(OpenAIConfig::class)
            subclass(AzureConfig::class)
            subclass(OllamaConfig::class)
        }
    }
}

class ModelConfigRepository {
    private val preferences = Preferences.userRoot().node("com.klever.desktop")
    private val configChangeListeners = mutableListOf<() -> Unit>()

    fun saveConfig(config: ModelConfig) {
        preferences.put("model_type", when (config) {
            is OpenAIConfig -> "OpenAI"
            is AzureConfig -> "Azure"
            is OllamaConfig -> "Ollama"
        })
        preferences.put("config", json.encodeToString<ModelConfig>(config))
        notifyListeners()
    }

    fun loadCurrentConfig(): ModelConfig? {
        // val modelType = preferences.get("model_type", null) ?: return null
        val configJson = preferences.get("config", null) ?: return null
        
        return deserializeConfig(configJson)
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

    private fun deserializeConfig(json: String): ModelConfig? {
        return try {
            when (val config = Json.decodeFromString<ModelConfig>(json)) {
                is OpenAIConfig -> config
                is AzureConfig -> config
                is OllamaConfig -> config
            }
        } catch (e: Exception) {
            logger.error(e) { "Failed to deserialize config" }
            null
        }
    }
}