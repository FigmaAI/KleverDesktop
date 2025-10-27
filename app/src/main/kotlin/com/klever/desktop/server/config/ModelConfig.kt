package com.klever.desktop.server.config

import kotlinx.serialization.Serializable

/**
 * Model configuration
 * Supports both OpenRouter (unified access) and Custom endpoints (direct API access)
 */
@Serializable
data class ModelConfig(
    val model: String,
    val apiKey: String,
    val baseUrl: String = "https://openrouter.ai/api/v1/chat/completions",
    val temperature: Float = 0.0f,
    val maxTokens: Int = 300,
    val isCustomEndpoint: Boolean = false  // true for Custom tab (OpenAI, Ollama, etc.)
)
