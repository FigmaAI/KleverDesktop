package com.klever.desktop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import com.klever.desktop.server.config.ModelConfig
import com.klever.desktop.server.config.OpenAIConfig
import com.klever.desktop.server.repositories.ModelConfigRepository
import kotlinx.coroutines.launch
import mu.KotlinLogging
import com.klever.desktop.server.models.AIModel
import com.klever.desktop.server.models.OpenAIModel
import com.klever.desktop.server.config.AzureConfig
import com.klever.desktop.server.models.AzureModel
import com.klever.desktop.server.config.OllamaConfig
import com.klever.desktop.server.models.OllamaModel

private val logger = KotlinLogging.logger {}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettings() {
    val repository = remember { ModelConfigRepository() }
    var currentConfig by remember { mutableStateOf(repository.loadCurrentConfig()) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var isTestSuccessful by remember { mutableStateOf(false) }
    
    // 컴포넌트가 처음 로드될 때와 다시 표시될 때마다 설정을 로드
    DisposableEffect(Unit) {
        val listener = repository.addConfigChangeListener {
            currentConfig = repository.loadCurrentConfig()
        }
        onDispose {
            repository.removeConfigChangeListener(listener)
        }
    }
    
    // 현재 설정이 없으면 기본 OpenAI 설정으로 초기화
    LaunchedEffect(Unit) {
        if (currentConfig == null) {
            currentConfig = OpenAIConfig(
                model = "gpt-4o",
                apiKey = "",
                baseUrl = "https://api.openai.com/v1/chat/completions"
            )
            repository.saveConfig(currentConfig!!)
        }
    }
    
    // UI 상태를 currentConfig와 동기화
    var modelType by remember(currentConfig) { mutableStateOf(
        when (currentConfig) {
            is OpenAIConfig -> "OpenAI"
            is AzureConfig -> "Azure"
            is OllamaConfig -> "Ollama"
            else -> "OpenAI"
        }
    ) }
    
    var apiKey by remember(currentConfig) { mutableStateOf(currentConfig?.apiKey ?: "") }
    var baseUrl by remember(currentConfig) { mutableStateOf(
        when (currentConfig) {
            is OpenAIConfig -> (currentConfig as OpenAIConfig).baseUrl
            is AzureConfig -> (currentConfig as AzureConfig).baseUrl
            is OllamaConfig -> (currentConfig as OllamaConfig).baseUrl
            else -> "https://api.openai.com/v1/chat/completions"
        }
    ) }
    var model by remember(currentConfig) { mutableStateOf(
        when (currentConfig) {
            is OpenAIConfig -> (currentConfig as OpenAIConfig).model
            is AzureConfig -> (currentConfig as AzureConfig).model
            is OllamaConfig -> (currentConfig as OllamaConfig).model
            else -> "gpt-4"
        }
    ) }
    var expanded by remember { mutableStateOf(false) }

    // 설정이 변경될 때마다 UI 업데이트
    LaunchedEffect(currentConfig) {
        if (currentConfig != null) {
            apiKey = currentConfig?.apiKey ?: ""
            baseUrl = when (currentConfig) {
                is OpenAIConfig -> (currentConfig as OpenAIConfig).baseUrl
                is AzureConfig -> (currentConfig as AzureConfig).baseUrl
                is OllamaConfig -> (currentConfig as OllamaConfig).baseUrl
                else -> "https://api.openai.com/v1/chat/completions"
            }
            model = when (currentConfig) {
                is OpenAIConfig -> (currentConfig as OpenAIConfig).model
                is AzureConfig -> (currentConfig as AzureConfig).model
                is OllamaConfig -> (currentConfig as OllamaConfig).model
                else -> "gpt-4"
            }
            modelType = when (currentConfig) {
                is OpenAIConfig -> "OpenAI"
                is AzureConfig -> "Azure"
                is OllamaConfig -> "Ollama"
                else -> "OpenAI"
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.TopCenter)
                .padding(top = 0.dp)
        )

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
                                    model = "gpt-4o"
                                    apiKey = ""
                                    baseUrl = "https://api.openai.com/v1/chat/completions"
                                    expanded = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Azure") },
                                onClick = {
                                    modelType = "Azure"
                                    model = "gpt-4o"
                                    apiKey = ""
                                    baseUrl = ""
                                    expanded = false
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Ollama") },
                                onClick = {
                                    modelType = "Ollama"
                                    model = "llama3.2-vision"
                                    apiKey = ""
                                    baseUrl = "http://localhost:11434"
                                    expanded = false
                                }
                            )
                        }
                    }
                }
                
                if (modelType != "Ollama") {
                    OutlinedTextField(
                        value = apiKey,
                        onValueChange = { apiKey = it },
                        label = { Text("API Key") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                when (modelType) {
                    "OpenAI", "Azure" -> {
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
                    }
                    "Ollama" -> {
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
                    }
                }
            }

            Surface(
                modifier = Modifier.fillMaxWidth(),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    Row(
                        modifier = Modifier.align(Alignment.CenterEnd),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        logger.info { "Creating config for model type: $modelType" }
                                        val config = when (modelType) {
                                            "OpenAI" -> OpenAIConfig(
                                                apiKey = apiKey,
                                                baseUrl = baseUrl,
                                                model = model
                                            ).also { logger.info { "Created OpenAI config: $it" } }
                                            "Azure" -> AzureConfig(
                                                apiKey = apiKey,
                                                baseUrl = baseUrl,
                                                model = model
                                            ).also { logger.info { "Created Azure config: $it" } }
                                            "Ollama" -> OllamaConfig(
                                                model = model,
                                                apiKey = "",
                                                baseUrl = baseUrl
                                            ).also { logger.info { "Created Ollama config: $it" } }
                                            else -> null
                                        }
                                        
                                        logger.info { "Initializing model with config: $config" }
                                        val testModel = when (config) {
                                            is OpenAIConfig -> OpenAIModel(config)
                                            is AzureConfig -> AzureModel(config)
                                            is OllamaConfig -> OllamaModel(config)
                                            else -> null
                                        }
                                        
                                        if (testModel != null) {
                                            logger.info { "Sending test request to model" }
                                            val (success, response) = testModel.get_model_response("Hello, world!", emptyList())
                                            logger.info { "Got response - success: $success, response: $response" }
                                            if (success) {
                                                logger.info { "Test response: $response" }
                                                isTestSuccessful = true
                                                snackbarHostState.showSnackbar(
                                                    "Test successful!",
                                                    duration = SnackbarDuration.Short
                                                )
                                            } else {
                                                isTestSuccessful = false
                                                throw Exception(response)
                                            }
                                        }
                                    } catch (e: Exception) {
                                        isTestSuccessful = false
                                        logger.error(e) { "Test failed with exception" }
                                        snackbarHostState.showSnackbar(
                                            "Test failed: ${e.message}",
                                            duration = SnackbarDuration.Long
                                        )
                                    }
                                }
                            }
                        ) {
                            Text("Test")
                        }
                        
                        Button(
                            onClick = {
                                scope.launch {
                                    try {
                                        val newConfig = when (modelType) {
                                            "OpenAI" -> OpenAIConfig(
                                                apiKey = apiKey,
                                                baseUrl = baseUrl,
                                                model = model
                                            )
                                            "Azure" -> AzureConfig(
                                                apiKey = apiKey,
                                                baseUrl = baseUrl,
                                                model = model
                                            )
                                            "Ollama" -> OllamaConfig(
                                                model = model,
                                                apiKey = "",
                                                baseUrl = baseUrl
                                            )
                                            else -> null
                                        }
                                        
                                        if (newConfig != null) {
                                            repository.saveConfig(newConfig)
                                            currentConfig = newConfig
                                            snackbarHostState.showSnackbar(
                                                "Settings saved successfully",
                                                duration = SnackbarDuration.Short
                                            )
                                        }
                                    } catch (e: Exception) {
                                        snackbarHostState.showSnackbar(
                                            "Failed to save settings: ${e.message}",
                                            duration = SnackbarDuration.Long
                                        )
                                    }
                                }
                            },
                            enabled = isTestSuccessful
                        ) {
                            Text("Save Changes")
                        }
                    }
                }
            }
        }
    }
}