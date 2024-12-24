package com.klever.desktop.config

import com.klever.desktop.model.Settings
import java.util.prefs.Preferences

class AppConfig {
    private val prefs = Preferences.userNodeForPackage(AppConfig::class.java)
    
    fun saveSettings(settings: Settings) {
        prefs.put("model", settings.model)
        prefs.put("openAiApiBase", settings.openAiApiBase)
        prefs.put("openAiApiKey", settings.openAiApiKey)
        prefs.put("openAiApiModel", settings.openAiApiModel)
        prefs.put("figmaAccessToken", settings.figmaAccessToken)
    }
    
    fun loadSettings(): Settings {
        return Settings(
            model = prefs.get("model", "OpenAI"),
            openAiApiBase = prefs.get("openAiApiBase", ""),
            openAiApiKey = prefs.get("openAiApiKey", ""),
            openAiApiModel = prefs.get("openAiApiModel", ""),
            figmaAccessToken = prefs.get("figmaAccessToken", "")
        )
    }
} 