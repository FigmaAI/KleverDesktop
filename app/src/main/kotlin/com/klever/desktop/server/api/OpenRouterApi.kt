package com.klever.desktop.server.api

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import mu.KotlinLogging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

private val logger = KotlinLogging.logger {}

@Serializable
data class OpenRouterModel(
    val id: String,
    val name: String? = null,
    val description: String? = null,
    val pricing: ModelPricing? = null,
    val context_length: Int? = null,
    val architecture: ModelArchitecture? = null
)

@Serializable
data class ModelPricing(
    val prompt: String? = null,
    val completion: String? = null,
    val image: String? = null
)

@Serializable
data class ModelArchitecture(
    val modality: String? = null,
    val tokenizer: String? = null,
    val instruct_type: String? = null
)

@Serializable
data class OpenRouterModelsResponse(
    val data: List<OpenRouterModel>
)

object OpenRouterApi {
    private val client = OkHttpClient()
    private val json = Json { 
        ignoreUnknownKeys = true
        isLenient = true
    }
    
    /**
     * Fetch available models from OpenRouter API
     * https://openrouter.ai/api/v1/models
     */
    suspend fun fetchModels(): Result<List<OpenRouterModel>> = withContext(Dispatchers.IO) {
        try {
            val request = Request.Builder()
                .url("https://openrouter.ai/api/v1/models")
                .get()
                .build()
            
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string() 
                ?: return@withContext Result.failure(Exception("Empty response"))
            
            if (!response.isSuccessful) {
                logger.error { "Failed to fetch models: ${response.code}" }
                return@withContext Result.failure(Exception("HTTP ${response.code}"))
            }
            
            val modelsResponse = json.decodeFromString<OpenRouterModelsResponse>(responseBody)
            logger.info { "Fetched ${modelsResponse.data.size} models from OpenRouter" }
            
            Result.success(modelsResponse.data)
        } catch (e: Exception) {
            logger.error(e) { "Error fetching models from OpenRouter" }
            Result.failure(e)
        }
    }
    
    /**
     * Check if a model supports vision/image input
     */
    fun isVisionModel(model: OpenRouterModel): Boolean {
        // Check architecture modality
        val modality = model.architecture?.modality?.lowercase()
        if (modality != null && (modality.contains("multimodal") || modality.contains("vision"))) {
            return true
        }
        
        // Check model ID for known vision models
        val visionKeywords = listOf(
            "vision",
            "gpt-4-turbo",
            "gpt-4o",
            "claude-3",
            "gemini",
            "llava",
            "qwen-vl",
            "yi-vision"
        )
        
        return visionKeywords.any { keyword -> 
            model.id.lowercase().contains(keyword) || 
            model.name?.lowercase()?.contains(keyword) == true
        }
    }
    
    /**
     * Get all vision-capable models
     */
    fun getVisionModels(allModels: List<OpenRouterModel>): List<OpenRouterModel> {
        return allModels.filter { isVisionModel(it) }
    }
    
    /**
     * Get popular/recommended vision models
     */
    fun getPopularVisionModels(allModels: List<OpenRouterModel>): List<OpenRouterModel> {
        val visionModels = getVisionModels(allModels)
        
        return visionModels
            .sortedWith(
                compareByDescending<OpenRouterModel> { 
                    when {
                        it.id.contains("gpt-4o") -> 5
                        it.id.contains("claude-3.5") || it.id.contains("claude-3-opus") -> 4
                        it.id.contains("gemini-2") || it.id.contains("gemini-pro-vision") -> 3
                        it.id.contains("claude-3") -> 2
                        it.id.contains("gpt-4") -> 1
                        else -> 0
                    }
                }
                .thenBy { it.id }
            )
            .take(8)
    }
    
    /**
     * Format model name for display
     */
    fun formatModelName(model: OpenRouterModel): String {
        return model.name ?: model.id.split("/").lastOrNull()?.let { modelName ->
            modelName.split("-")
                .joinToString(" ") { word -> 
                    word.replaceFirstChar { it.uppercase() }
                }
        } ?: model.id
    }
}
