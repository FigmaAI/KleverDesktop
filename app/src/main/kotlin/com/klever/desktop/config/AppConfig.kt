package com.klever.desktop.config

import com.typesafe.config.ConfigFactory

class AppConfig {
    private val config = ConfigFactory.load("config/config.json")
    
    val port: Int
        get() = config.getInt("server.port")
    
    // 추가 설정이 필요한 경우 여기에 추가
} 