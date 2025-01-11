package com.klever.desktop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.ui.Alignment
import com.klever.desktop.model.ModelConfig
import com.klever.desktop.model.OpenAIConfig
import com.klever.desktop.model.QwenConfig
import com.klever.desktop.repository.ModelConfigRepository

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettings() {
    val repository = remember { ModelConfigRepository() }
    var savedConfigs by remember { mutableStateOf(repository.loadConfigs()) }
    
    // 새 모델 입력 상태
    var modelType by remember { mutableStateOf("OpenAI") }
    var modelName by remember { mutableStateOf("") }
    var apiKey by remember { mutableStateOf("") }
    var baseUrl by remember { mutableStateOf("https://api.openai.com/v1/chat/completions") }
    var model by remember { mutableStateOf("gpt-4o") }
    var temperature by remember { mutableStateOf(0.0f) }
    var maxTokens by remember { mutableStateOf(300) }
    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // "Add New Model" 제목 제거

            // 모델 타입 선택 (드롭다운으로 변경)
            Box {
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it }
                ) {
                    OutlinedTextField(
                        value = modelType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Model Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("OpenAI") },
                            onClick = {
                                modelType = "OpenAI"
                                expanded = false
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("Qwen") },
                            onClick = {
                                modelType = "Qwen"
                                expanded = false
                            }
                        )
                    }
                }
            }

            // 공통 필드
            OutlinedTextField(
                value = modelName,
                onValueChange = { modelName = it },
                label = { Text("Model Name") },
                modifier = Modifier.fillMaxWidth()
            )
            
            OutlinedTextField(
                value = apiKey,
                onValueChange = { apiKey = it },
                label = { Text("API Key") },
                modifier = Modifier.fillMaxWidth()
            )

            // 모델별 특수 필드
            when (modelType) {
                "OpenAI" -> {
                    OutlinedTextField(
                        value = baseUrl,
                        onValueChange = { baseUrl = it },
                        label = { Text("Base URL") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = model,
                        onValueChange = { model = it },
                        label = { Text("Model") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = temperature.toString(),
                        onValueChange = { temperature = it.toFloatOrNull() ?: 0.0f },
                        label = { Text("Temperature") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = maxTokens.toString(),
                        onValueChange = { maxTokens = it.toIntOrNull() ?: 300 },
                        label = { Text("Max Tokens") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                "Qwen" -> {
                    OutlinedTextField(
                        value = model,
                        onValueChange = { model = it },
                        label = { Text("Model") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // 하단 고정 저장 버튼
        Surface(
            modifier = Modifier.fillMaxWidth(),
            // shadowElevation = 8.dp
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Button(
                    onClick = {
                        val newConfig = when (modelType) {
                            "OpenAI" -> OpenAIConfig(
                                name = modelName,
                                apiKey = apiKey,
                                baseUrl = baseUrl,
                                model = model,
                                temperature = temperature,
                                maxTokens = maxTokens
                            )
                            "Qwen" -> QwenConfig(
                                name = modelName,
                                apiKey = apiKey,
                                model = model
                            )
                            else -> null
                        }
                        if (newConfig != null) {
                            savedConfigs = savedConfigs + newConfig
                            repository.saveConfigs(savedConfigs)
                            // 입력 필드 초기화
                            modelName = ""
                            apiKey = ""
                            model = if (modelType == "OpenAI") "gpt-3.5-turbo" else ""
                        }
                    },
                    modifier = Modifier.align(Alignment.CenterEnd)
                ) {
                    Text("Save Model")
                }
            }
        }
    }
}