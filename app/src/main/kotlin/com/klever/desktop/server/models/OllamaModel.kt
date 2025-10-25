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
import java.awt.image.BufferedImage
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import javax.imageio.ImageIO
import java.util.Base64
import java.awt.Graphics2D
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import mu.KotlinLogging

class OllamaModel(private val config: OllamaConfig) : AIModel {
    private val client = HttpClient(CIO) {
        install(ContentNegotiation) {
            json()
        }
        
        engine {
            requestTimeout = 5.minutes.inWholeMilliseconds
        }
    }

    private fun combineImages(images: List<String>): String {
        require(images.isNotEmpty()) { "At least one image is required" }
        
        try {
            // Base64 decode and convert to BufferedImage
            val bufferedImages = images.map { base64Str ->
                val imageBytes = Base64.getDecoder().decode(base64Str)
                ImageIO.read(ByteArrayInputStream(imageBytes))
            }
            
            // Calculate result image size (arrange horizontally)
            val totalWidth = bufferedImages.sumOf { it.width }
            val maxHeight = bufferedImages.maxOf { it.height }
            
            // Create new image
            val combined = BufferedImage(totalWidth, maxHeight, BufferedImage.TYPE_INT_RGB)
            val g2d = combined.createGraphics()
            
            // Arrange images
            var x = 0
            bufferedImages.forEach { img ->
                g2d.drawImage(img, x, 0, null)
                x += img.width
            }
            g2d.dispose()
            
            // Re-encode to Base64
            val outputStream = ByteArrayOutputStream()
            ImageIO.write(combined, "jpg", outputStream)
            return Base64.getEncoder().encodeToString(outputStream.toByteArray())
            
        } catch (e: Exception) {
            logger.error(e) { "Failed to combine images" }
            throw e
        }
    }

    override suspend fun get_model_response(
        prompt: String,
        images: List<String>
    ): Pair<Boolean, String> = 
        withContext(Dispatchers.IO) {
            try {
                logger.info { "[MODEL] OllamaModel: Starting model response" }
                logger.info { "   Images count: ${images.size}" }
                
                val finalPrompt = """
                    $prompt
                    
                    IMPORTANT: Do not use any markdown syntax (such as **, ##, etc.) in your response. 
                    Use plain text only.
                """.trimIndent()
                
                val payload = buildJsonObject {
                    put("model", config.model)
                    put("prompt", finalPrompt)
                    if (images.isNotEmpty()) {
                        putJsonArray("images") {
                            add(if (images.size > 1) combineImages(images) else images.first())
                        }
                    }
                    put("stream", false)
                    putJsonObject("options") {
                        put("temperature", config.temperature)
                        put("num_predict", config.maxTokens)
                    }
                }

                logger.info { "[OUT] Sending request to Ollama API..." }
                try {
                    val response = client.post("${config.baseUrl}/api/generate") {
                        contentType(ContentType.Application.Json)
                        setBody(payload.toString())
                    }
                    
                    logger.info { "[IN] Received response from Ollama API" }
                    val responseText = response.bodyAsText()
                    logger.info { "   Response text: $responseText" }
                    
                    val jsonResponse = Json.parseToJsonElement(responseText).jsonObject
                    if (!jsonResponse.containsKey("response")) {
                        logger.error { "[ERROR] Unexpected response format: $jsonResponse" }
                        if (jsonResponse.containsKey("error")) {
                            return@withContext false to "Error: ${jsonResponse["error"]?.jsonPrimitive?.content ?: "Unknown error"}"
                        }
                        return@withContext false to "Error: Unexpected response format from Ollama"
                    }
                    
                    true to (jsonResponse["response"]?.jsonPrimitive?.content ?: throw Exception("No response content"))
                } catch (e: java.net.ConnectException) {
                    logger.error(e) { "[ERROR] Failed to connect to Ollama server" }
                    false to "Error: Ollama server is not running. Please start the Ollama server and try again."
                } catch (e: Exception) {
                    logger.error(e) { "[ERROR] Error in Ollama response: ${e.message}" }
                    false to "Error: ${e.message}"
                }
            } catch (e: Exception) {
                logger.error(e) { "[ERROR] Unexpected error in Ollama model: ${e.message}" }
                logger.error { "   Stack trace: ${e.stackTraceToString()}" }
                false to "Error: Failed to process images: ${e.message}"
            }
        }

    override suspend fun translate_to_english(text: String): Pair<Boolean, String> = 
        withContext(Dispatchers.IO) {
            try {
                logger.info { "Starting translation to English" }
                
                val response = client.post("${config.baseUrl}/api/generate") {
                    contentType(ContentType.Application.Json)
                    setBody(buildJsonObject {
                        put("model", config.model)
                        put("prompt", """
                            You are a translator. Your task is to translate non-English text to English while preserving any English text unchanged. 
                            For example:
                            Input: "Hello bonjour World"
                            Output: "Hello hello World"
                            
                            Only translate the non-English parts and keep English parts exactly as they are.
                            
                            Text to translate:
                            $text
                        """.trimIndent())
                        put("stream", false)
                        putJsonObject("options") {
                            put("temperature", 0.3)
                            put("num_predict", config.maxTokens)
                        }
                    })
                }

                val responseText = response.bodyAsText()
                val jsonResponse = Json.parseToJsonElement(responseText).jsonObject
                
                if (!jsonResponse.containsKey("response")) {
                    logger.error { "Unexpected response format: $jsonResponse" }
                    if (jsonResponse.containsKey("error")) {
                        return@withContext false to "Translation error: ${jsonResponse["error"]?.jsonPrimitive?.content ?: "Unknown error"}"
                    }
                    return@withContext false to "Error: Unexpected response format from Ollama"
                }
                
                val translatedText = jsonResponse["response"]?.jsonPrimitive?.content
                    ?: throw Exception("No response content")
                
                true to translatedText.trim()
            } catch (e: Exception) {
                logger.error(e) { "Translation failed: ${e.message}" }
                false to "Translation error: ${e.message}"
            }
        }

    fun close() {
        client.close()
        logger.info { "[END] OllamaModel: Client closed" }
    }

    companion object : KLogging()
}