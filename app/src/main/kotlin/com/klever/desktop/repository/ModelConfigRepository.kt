 package com.klever.desktop.repository

import com.klever.desktop.model.ModelConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import java.io.File
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

class ModelConfigRepository {
    private val configFile = File(System.getProperty("user.home"), ".klever/model_configs.json")
    private val json = Json { 
        prettyPrint = true
        ignoreUnknownKeys = true
    }

    init {
        configFile.parentFile?.mkdirs()
    }

    fun saveConfigs(configs: List<ModelConfig>) {
        try {
            configFile.writeText(json.encodeToString(configs))
            logger.info { "Saved ${configs.size} model configurations" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to save model configurations" }
        }
    }

    fun loadConfigs(): List<ModelConfig> {
        return try {
            if (configFile.exists()) {
                json.decodeFromString<List<ModelConfig>>(configFile.readText()).also {
                    logger.info { "Loaded ${it.size} model configurations" }
                }
            } else {
                emptyList()
            }
        } catch (e: Exception) {
            logger.error(e) { "Failed to load model configurations" }
            emptyList()
        }
    }
}