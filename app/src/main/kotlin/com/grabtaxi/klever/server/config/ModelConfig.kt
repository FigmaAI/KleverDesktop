package com.grabtaxi.klever.server.config

import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

@Serializable
sealed class ModelConfig {
    abstract val model: String
    abstract val apiKey: String
    abstract val baseUrl: String
}

@Serializable
@SerialName("OpenAI")
data class OpenAIConfig(
    override val model: String,
    override val apiKey: String,
    override val baseUrl: String = "https://api.openai.com/v1/chat/completions",
    val temperature: Float = 0.0f,
    val maxTokens: Int = 300
) : ModelConfig()

@Serializable
@SerialName("Azure")
data class AzureConfig(
    override val model: String,
    override val apiKey: String,
    override val baseUrl: String,
    val temperature: Float = 0.0f,
    val maxTokens: Int = 300
) : ModelConfig()

@Serializable
@SerialName("Ollama")
data class OllamaConfig(
    override val model: String = "llama3.2-vision",
    override val apiKey: String = "",  // Ollama does not require an API key, but it is included for inheritance purposes
    override val baseUrl: String = "http://localhost:11434",
    val temperature: Float = 0.0f,
    val maxTokens: Int = 300
) : ModelConfig()

// @Serializable
// @SerialName("Qwen")
// data class QwenConfig(
//     override val model: String,
//     override val apiKey: String,
//     override val baseUrl: String = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-conversation/generate"
// ) : ModelConfig()