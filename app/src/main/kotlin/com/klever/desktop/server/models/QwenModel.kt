// package com.klever.desktop.server.models

// import okhttp3.OkHttpClient
// import okhttp3.Request
// import okhttp3.RequestBody.Companion.toRequestBody
// import okhttp3.MediaType.Companion.toMediaType
// import kotlinx.serialization.json.*
// import kotlinx.coroutines.Dispatchers
// import kotlinx.coroutines.withContext
// import com.klever.desktop.server.config.ModelConfig
// import com.klever.desktop.server.config.QwenConfig
// import com.fasterxml.jackson.databind.ObjectMapper

// class QwenModel(private val config: QwenConfig) : AIModel {
//     private val mapper = ObjectMapper()
//     private val client = OkHttpClient()
//     private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

//     override suspend fun get_model_response(prompt: String, images: List<String>): Pair<Boolean, String> = 
//         withContext(Dispatchers.IO) {
//             try {
//                 val content = buildJsonArray {
//                     addJsonObject {
//                         put("text", prompt)
//                     }
//                     images.forEach { imageBase64 ->
//                         addJsonObject {
//                             put("image", imageBase64)
//                         }
//                     }
//                 }

//                 val payload = buildJsonObject {
//                     put("model", config.model)
//                     put("messages", buildJsonArray {
//                         addJsonObject {
//                             put("role", "user")
//                             put("content", content)
//                         }
//                     })
//                 }

//                 val request = Request.Builder()
//                     .url(config.baseUrl)
//                     .addHeader("Authorization", "Bearer ${config.apiKey}")
//                     .post(payload.toString().toRequestBody(jsonMediaType))
//                     .build()

//                 val response = client.newCall(request).execute()
//                 val responseBody = response.body?.string() ?: throw Exception("Empty response")
//                 val jsonResponse = Json.parseToJsonElement(responseBody).jsonObject

//                 if (response.isSuccessful) {
//                     val content = jsonResponse["output"]?.jsonObject
//                         ?.get("choices")?.jsonArray?.get(0)?.jsonObject
//                         ?.get("message")?.jsonObject?.get("content")?.jsonArray?.get(0)
//                         ?.jsonObject?.get("text")?.jsonPrimitive?.content
//                         ?: throw Exception("Invalid response format")
//                     Pair(true, content)
//                 } else {
//                     val error = jsonResponse["message"]?.jsonPrimitive?.content ?: "Unknown error"
//                     Pair(false, error)
//                 }
//             } catch (e: Exception) {
//                 Pair(false, e.message ?: "Unknown error")
//             }
//         }

//     private fun buildRequestBody(prompt: String, imageContent: List<String>): String {
//         val messages = mutableListOf<Map<String, Any>>()
        
//         imageContent.forEach { base64Image ->
//             messages.add(mapOf(
//                 "role" to "user",
//                 "content" to listOf(
//                     mapOf(
//                         "image" to base64Image
//                     )
//                 )
//             ))
//         }
        
//         messages.add(mapOf(
//             "role" to "user",
//             "content" to listOf(
//                 mapOf(
//                     "text" to prompt
//                 )
//             )
//         ))

//         return mapper.writeValueAsString(mapOf(
//             "model" to config.model,
//             "messages" to messages
//         ))
//     }
// } 