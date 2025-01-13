package com.klever.desktop.server.models

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import com.klever.desktop.server.config.OllamaConfig
import mu.KLogging
import kotlin.time.Duration.Companion.minutes

class OllamaModel(private val config: OllamaConfig) : AIModel {
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
        
        engine {
            requestTimeout = 5.minutes.inWholeMilliseconds
        }
    }

    override suspend fun get_model_response(
        prompt: String,
        images: List<String>
    ): Pair<Boolean, String> {
        return try {
            // 프롬프트 형식 지정 추가
            val formattedPrompt = """
                $prompt
                
                Important: Format your response exactly as follows without any markdown formatting
            """.trimIndent()

            val response = client.post("${config.baseUrl}/api/generate") {
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    put("model", config.model)
                    put("prompt", formattedPrompt)
                    putJsonArray("images") {
                        images.forEach { add(it) }
                    }
                    put("stream", false)
                    putJsonObject("options") {
                        put("temperature", config.temperature)
                        put("num_predict", config.maxTokens)
                    }
                }.toString())
            }
            
            val responseText = response.bodyAsText()
            val jsonResponse = Json.parseToJsonElement(responseText).jsonObject
            true to (jsonResponse["response"]?.jsonPrimitive?.content ?: throw Exception("No response from model"))
        } catch (e: Exception) {
            logger.error(e) { "Error in Ollama response: ${e.message}" }
            false to "Error: ${e.message}"
        } finally {
            client.close()
        }
    }

    companion object : KLogging()
}