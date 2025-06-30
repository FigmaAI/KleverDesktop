package com.grabtaxi.klever.server.models

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import kotlinx.serialization.json.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mu.KotlinLogging
import com.grabtaxi.klever.server.config.ModelConfig
import com.grabtaxi.klever.server.config.OpenAIConfig

private val logger = KotlinLogging.logger {}

class OpenAIModel(
    private val baseUrl: String,
    private val apiKey: String,
    private val model: String,
    private val temperature: Float,
    private val maxTokens: Int
) : AIModel {
    constructor(config: OpenAIConfig) : this(
        baseUrl = config.baseUrl,
        apiKey = config.apiKey,
        model = config.model,
        temperature = config.temperature,
        maxTokens = config.maxTokens
    )

    private val client = OkHttpClient()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    override suspend fun get_model_response(prompt: String, images: List<String>): Pair<Boolean, String> = 
        withContext(Dispatchers.IO) {
            try {
                logger.info { "OpenAIModel - Using baseUrl: $baseUrl" }
                logger.info { "OpenAIModel - Using model: $model" }
                
                val messages = buildJsonArray {
                    // System message with prompt
                    addJsonObject {
                        put("role", "system")
                        put("content", buildJsonArray {
                            addJsonObject {
                                put("type", "text")
                                put("text", prompt)
                            }
                        })
                    }
                    // User message with images
                    addJsonObject {
                        put("role", "user")
                        put("content", buildJsonArray {
                            images.forEach { image ->
                                addJsonObject {
                                    put("type", "image_url")
                                    put("image_url", buildJsonObject {
                                        put("url", "data:image/jpeg;base64,$image")
                                    })
                                }
                            }
                        })
                    }
                }

                val payload = buildJsonObject {
                    put("model", model)
                    put("messages", messages)
                    put("temperature", temperature)
                    put("max_tokens", maxTokens)
                }

                logger.info { "OpenAIModel - Request payload: $payload" }

                val request = Request.Builder()
                    .url(baseUrl)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $apiKey")
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: throw Exception("Empty response")
                // logger.debug { "Raw response: $responseBody" }
                
                val jsonResponse = Json.parseToJsonElement(responseBody).jsonObject

                if (jsonResponse.containsKey("error")) {
                    val error = jsonResponse["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                        ?: "Unknown error"
                    logger.error { "API error: $error" }
                    Pair(false, error)
                } else {
                    val content = jsonResponse["choices"]?.jsonArray?.get(0)
                        ?.jsonObject?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.content
                        ?: throw Exception("Invalid response format")
                    
                    // Logging token usage (keeping for cost-related)
                    jsonResponse["usage"]?.jsonObject?.let { usage ->
                        val promptTokens = usage["prompt_tokens"]?.jsonPrimitive?.int ?: 0
                        val completionTokens = usage["completion_tokens"]?.jsonPrimitive?.int ?: 0
                        val cost = (promptTokens / 1000.0 * 0.01) + (completionTokens / 1000.0 * 0.03)
                        logger.info { "Request cost is $${String.format("%.2f", cost)}" }
                    }
                    
                    Pair(true, content)
                }
            } catch (e: Exception) {
                logger.error(e) { "Failed to get model response" }
                Pair(false, e.message ?: "Unknown error")
            }
        }

    override suspend fun translate_to_english(text: String): Pair<Boolean, String> = 
        withContext(Dispatchers.IO) {
            try {
                val messages = buildJsonArray {
                    // System message with updated prompt
                    addJsonObject {
                        put("role", "system")
                        put("content", """
                            You are a translator. Your task is to translate non-English text to English while preserving any English text unchanged. 
                            For example:
                            Input: "Hello 안녕하세요 World"
                            Output: "Hello hello World"
                            
                            Only translate the non-English parts and keep English parts exactly as they are.
                        """.trimIndent())
                    }
                    // User message
                    addJsonObject {
                        put("role", "user")
                        put("content", text)
                    }
                }

                val payload = buildJsonObject {
                    put("model", model)
                    put("messages", messages)
                    put("temperature", 0.3)  // Lower temperature for more consistent translations
                    put("max_tokens", maxTokens)
                }

                val request = Request.Builder()
                    .url(baseUrl)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("Authorization", "Bearer $apiKey")
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: throw Exception("Empty response")
                
                val jsonResponse = Json.parseToJsonElement(responseBody).jsonObject

                if (jsonResponse.containsKey("error")) {
                    val error = jsonResponse["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content
                        ?: "Unknown error"
                    logger.error { "Translation error: $error" }
                    Pair(false, error)
                } else {
                    val translatedText = jsonResponse["choices"]?.jsonArray?.get(0)
                        ?.jsonObject?.get("message")?.jsonObject?.get("content")?.jsonPrimitive?.content
                        ?: throw Exception("Invalid response format")
                    
                    Pair(true, translatedText.trim())
                }
            } catch (e: Exception) {
                logger.error(e) { "Translation failed: ${e.message}" }
                Pair(false, "Translation error: ${e.message}")
            }
        }
} 