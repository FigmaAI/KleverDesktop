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
            // Base64 디코딩 및 BufferedImage로 변환
            val bufferedImages = images.map { base64Str ->
                val imageBytes = Base64.getDecoder().decode(base64Str)
                ImageIO.read(ByteArrayInputStream(imageBytes))
            }
            
            // 결과 이미지 크기 계산 (가로로 배치)
            val totalWidth = bufferedImages.sumOf { it.width }
            val maxHeight = bufferedImages.maxOf { it.height }
            
            // 새 이미지 생성
            val combined = BufferedImage(totalWidth, maxHeight, BufferedImage.TYPE_INT_RGB)
            val g2d = combined.createGraphics()
            
            // 이미지 배치
            var x = 0
            bufferedImages.forEach { img ->
                g2d.drawImage(img, x, 0, null)
                x += img.width
            }
            g2d.dispose()
            
            // Base64로 다시 인코딩
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
    ): Pair<Boolean, String> {
        logger.info { "🤖 OllamaModel: Starting model response" }
        logger.info { "   Images count: ${images.size}" }
        
        return try {
            val combinedImage = if (images.size > 1) {
                logger.info { "Combining ${images.size} images into one..." }
                combineImages(images)
            } else {
                images.first()
            }
            
            val formattedPrompt = """
                $prompt
                
                Important: Format your response exactly as follows:
                1. DO NOT use any markdown formatting (no *, _, #, `, etc.)
                2. Each action MUST contain its own number
            """.trimIndent()
            
            logger.info { "📤 Sending request to Ollama API..." }
            try {
                val response = client.post("${config.baseUrl}/api/generate") {
                    contentType(ContentType.Application.Json)
                    setBody(buildJsonObject {
                        put("model", config.model)
                        put("prompt", formattedPrompt)
                        putJsonArray("images") {
                            add(combinedImage)
                        }
                        put("stream", false)
                        putJsonObject("options") {
                            put("temperature", config.temperature)
                            put("num_predict", config.maxTokens)
                        }
                    }.toString())
                }
                
                logger.info { "📥 Received response from Ollama API" }
                val responseText = response.bodyAsText()
                logger.info { "   Response text: $responseText" }
                
                val jsonResponse = Json.parseToJsonElement(responseText).jsonObject
                if (!jsonResponse.containsKey("response")) {
                    logger.error { "❌ Unexpected response format: $jsonResponse" }
                    if (jsonResponse.containsKey("error")) {
                        return false to "Error: ${jsonResponse["error"]?.jsonPrimitive?.content ?: "Unknown error"}"
                    }
                    return false to "Error: Unexpected response format from Ollama"
                }
                
                true to (jsonResponse["response"]?.jsonPrimitive?.content ?: throw Exception("No response content"))
            } catch (e: java.net.ConnectException) {
                logger.error(e) { "❌ Failed to connect to Ollama server" }
                false to "Error: Ollama server is not running. Please start the Ollama server and try again."
            } catch (e: Exception) {
                logger.error(e) { "❌ Error in Ollama response: ${e.message}" }
                false to "Error: ${e.message}"
            }
        } catch (e: Exception) {
            logger.error(e) { "❌ Unexpected error in Ollama model: ${e.message}" }
            logger.error { "   Stack trace: ${e.stackTraceToString()}" }
            false to "Error: Failed to process images: ${e.message}"
        }
    }

    fun close() {
        client.close()
        logger.info { "🔚 OllamaModel: Client closed" }
    }

    companion object : KLogging()
}