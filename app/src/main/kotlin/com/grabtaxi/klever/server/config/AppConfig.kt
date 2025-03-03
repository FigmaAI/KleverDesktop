package com.grabtaxi.klever.server.config

import com.typesafe.config.ConfigFactory
import com.grabtaxi.klever.server.repositories.ModelConfigRepository

class AppConfig {
    private val config = ConfigFactory.load("config/config.json")
    
    val port: Int
        get() = config.getInt("server.port")
    
    fun isModelConfigured(): Boolean {
        val repository = ModelConfigRepository()
        val currentConfig = repository.loadCurrentConfig()
        
        return when {
            currentConfig == null -> false
            currentConfig.apiKey.isBlank() -> false
            else -> true
        }
    }
    
    // Additional settings if needed
} 