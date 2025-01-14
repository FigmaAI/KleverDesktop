package com.klever.desktop.server.config

import com.typesafe.config.ConfigFactory

class AppConfig {
    private val config = ConfigFactory.load("config/config.json")
    
    val port: Int
        get() = config.getInt("server.port")
    
    // Additional settings if needed
} 