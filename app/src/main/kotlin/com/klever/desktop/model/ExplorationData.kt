package com.klever.desktop.model

data class ExplorationData(
    var appName: String = "",
    var url: String = "",
    var password: String? = null,
    var taskDescription: String = "",
    var personaDescription: String = ""
) {
    fun isUrlDataValid(): Boolean {
        return appName.isNotBlank() && url.isNotBlank() && url.contains("figma.com")
    }

    fun isTaskDataValid(): Boolean {
        return taskDescription.isNotBlank()
    }
} 