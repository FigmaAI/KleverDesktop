package com.klever.desktop.server.models

interface AIModel {
    suspend fun get_model_response(
        prompt: String,
        images: List<String>
    ): Pair<Boolean, String>
    
    suspend fun translate_to_english(
        text: String
    ): Pair<Boolean, String>
} 