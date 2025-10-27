package com.klever.desktop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import com.klever.desktop.server.config.ModelConfig
import com.klever.desktop.server.repositories.ModelConfigRepository
import com.klever.desktop.server.api.OpenRouterApi
import com.klever.desktop.server.api.OpenRouterModel
import kotlinx.coroutines.launch
import mu.KotlinLogging
import com.klever.desktop.server.models.ExternalAPIModel
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close

private val logger = KotlinLogging.logger {}

enum class ConfigTab {
    ACTIVE_CONFIG,
    OPEN_ROUTER,
    CUSTOM
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelSettings(onDismiss: () -> Unit = {}) {
    val repository = remember { ModelConfigRepository() }
    var currentConfig by remember { mutableStateOf(repository.loadCurrentConfig()) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }
    var isTestSuccessful by remember { mutableStateOf(false) }
    var isTesting by remember { mutableStateOf(false) }
    
    // Models state (for OpenRouter tab)
    var availableModels by remember { mutableStateOf<List<OpenRouterModel>>(emptyList()) }
    var visionModels by remember { mutableStateOf<List<OpenRouterModel>>(emptyList()) }
    var popularVisionModels by remember { mutableStateOf<List<OpenRouterModel>>(emptyList()) }
    var isLoadingModels by remember { mutableStateOf(false) }
    var modelsLoadError by remember { mutableStateOf<String?>(null) }
    
    // Load settings when the component is first loaded
    DisposableEffect(Unit) {
        val listener = repository.addConfigChangeListener {
            currentConfig = repository.loadCurrentConfig()
        }
        onDispose {
            repository.removeConfigChangeListener(listener)
        }
    }
    
    // Initialize with default OpenRouter settings if no config exists
    LaunchedEffect(Unit) {
        if (currentConfig == null) {
            currentConfig = ModelConfig(
                model = "openai/gpt-4o",
                apiKey = "",
                baseUrl = "https://openrouter.ai/api/v1/chat/completions",
                isCustomEndpoint = false
            )
            repository.saveConfig(currentConfig!!)
        }
    }
    
    // Fetch vision models from OpenRouter API
    LaunchedEffect(Unit) {
        isLoadingModels = true
        modelsLoadError = null
        
        val result = OpenRouterApi.fetchModels()
        result.onSuccess { models ->
            availableModels = models
            visionModels = OpenRouterApi.getVisionModels(models)
            popularVisionModels = OpenRouterApi.getPopularVisionModels(models)
            logger.info { "Loaded ${models.size} models, ${visionModels.size} vision models, ${popularVisionModels.size} popular" }
        }.onFailure { error ->
            modelsLoadError = error.message
            logger.error(error) { "Failed to load models" }
        }
        
        isLoadingModels = false
    }
    
    // State variables
    var apiKey by remember(currentConfig) { mutableStateOf(currentConfig?.apiKey ?: "") }
    var model by remember(currentConfig) { mutableStateOf(currentConfig?.model ?: "openai/gpt-4o") }
    var baseUrl by remember(currentConfig) { mutableStateOf(currentConfig?.baseUrl ?: "https://openrouter.ai/api/v1/chat/completions") }
    var showAdvanced by remember { mutableStateOf(false) }
    var temperature by remember(currentConfig) { mutableStateOf(currentConfig?.temperature ?: 0.0f) }
    var maxTokens by remember(currentConfig) { mutableStateOf(currentConfig?.maxTokens ?: 300) }
    var showAllModels by remember { mutableStateOf(false) }
    
    // Tab selection: Show ACTIVE_CONFIG if config exists, otherwise OPEN_ROUTER
    var selectedTab by remember(currentConfig) { 
        mutableStateOf(if (currentConfig != null) ConfigTab.ACTIVE_CONFIG else ConfigTab.OPEN_ROUTER) 
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Header with Tabs - Integrated UI
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp
            ) {
                Column {
                    // Header with Dismiss button
                    Row(
                modifier = Modifier
                    .fillMaxWidth()
                            .padding(start = 24.dp, end = 16.dp, top = 20.dp, bottom = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "AI Model Configuration",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = androidx.compose.material.icons.Icons.Default.Close,
                                contentDescription = "Close",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                    
                    // Tabs integrated with header
                    TabRow(
                        selectedTabIndex = selectedTab.ordinal,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Tab(
                            selected = selectedTab == ConfigTab.ACTIVE_CONFIG,
                            onClick = { selectedTab = ConfigTab.ACTIVE_CONFIG },
                            text = { 
                                Text(
                                    "Active Config",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (selectedTab == ConfigTab.ACTIVE_CONFIG) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                        Tab(
                            selected = selectedTab == ConfigTab.OPEN_ROUTER,
                            onClick = { selectedTab = ConfigTab.OPEN_ROUTER },
                            text = { 
                                Text(
                                    "OpenRouter",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (selectedTab == ConfigTab.OPEN_ROUTER) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                        Tab(
                            selected = selectedTab == ConfigTab.CUSTOM,
                            onClick = { selectedTab = ConfigTab.CUSTOM },
                            text = { 
                                Text(
                                    "Custom Endpoint",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (selectedTab == ConfigTab.CUSTOM) FontWeight.Bold else FontWeight.Normal
                                )
                                }
                            )
                        }
                    }
                }
                
            HorizontalDivider()
            
            // Snackbar at top
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                snackbar = { snackbarData ->
                    Snackbar(
                        snackbarData = snackbarData,
                        containerColor = when {
                            snackbarData.visuals.message.startsWith("✓") -> 
                                MaterialTheme.colorScheme.primaryContainer
                            snackbarData.visuals.message.startsWith("✗") -> 
                                MaterialTheme.colorScheme.errorContainer
                            else -> 
                                MaterialTheme.colorScheme.inverseSurface
                        },
                        contentColor = when {
                            snackbarData.visuals.message.startsWith("✓") -> 
                                MaterialTheme.colorScheme.onPrimaryContainer
                            snackbarData.visuals.message.startsWith("✗") -> 
                                MaterialTheme.colorScheme.onErrorContainer
                            else -> 
                                MaterialTheme.colorScheme.inverseOnSurface
                        },
                        shape = MaterialTheme.shapes.medium,
                        actionColor = MaterialTheme.colorScheme.primary
                    )
                }
            )
            
            // Tab Content with Scroll
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                when (selectedTab) {
                    ConfigTab.ACTIVE_CONFIG -> ActiveConfigTabContent(
                        currentConfig = currentConfig,
                        onConfigureClick = { selectedTab = ConfigTab.OPEN_ROUTER }
                    )
                    
                    ConfigTab.OPEN_ROUTER -> {
                        OpenRouterTabContent(
                            apiKey = apiKey,
                            onApiKeyChange = { apiKey = it },
                            model = model,
                            onModelChange = { model = it },
                            popularVisionModels = popularVisionModels,
                            visionModels = visionModels,
                            isLoadingModels = isLoadingModels,
                            modelsLoadError = modelsLoadError,
                            showAllModels = showAllModels,
                            onShowAllModelsChange = { showAllModels = it }
                        )
                        
                        // Advanced Settings
                        AdvancedSettings(
                            showAdvanced = showAdvanced,
                            onShowAdvancedChange = { showAdvanced = it },
                            temperature = temperature,
                            onTemperatureChange = { temperature = it },
                            maxTokens = maxTokens,
                            onMaxTokensChange = { maxTokens = it }
                        )
                    }
                    
                    ConfigTab.CUSTOM -> {
                        CustomTabContent(
                            baseUrl = baseUrl,
                            onBaseUrlChange = { baseUrl = it },
                            apiKey = apiKey,
                            onApiKeyChange = { apiKey = it },
                            model = model,
                            onModelChange = { model = it }
                        )
                        
                        // Advanced Settings
                        AdvancedSettings(
                            showAdvanced = showAdvanced,
                            onShowAdvancedChange = { showAdvanced = it },
                            temperature = temperature,
                            onTemperatureChange = { temperature = it },
                            maxTokens = maxTokens,
                            onMaxTokensChange = { maxTokens = it }
                        )
                    }
                }
            }
            
            // Action Buttons (Fixed at bottom) - Only show for config tabs, not for active config view
            if (selectedTab != ConfigTab.ACTIVE_CONFIG) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    ActionButtons(
                apiKey = apiKey,
                model = model,
                isTesting = isTesting,
                isTestSuccessful = isTestSuccessful,
                onTest = {
                                scope.launch {
                                    try {
                            isTesting = true
                                        isTestSuccessful = false
                            
                            logger.info { "Testing with API key length: ${apiKey.length}, first 10 chars: ${apiKey.take(10)}" }
                            logger.info { "Model: $model, BaseURL: ${if (selectedTab == ConfigTab.CUSTOM) baseUrl else "https://openrouter.ai/api/v1/chat/completions"}" }
                            
                            val testConfig = ModelConfig(
                                                model = model,
                                                apiKey = apiKey,
                                baseUrl = if (selectedTab == ConfigTab.CUSTOM) baseUrl else "https://openrouter.ai/api/v1/chat/completions",
                                temperature = temperature,
                                maxTokens = maxTokens,
                                isCustomEndpoint = selectedTab == ConfigTab.CUSTOM
                            )
                            
                            val modelInstance = ExternalAPIModel(testConfig)
                            val (success, response) = modelInstance.translate_to_english("Test")
                            
                                            if (success) {
                                                isTestSuccessful = true
                                                snackbarHostState.showSnackbar(
                                        message = "✓ Connection successful!",
                                        duration = SnackbarDuration.Short,
                                        withDismissAction = true
                                                )
                                            } else {
                                    snackbarHostState.showSnackbar(
                                        message = "✗ Test failed: $response",
                                        duration = SnackbarDuration.Long,
                                        withDismissAction = true
                                    )
                                        }
                                    } catch (e: Exception) {
                                logger.error(e) { "Test failed" }
                                        snackbarHostState.showSnackbar(
                                    message = "✗ Error: ${e.message}",
                                    duration = SnackbarDuration.Long,
                                    withDismissAction = true
                                )
                            } finally {
                                isTesting = false
                            }
                    }
                },
                    onSave = {
                        scope.launch {
                            // Check if test was successful
                            if (!isTestSuccessful) {
                                snackbarHostState.showSnackbar(
                                    message = "⚠️ Please test the connection before saving",
                                    duration = SnackbarDuration.Long,
                                    withDismissAction = true
                                )
                                return@launch
                            }
                            
                            try {
                                val config = ModelConfig(
                                                model = model,
                                                apiKey = apiKey,
                                    baseUrl = if (selectedTab == ConfigTab.CUSTOM) baseUrl else "https://openrouter.ai/api/v1/chat/completions",
                                    temperature = temperature,
                                    maxTokens = maxTokens,
                                    isCustomEndpoint = selectedTab == ConfigTab.CUSTOM
                                )
                                
                                repository.saveConfig(config)
                                currentConfig = config
                                
                                logger.info { "Configuration saved: model=$model, custom=${selectedTab == ConfigTab.CUSTOM}" }
                                
                                            snackbarHostState.showSnackbar(
                                    message = "✓ Settings saved successfully!",
                                    duration = SnackbarDuration.Short,
                                    withDismissAction = true
                                            )
                                
                                // Switch to Active Config tab after saving
                                selectedTab = ConfigTab.ACTIVE_CONFIG
                                    } catch (e: Exception) {
                                logger.error(e) { "Failed to save configuration" }
                                        snackbarHostState.showSnackbar(
                                    message = "✗ Failed to save: ${e.message}",
                                    duration = SnackbarDuration.Long,
                                    withDismissAction = true
                                        )
                                    }
                                }
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun ActiveConfigTabContent(
    currentConfig: ModelConfig?,
    onConfigureClick: () -> Unit
) {
    if (currentConfig == null) {
        // No configuration - show setup prompt
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            Text(
                text = "🔧",
                style = MaterialTheme.typography.displayLarge
            )
            
            Text(
                text = "No Configuration Found",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            
            Text(
                text = "Configure your AI model to start using KleverDesktop",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            
            Button(
                onClick = onConfigureClick,
                modifier = Modifier.padding(top = 16.dp)
            ) {
                Text("Configure Now")
            }
        }
    } else {
        // Show current configuration
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (currentConfig.isCustomEndpoint) {
                // Custom Endpoint Configuration
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.secondaryContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "✓ Active Configuration",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onSecondaryContainer
                            )
                            Surface(
                                color = MaterialTheme.colorScheme.secondary,
                                shape = MaterialTheme.shapes.small
                            ) {
                                Text(
                                    text = "CUSTOM",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSecondary,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }
                        
                        HorizontalDivider(color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.2f))
                        
                        ConfigInfoRow("Endpoint:", currentConfig.baseUrl.take(50) + if (currentConfig.baseUrl.length > 50) "..." else "")
                        ConfigInfoRow("Model:", currentConfig.model)
                        ConfigInfoRow("API Key:", if (currentConfig.apiKey.isNotEmpty()) "✓ Configured" else "Not set")
                        
                        HorizontalDivider(color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.2f))
                        
                        ConfigInfoRow("Temperature:", currentConfig.temperature.toString())
                        ConfigInfoRow("Max Tokens:", currentConfig.maxTokens.toString())
                    }
                }
            } else {
                // OpenRouter Configuration
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
        Column(
                        modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "✓ Active Configuration",
                                style = MaterialTheme.typography.titleLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Surface(
                                color = MaterialTheme.colorScheme.primary,
                                shape = MaterialTheme.shapes.small
                            ) {
                                Text(
                                    text = "OPENROUTER",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }
                        
                        HorizontalDivider(color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
                        
                        ConfigInfoRow("Model:", currentConfig.model)
                        ConfigInfoRow("API Key:", if (currentConfig.apiKey.isNotEmpty()) "✓ Configured" else "Not set")
                        ConfigInfoRow("Provider:", currentConfig.model.split("/").firstOrNull()?.uppercase() ?: "Unknown")
                        
                        HorizontalDivider(color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f))
                        
                        ConfigInfoRow("Temperature:", currentConfig.temperature.toString())
                        ConfigInfoRow("Max Tokens:", currentConfig.maxTokens.toString())
                        
                        Text(
                            text = "🌐 Unified access to 300+ AI models",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f),
                            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                        )
                    }
                }
            }
            
            // Action Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onConfigureClick,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Edit Configuration")
                }
            }
        }
    }
}

@Composable
fun ConfigInfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun OpenRouterTabContent(
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    model: String,
    onModelChange: (String) -> Unit,
    popularVisionModels: List<OpenRouterModel>,
    visionModels: List<OpenRouterModel>,
    isLoadingModels: Boolean,
    modelsLoadError: String?,
    showAllModels: Boolean,
    onShowAllModelsChange: (Boolean) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // API Key Section
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "OpenRouter API Key",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    TextButton(
                        onClick = {
                            try {
                                val desktop = java.awt.Desktop.getDesktop()
                                desktop.browse(java.net.URI("https://openrouter.ai/keys"))
                            } catch (e: Exception) {
                                mu.KotlinLogging.logger {}.error(e) { "Failed to open browser" }
                            }
                        }
                    ) {
                        Text("Get API Key →")
                    }
                }
                
                OutlinedTextField(
                    value = apiKey,
                    onValueChange = { value -> 
                        // Remove all whitespace and newlines
                        onApiKeyChange(value.replace(Regex("\\s"), ""))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("API Key") },
                    placeholder = { Text("sk-or-...") },
                    singleLine = true
                )
                
                Text(
                    text = "Access 300+ AI models through a single API",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        // Vision Models Selection
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Select Vision Model",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold
                        )
                        Text(
                            text = "Only vision-capable models are shown",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    if (isLoadingModels) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                    }
                }
                
                if (modelsLoadError != null) {
                    Text(
                        text = "⚠️ Failed to load models: $modelsLoadError",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                
                // Popular vision models
                if (popularVisionModels.isNotEmpty()) {
                    Text(
                        text = "Popular Vision Models:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        popularVisionModels.chunked(2).forEach { rowModels ->
                            Row(
        modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowModels.forEach { openRouterModel ->
                                    val displayName = OpenRouterApi.formatModelName(openRouterModel)
                                    FilterChip(
                                        selected = model == openRouterModel.id,
                                        onClick = { onModelChange(openRouterModel.id) },
                                        label = { 
                                            Text(
                                                displayName,
                                                style = MaterialTheme.typography.bodySmall,
                                                maxLines = 1
                                            )
                                        },
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                                if (rowModels.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Custom model input
            OutlinedTextField(
                    value = model,
                    onValueChange = onModelChange,
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Model ID") },
                    placeholder = { Text("provider/model-name") },
                    supportingText = { 
                        Text("Format: provider/model-name (e.g., openai/gpt-4o)")
                    },
                    singleLine = true
                )
                
                // Show all vision models
                if (visionModels.isNotEmpty()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(
                            onClick = {
                                try {
                                    val desktop = java.awt.Desktop.getDesktop()
                                    desktop.browse(java.net.URI("https://openrouter.ai/docs/models"))
                                } catch (e: Exception) {
                                    mu.KotlinLogging.logger {}.error(e) { "Failed to open browser" }
                                }
                            }
                        ) {
                            Text("View documentation →")
                        }
                        
                        TextButton(
                            onClick = { onShowAllModelsChange(!showAllModels) }
                        ) {
                            Text(if (showAllModels) "Hide models" else "Show all vision models (${visionModels.size})")
                        }
                    }
                }
                
                // All vision models list
                if (showAllModels && visionModels.isNotEmpty()) {
                    Card(
                modifier = Modifier
                    .fillMaxWidth()
                            .heightIn(max = 300.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surface
                        )
                    ) {
                        Column(
                            modifier = Modifier
                                .verticalScroll(rememberScrollState())
                                .padding(8.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            visionModels.forEach { openRouterModel ->
                                val displayName = OpenRouterApi.formatModelName(openRouterModel)
                                TextButton(
                        onClick = {
                                        onModelChange(openRouterModel.id)
                                        onShowAllModelsChange(false)
                                    },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalAlignment = Alignment.Start
                                    ) {
                                        Text(
                                            text = displayName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (model == openRouterModel.id) FontWeight.Bold else FontWeight.Normal
                                        )
                                        Text(
                                            text = openRouterModel.id,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                if (openRouterModel != visionModels.last()) {
                                    HorizontalDivider()
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CustomTabContent(
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    model: String,
    onModelChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Info Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.secondaryContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "ℹ️ Custom Endpoint",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
                Text(
                    text = "Configure direct API access to OpenAI, Ollama, or other OpenAI-compatible endpoints. Make sure your model supports vision/image input.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }
        
        // Configuration
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Endpoint Configuration",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                
                // Base URL
        OutlinedTextField(
            value = baseUrl,
                    onValueChange = { value -> 
                        // Remove whitespace and newlines
                        onBaseUrlChange(value.replace(Regex("\\s"), ""))
                    },
                    modifier = Modifier.fillMaxWidth(),
            label = { Text("Base URL") },
                    placeholder = { Text("https://api.openai.com/v1/chat/completions") },
                    supportingText = { 
                        Text("Full endpoint URL including path")
                    },
                    singleLine = true
                )
                
                // API Key
                OutlinedTextField(
                    value = apiKey,
                    onValueChange = { value -> 
                        // Remove all whitespace and newlines
                        onApiKeyChange(value.replace(Regex("\\s"), ""))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("API Key") },
                    placeholder = { Text("Your API key") },
                    supportingText = { 
                        Text("Leave empty if not required (e.g., local Ollama)")
                    },
                    singleLine = true
                )
                
                // Model Name
        OutlinedTextField(
            value = model,
                    onValueChange = { value -> 
                        // Trim whitespace and newlines
                        onModelChange(value.trim().replace(Regex("[\\n\\r]"), ""))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Model Name") },
                    placeholder = { Text("gpt-4o, llava, etc.") },
                    supportingText = { 
                        Text("Model identifier as expected by the endpoint")
                    },
                    singleLine = true
                )
            }
        }
        
        // Examples
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Examples",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                
                ExampleConfig(
                    title = "OpenAI",
                    url = "https://api.openai.com/v1/chat/completions",
                    model = "gpt-4o",
                    onClick = {
                        onBaseUrlChange("https://api.openai.com/v1/chat/completions")
                        onModelChange("gpt-4o")
                    }
                )
                
                HorizontalDivider()
                
                ExampleConfig(
                    title = "Ollama (Local)",
                    url = "http://localhost:11434/v1/chat/completions",
                    model = "llava",
                    onClick = {
                        onBaseUrlChange("http://localhost:11434/v1/chat/completions")
                        onModelChange("llava")
                        onApiKeyChange("")
                    }
                )
            }
        }
    }
}

@Composable
fun ExampleConfig(
    title: String,
    url: String,
    model: String,
    onClick: () -> Unit
) {
    TextButton(
        onClick = onClick,
            modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = "URL: $url",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Model: $model",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun AdvancedSettings(
    showAdvanced: Boolean,
    onShowAdvancedChange: (Boolean) -> Unit,
    temperature: Float,
    onTemperatureChange: (Float) -> Unit,
    maxTokens: Int,
    onMaxTokensChange: (Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Advanced Settings",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                
                TextButton(onClick = { onShowAdvancedChange(!showAdvanced) }) {
                    Text(if (showAdvanced) "Hide" else "Show")
                }
            }
            
            if (showAdvanced) {
                // Temperature
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Temperature", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            String.format("%.1f", temperature),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Slider(
                        value = temperature,
                        onValueChange = onTemperatureChange,
                        valueRange = 0f..2f,
                        steps = 19
                    )
                    Text(
                        "Lower = more focused, Higher = more creative",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Max Tokens
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Max Tokens", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            maxTokens.toString(),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    Slider(
                        value = maxTokens.toFloat(),
                        onValueChange = { onMaxTokensChange(it.toInt()) },
                        valueRange = 100f..2000f,
                        steps = 18
                    )
                    Text(
                        "Maximum length of the response",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
fun ActionButtons(
    apiKey: String,
    model: String,
    isTesting: Boolean,
    isTestSuccessful: Boolean,
    onTest: () -> Unit,
    onSave: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
            onClick = onTest,
            modifier = Modifier.weight(1f),
            enabled = apiKey.isNotBlank() && model.isNotBlank() && !isTesting
        ) {
            if (isTesting) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Testing...")
            } else if (isTestSuccessful) {
                Text("✓ Test Connection")
            } else {
                Text("Test Connection")
            }
        }
        
        Button(
            onClick = onSave,
            modifier = Modifier.weight(1f),
            enabled = apiKey.isNotBlank() && model.isNotBlank()
        ) {
            Text("Save Settings")
        }
    }
}

@Composable
fun CurrentConfigInfo(config: ModelConfig) {
    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
    
    if (config.isCustomEndpoint) {
        // Custom Endpoint Configuration
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.tertiaryContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "✓ Active Configuration",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = MaterialTheme.colorScheme.tertiary
                    ) {
                        Text(
                            text = "CUSTOM",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.onTertiary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
                
                // Endpoint URL
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Endpoint:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    Text(
                        text = config.baseUrl.take(40) + if (config.baseUrl.length > 40) "..." else "",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.8f)
                    )
                }
                
                // Model
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Model:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    Text(
                        text = config.model,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                }
                
                // API Key status
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "API Key:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onTertiaryContainer
                    )
                    Text(
                        text = if (config.apiKey.isNotEmpty()) "✓ Configured" else "Not set",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.8f)
                    )
                }
                
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
                
                // Parameters
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Temperature:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = config.temperature.toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Max Tokens:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = config.maxTokens.toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onTertiaryContainer.copy(alpha = 0.7f)
                    )
                }
            }
        }
                                    } else {
        // OpenRouter Configuration
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "✓ Active Configuration",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Surface(
                        shape = MaterialTheme.shapes.small,
                        color = MaterialTheme.colorScheme.primary
                    ) {
                        Text(
                            text = "OPENROUTER",
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = MaterialTheme.colorScheme.onPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
                
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
                
                // Model
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Model:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = config.model,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
                
                // API Key status
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "API Key:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = if (config.apiKey.isNotEmpty()) "✓ Configured" else "Not set",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                    )
                }
                
                // Provider info
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Provider:",
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = config.model.split("/").firstOrNull()?.uppercase() ?: "Unknown",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                    )
                }
                
                HorizontalDivider(
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.2f),
                    modifier = Modifier.padding(vertical = 4.dp)
                )
                
                // Parameters
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Temperature:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = config.temperature.toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Max Tokens:",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = config.maxTokens.toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
                
                // Access info
                Text(
                    text = "🌐 Unified access to 300+ AI models",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f),
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
