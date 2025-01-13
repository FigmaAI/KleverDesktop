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
// import com.klever.desktop.server.config.QwenConfig

private val json = Json {
    ignoreUnknownKeys = true
    serializersModule = SerializersModule {
        polymorphic(ModelConfig::class) {
            subclass(OpenAIConfig::class)
            subclass(AzureConfig::class)
            subclass(OllamaConfig::class)
            // subclass(QwenConfig::class)
        }
    }
}

class ModelConfigRepository {
    private val preferences = Preferences.userRoot().node("com.klever.desktop")
    private val configChangeListeners = mutableListOf<() -> Unit>()

    fun saveConfig(config: ModelConfig) {
        val modelType = when (config) {
            is OpenAIConfig -> "OpenAI"
            is AzureConfig -> "Azure"
            is OllamaConfig -> "Ollama"
            // is QwenConfig -> "Qwen"
            else -> throw IllegalArgumentException("Unknown config type")
        }
        
        preferences.put("model_type", modelType)
        preferences.put("config", json.encodeToString<ModelConfig>(config))
        notifyListeners()
    }

    fun loadCurrentConfig(): ModelConfig? {
        val modelType = preferences.get("model_type", null) ?: return null
        val configJson = preferences.get("config", null) ?: return null
        
        return when (modelType) {
            "OpenAI" -> json.decodeFromString<OpenAIConfig>(configJson)
            "Azure" -> json.decodeFromString<AzureConfig>(configJson)
            "Ollama" -> json.decodeFromString<OllamaConfig>(configJson)
            else -> null
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