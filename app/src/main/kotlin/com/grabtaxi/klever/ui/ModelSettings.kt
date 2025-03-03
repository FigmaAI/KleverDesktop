package com.grabtaxi.klever.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import com.grabtaxi.klever.server.config.ModelConfig
import com.grabtaxi.klever.server.config.OpenAIConfig
import com.grabtaxi.klever.server.repositories.ModelConfigRepository
import kotlinx.coroutines.launch
import mu.KotlinLogging
import com.grabtaxi.klever.server.models.AIModel
import com.grabtaxi.klever.server.models.OpenAIModel
import com.grabtaxi.klever.server.config.AzureConfig
import com.grabtaxi.klever.server.models.AzureModel
import com.grabtaxi.klever.server.config.OllamaConfig
import com.grabtaxi.klever.server.models.OllamaModel

private val logger = KotlinLogging.logger {}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettings() {
    val repository = remember { ModelConfigRepository() }
    var currentConfig by remember { mutableStateOf(repository.loadCurrentConfig()) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var isTestSuccessful by remember { mutableStateOf(false) }
    
    // Load settings when the component is first loaded and when it is displayed again
    DisposableEffect(Unit) {
        val listener = repository.addConfigChangeListener {
            currentConfig = repository.loadCurrentConfig()
        }
        onDispose {
            repository.removeConfigChangeListener(listener)
        }
    }
    
    // If no current config, initialize with default OpenAI settings
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
    
    // Sync UI state with currentConfig
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
            else -> "gpt-4o"
        }
    ) }
    var expanded by remember { mutableStateOf(false) }

    // Update UI when settings change
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
                else -> "gpt-4o"
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
                    @OptIn(ExperimentalMaterial3Api::class)
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
                        // Reset button
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        val defaultConfig = OpenAIConfig(
                                            model = "gpt-4o",
                                            apiKey = "",
                                            baseUrl = "https://api.openai.com/v1/chat/completions"
                                        )
                                        repository.saveConfig(defaultConfig)
                                        currentConfig = defaultConfig
                                        isTestSuccessful = false
                                        snackbarHostState.showSnackbar(
                                            "Settings reset to default",
                                            duration = SnackbarDuration.Short
                                        )
                                    } catch (e: Exception) {
                                        snackbarHostState.showSnackbar(
                                            "Failed to reset settings: ${e.message}",
                                            duration = SnackbarDuration.Long
                                        )
                                    }
                                }
                            }
                        ) {
                            Text("Reset to Default")
                        }

                        // Existing Test button
                        OutlinedButton(
                            onClick = {
                                scope.launch {
                                    try {
                                        logger.info { "Starting test with modelType: $modelType" }
                                        logger.info { "Current values - apiKey: ${apiKey.take(5)}..., baseUrl: $baseUrl, model: $model" }
                                        
                                        val config = when (modelType) {
                                            "OpenAI" -> OpenAIConfig(
                                                model = model,
                                                apiKey = apiKey,
                                                baseUrl = baseUrl
                                            ).also { logger.info { "Created OpenAI config: $it" } }
                                            "Azure" -> AzureConfig(
                                                model = model,
                                                apiKey = apiKey,
                                                baseUrl = baseUrl
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
                                                model = model,
                                                apiKey = apiKey,
                                                baseUrl = baseUrl
                                            )
                                            "Azure" -> AzureConfig(
                                                model = model,
                                                apiKey = apiKey,
                                                baseUrl = baseUrl
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettingsDialog(
    onClose: () -> Unit
) {
    var isTestSuccessful by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }
    val repository = remember { ModelConfigRepository() }
    val scope = rememberCoroutineScope()
    
    var currentConfig by remember { mutableStateOf(repository.loadCurrentConfig()) }
    
    LaunchedEffect(Unit) {
        currentConfig = repository.loadCurrentConfig()
        isTestSuccessful = false
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            ModelSettings(
                onTestSuccess = { isTestSuccessful = true },
                onTestFailure = { isTestSuccessful = false },
                snackbarHostState = snackbarHostState,
                initialConfig = currentConfig,
                onConfigChange = { newConfig -> 
                    currentConfig = newConfig
                    scope.launch {
                        repository.saveConfig(newConfig)
                    }
                }
            )

            // Bottom buttons
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)
            ) {
                OutlinedButton(
                    onClick = onClose
                ) {
                    Text("Cancel")
                }

                Button(
                    onClick = {
                        if (isTestSuccessful) {
                            onClose()
                        }
                    },
                    enabled = isTestSuccessful
                ) {
                    Text("Save & Close")
                }
            }
        }

        SnackbarHost(
            hostState = snackbarHostState,
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 16.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettings(
    onTestSuccess: () -> Unit = {},
    onTestFailure: () -> Unit = {},
    snackbarHostState: SnackbarHostState = remember { SnackbarHostState() },
    initialConfig: ModelConfig? = null,
    onConfigChange: (ModelConfig) -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var currentConfig by remember(initialConfig) { mutableStateOf(initialConfig) }
    
    // Initialize UI state from currentConfig
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
            else -> "gpt-4o"
        }
    ) }
    var expanded by remember { mutableStateOf(false) }

    // Update config when UI changes
    LaunchedEffect(modelType, apiKey, baseUrl, model) {
        val newConfig = when (modelType) {
            "OpenAI" -> OpenAIConfig(
                model = model,
                apiKey = apiKey,
                baseUrl = baseUrl
            )
            "Azure" -> AzureConfig(
                model = model,
                apiKey = apiKey,
                baseUrl = baseUrl
            )
            "Ollama" -> OllamaConfig(
                model = model,
                apiKey = "",
                baseUrl = baseUrl
            )
            else -> null
        }
        newConfig?.let { onConfigChange(it) }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Model Type Dropdown
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
                listOf("OpenAI", "Azure", "Ollama").forEach { type ->
                    DropdownMenuItem(
                        text = { Text(type) },
                        onClick = {
                            modelType = type
                            when (type) {
                                "OpenAI" -> {
                                    model = "gpt-4o"
                                    baseUrl = "https://api.openai.com/v1/chat/completions"
                                }
                                "Azure" -> {
                                    model = "gpt-4o"
                                    baseUrl = ""
                                }
                                "Ollama" -> {
                                    model = "llama2"
                                    baseUrl = "http://localhost:11434"
                                }
                            }
                            expanded = false
                        }
                    )
                }
            }
        }

        // API Key (except Ollama)
        if (modelType != "Ollama") {
            OutlinedTextField(
                value = apiKey,
                onValueChange = { apiKey = it },
                label = { Text("API Key") },
                modifier = Modifier.fillMaxWidth()
            )
        }

        // Base URL & Model
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

        // Test and Reset buttons
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedButton(
                onClick = {
                    scope.launch {
                        try {
                            val defaultConfig = OpenAIConfig(
                                model = "gpt-4o",
                                apiKey = "",
                                baseUrl = "https://api.openai.com/v1/chat/completions"
                            )
                            modelType = "OpenAI"
                            model = defaultConfig.model
                            apiKey = defaultConfig.apiKey
                            baseUrl = defaultConfig.baseUrl
                            onTestFailure()
                            snackbarHostState.showSnackbar(
                                "Settings reset to default",
                                duration = SnackbarDuration.Short
                            )
                        } catch (e: Exception) {
                            snackbarHostState.showSnackbar(
                                "Failed to reset settings: ${e.message}",
                                duration = SnackbarDuration.Long
                            )
                        }
                    }
                },
                modifier = Modifier.padding(end = 8.dp)
            ) {
                Text("Reset to Default")
            }
            
            OutlinedButton(
                onClick = {
                    scope.launch {
                        try {
                            val config = when (modelType) {
                                "OpenAI" -> OpenAIConfig(
                                    model = model,
                                    apiKey = apiKey,
                                    baseUrl = baseUrl
                                )
                                "Azure" -> AzureConfig(
                                    model = model,
                                    apiKey = apiKey,
                                    baseUrl = baseUrl
                                )
                                "Ollama" -> OllamaConfig(
                                    model = model,
                                    apiKey = "",
                                    baseUrl = baseUrl
                                )
                                else -> null
                            }

                            if (config != null) {
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
                                        onTestSuccess()
                                        snackbarHostState.showSnackbar("Test successful!")
                                    } else {
                                        onTestFailure()
                                        throw Exception(response)
                                    }
                                }
                            }
                        } catch (e: Exception) {
                            onTestFailure()
                            snackbarHostState.showSnackbar("Test failed: ${e.message}")
                        }
                    }
                }
            ) {
                Text("Test Connection")
            }
        }
    }
}