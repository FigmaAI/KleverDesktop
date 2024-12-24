package com.klever.desktop.model

data class Settings(
    var model: String = "OpenAI",
    var openAiApiBase: String = "",
    var openAiApiKey: String = "",
    var openAiApiModel: String = "",
    var figmaAccessToken: String = ""
) {
    fun isValid(): Boolean {
        return when (model) {
            "OpenAI" -> openAiApiBase.isNotBlank() && 
                       openAiApiKey.isNotBlank() && 
                       openAiApiModel.isNotBlank() &&
                       figmaAccessToken.isNotBlank()
            else -> false
        }
    }
} 