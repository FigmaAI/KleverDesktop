package com.klever.desktop.server.models

interface AIModel {
    suspend fun get_model_response(
        prompt: String,
        images: List<String>
    ): Pair<Boolean, String>
} 