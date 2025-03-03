package com.grabtaxi.klever.server.config

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import java.io.File
import mu.KotlinLogging
import java.util.Locale

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

data class WebSocketConfig(
    val maxRounds: Int = 30,
    val language: String = "en"
)

class WebSocketConfigRepository {
    private val configFile = File("app/config/websocket_config.json")
    private val listeners = mutableListOf<() -> Unit>()

    init {
        configFile.parentFile?.mkdirs()
        if (!configFile.exists()) {
            saveConfig(WebSocketConfig())
        }
    }

    fun loadConfig(): WebSocketConfig {
        return try {
            mapper.readValue(configFile, WebSocketConfig::class.java)
        } catch (e: Exception) {
            logger.error(e) { "Failed to load WebSocket config, using defaults" }
            WebSocketConfig()
        }
    }

    fun saveConfig(config: WebSocketConfig) {
        try {
            mapper.writeValue(configFile, config)
            notifyListeners()
            logger.info { "WebSocket config saved successfully: $config" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to save WebSocket config" }
            throw e
        }
    }

    fun addConfigChangeListener(listener: () -> Unit): () -> Unit {
        listeners.add(listener)
        return listener
    }

    fun removeConfigChangeListener(listener: () -> Unit) {
        listeners.remove(listener)
    }

    private fun notifyListeners() {
        listeners.forEach { it() }
    }
} 