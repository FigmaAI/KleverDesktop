package com.klever.desktop.server.prompts

class PromptGenerator {
    fun createPromptForTask(
        taskDesc: String,
        personaDesc: String?,
        lastAct: String?
    ): String {
        var prompt = PromptTemplates.SELF_EXPLORE_TASK_WITH_PERSONA
            .replace("<task_description>", taskDesc)
        
        // 페르소나 설명 추가
        prompt = if (!personaDesc.isNullOrBlank()) {
            prompt.replace("<persona_description>", "As a person who is $personaDesc")
        } else {
            prompt.replace("<persona_description>", "")
        }
        
        // 마지막 액션 추가
        prompt = prompt.replace("<last_act>", lastAct ?: "None")
        
        return prompt
    }

    fun createPromptForReflection(
        taskDesc: String,
        personaDesc: String?,
        lastAct: String
    ): String {
        var prompt = PromptTemplates.SELF_EXPLORE_REFLECT_WITH_PERSONA
            .replace("<task_desc>", taskDesc)
        
        // 페르소나 설명 추가
        prompt = if (!personaDesc.isNullOrBlank()) {
            prompt.replace("<persona_description>", "As a person who is $personaDesc")
        } else {
            prompt.replace("<persona_description>", "")
        }
        
        // 마지막 액션 추가
        prompt = prompt.replace("<last_act>", lastAct)
        
        return prompt
    }
} 