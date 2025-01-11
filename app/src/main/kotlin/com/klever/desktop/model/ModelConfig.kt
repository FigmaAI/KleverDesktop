package com.klever.desktop.model

import kotlinx.serialization.Serializable

@Serializable
sealed class ModelConfig {
    abstract val name: String
    abstract val apiKey: String
}

@Serializable
data class OpenAIConfig(
    override val name: String,
    override val apiKey: String,
    val baseUrl: String,
    val model: String,
    val temperature: Float,
    val maxTokens: Int
) : ModelConfig()

@Serializable
data class QwenConfig(
    override val name: String,
    override val apiKey: String,
    val model: String
) : ModelConfig()