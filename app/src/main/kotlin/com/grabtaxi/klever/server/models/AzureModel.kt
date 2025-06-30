package com.grabtaxi.klever.server.models

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import kotlinx.serialization.json.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mu.KotlinLogging
import com.grabtaxi.klever.server.config.AzureConfig

private val logger = KotlinLogging.logger {}

class AzureModel(
    private val baseUrl: String,
    private val apiKey: String,
    private val model: String,
    private val temperature: Float,
    private val maxTokens: Int
) : AIModel {
    constructor(config: AzureConfig) : this(
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

                val request = Request.Builder()
                    .url(baseUrl)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("api-key", apiKey)  // Azure uses 'api-key' header
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: throw Exception("Empty response")
                
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
                    
                    // Log token usage
                    jsonResponse["usage"]?.jsonObject?.let { usage ->
                        val promptTokens = usage["prompt_tokens"]?.jsonPrimitive?.int ?: 0
                        val completionTokens = usage["completion_tokens"]?.jsonPrimitive?.int ?: 0
                        logger.info { "Token usage - Prompt: $promptTokens, Completion: $completionTokens" }
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
                            You are a precise translator that only translates non-English text to English.
                            Rules:
                            1. Keep all English text exactly as is
                            2. Only translate text that is not in English
                            3. Preserve all formatting, spaces, and special characters
                            4. Do not add any explanations or notes
                            5. Do not modify the structure of the text
                            
                            Example:
                            Input: "Click here to 새로운 메시지를 작성하세요 and send"
                            Output: "Click here to write new message and send"
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
                    put("temperature", 0.3)
                    put("max_tokens", maxTokens)
                }

                logger.info { "Sending translation request for text: '$text'" }
                
                val request = Request.Builder()
                    .url(baseUrl)
                    .addHeader("Content-Type", "application/json")
                    .addHeader("api-key", apiKey)
                    .post(payload.toString().toRequestBody(jsonMediaType))
                    .build()

                val response = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: throw Exception("Empty response")
                
                logger.debug { "Raw response: $responseBody" }
                
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
                    
                    logger.info { "Translation completed: '$text' -> '$translatedText'" }
                    Pair(true, translatedText.trim())
                }
            } catch (e: Exception) {
                logger.error(e) { "Translation failed: ${e.message}" }
                Pair(false, "Translation error: ${e.message}")
            }
        }
} 