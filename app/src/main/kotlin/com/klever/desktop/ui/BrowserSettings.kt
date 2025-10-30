package com.klever.desktop.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.Alignment
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import com.klever.desktop.server.config.BrowserConfig
import com.klever.desktop.server.repositories.BrowserConfigRepository
import com.klever.desktop.browser.BrowserType
import com.klever.desktop.browser.BrowserFactory
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.delay
import mu.KotlinLogging
import org.openqa.selenium.WebDriver

private val logger = KotlinLogging.logger {}

enum class BrowserTab { ACTIVE_BROWSER, CHROME, SAFARI, EDGE }

/**
 * Test a specific browser by launching it with Selenium
 * Returns true if successful, false otherwise
 */
private suspend fun testBrowser(browserType: BrowserType, snackbarHost: SnackbarHostState): Boolean {
    logger.info { "Testing browser: ${browserType.displayName}" }
    
    val testBrowser = BrowserFactory.getBrowserDriver(browserType)
    
    if (testBrowser == null) {
        snackbarHost.showSnackbar(
            message = "✗ ${browserType.displayName} not available",
            duration = SnackbarDuration.Long,
            withDismissAction = true
        )
        return false
    }
    
    // Try to setup and create driver
    val result = withContext(Dispatchers.IO) {
        var driver: WebDriver? = null
        try {
            testBrowser.setupDriver()
            
            // Create a temporary user data directory
            val tempDir = java.io.File.createTempFile("klever_test_", "_browser")
            tempDir.delete()
            tempDir.mkdirs()
            
            driver = testBrowser.createDriver(tempDir)
            
            // Maximize window to full screen
            driver.manage().window().maximize()
            logger.info { "Browser window maximized" }
            
            // Navigate to a simple test page
            driver.get("https://www.google.com")
            
            // Wait a bit to ensure page loads
            delay(2000)
            
            // Clean up
            delay(1000)
            driver.quit()
            tempDir.deleteRecursively()
            
            // Return success
            Result.success(browserType.displayName)
            
        } catch (e: Exception) {
            logger.error(e) { "Browser test failed" }
            
            driver?.quit()
            
            // Return friendly error message
            val errorMessage = when {
                e.message?.contains("Allow Remote Automation", ignoreCase = true) == true -> {
                    "Safari Setup Required" to "Enable 'Allow Remote Automation' in Safari > Develop menu"
                }
                e.message?.contains("not found", ignoreCase = true) == true -> {
                    "Browser Not Found" to "${browserType.displayName} is not installed"
                }
                e.message?.contains("Failed to connect", ignoreCase = true) == true -> {
                    "Connection Failed" to "Close all browser windows and try again"
                }
                else -> {
                    "Test Failed" to (e.message?.take(150) ?: "Unknown error")
                }
            }
            
            Result.failure(Exception("${errorMessage.first}|||${errorMessage.second}"))
        }
    }
    
    // Handle result
    return result.fold(
        onSuccess = { browserName ->
            snackbarHost.showSnackbar(
                message = "✓ $browserName is ready!",
                duration = SnackbarDuration.Short,
                withDismissAction = true
            )
            true
        },
        onFailure = { e ->
            val parts = e.message?.split("|||") ?: listOf("Error", "Test failed")
            val title = parts.getOrNull(0) ?: "Error"
            val details = parts.getOrNull(1) ?: "Test failed"
            
            snackbarHost.showSnackbar(
                message = "✗ $title",
                duration = SnackbarDuration.Long,
                withDismissAction = true
            )
            
            logger.info { "Browser test failed: $title\nDetails: $details" }
            false
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowserSettings(onDismiss: () -> Unit = {}) {
    val repository = remember { BrowserConfigRepository() }
    var currentConfig by remember { mutableStateOf(repository.loadConfig()) }
    
    val availableBrowsers = remember { BrowserFactory.getAvailableBrowsers() }
    
    // Default browser selection based on what's available
    val defaultBrowser = when {
        availableBrowsers.containsKey(BrowserType.CHROME) -> BrowserType.CHROME
        availableBrowsers.containsKey(BrowserType.SAFARI) -> BrowserType.SAFARI
        availableBrowsers.containsKey(BrowserType.EDGE) -> BrowserType.EDGE
        else -> BrowserType.CHROME
    }
    
    var selectedBrowser by remember { mutableStateOf(currentConfig?.browserType ?: defaultBrowser) }
    
    // Test status for each browser
    var isSafariTested by remember { mutableStateOf(false) }
    var isChromeTested by remember { mutableStateOf(false) }
    var isEdgeTested by remember { mutableStateOf(false) }
    var testingBrowser by remember { mutableStateOf<BrowserType?>(null) }
    
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    
    // Tab selection: Show ACTIVE_BROWSER if config exists, otherwise first available browser
    var selectedTab by remember(currentConfig) { 
        mutableStateOf(
            if (currentConfig != null) {
                BrowserTab.ACTIVE_BROWSER
            } else {
                // No config - default to first available browser tab
                when (defaultBrowser) {
                    BrowserType.CHROME -> BrowserTab.CHROME
                    BrowserType.SAFARI -> BrowserTab.SAFARI
                    BrowserType.EDGE -> BrowserTab.EDGE
                    else -> BrowserTab.SAFARI
                }
            }
        ) 
    }

    Box(modifier = Modifier.fillMaxSize()) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header with Dismiss button
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp
            ) {
                Column {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = 24.dp, end = 16.dp, top = 20.dp, bottom = 16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Browser Configuration",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold
                        )
                        IconButton(
                            onClick = onDismiss,
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Close",
                                tint = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                    
                    // Tabs
                    TabRow(
                        selectedTabIndex = selectedTab.ordinal,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Tab(
                            selected = selectedTab == BrowserTab.ACTIVE_BROWSER,
                            onClick = { selectedTab = BrowserTab.ACTIVE_BROWSER },
                            text = {
                                Text(
                                    "Active Browser",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = if (selectedTab == BrowserTab.ACTIVE_BROWSER) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        )
                        Tab(
                            selected = selectedTab == BrowserTab.CHROME,
                            onClick = { 
                                selectedBrowser = BrowserType.CHROME
                                selectedTab = BrowserTab.CHROME 
                            },
                            text = {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "Chrome",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = if (selectedTab == BrowserTab.CHROME) FontWeight.Bold else FontWeight.Normal
                                    )
                                    Text(
                                        "✓",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.primary
                                    )
                                }
                            }
                        )
                        Tab(
                            selected = selectedTab == BrowserTab.SAFARI,
                            onClick = { 
                                selectedBrowser = BrowserType.SAFARI
                                selectedTab = BrowserTab.SAFARI 
                            },
                            text = {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "Safari",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = if (selectedTab == BrowserTab.SAFARI) FontWeight.Bold else FontWeight.Normal
                                    )
                                    Text(
                                        "⚠",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        )
                        Tab(
                            selected = selectedTab == BrowserTab.EDGE,
                            onClick = { 
                                selectedBrowser = BrowserType.EDGE
                                selectedTab = BrowserTab.EDGE 
                            },
                            text = {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        "Edge",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = if (selectedTab == BrowserTab.EDGE) FontWeight.Bold else FontWeight.Normal
                                    )
                                    Text(
                                        "⚠",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
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
                        shape = MaterialTheme.shapes.medium
                    )
                }
            )
            
            // Content
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Browser-specific content
                when (selectedTab) {
                    BrowserTab.ACTIVE_BROWSER -> ActiveBrowserTabContent(
                        currentConfig = currentConfig,
                        availableBrowsers = availableBrowsers,
                        onConfigureClick = { browserType ->
                            selectedBrowser = browserType
                            selectedTab = when (browserType) {
                                BrowserType.CHROME -> BrowserTab.CHROME
                                BrowserType.SAFARI -> BrowserTab.SAFARI
                                BrowserType.EDGE -> BrowserTab.EDGE
                                else -> BrowserTab.CHROME
                            }
                        }
                    )
                    
                    BrowserTab.CHROME -> ChromeBrowserContent(
                        isInstalled = availableBrowsers.containsKey(BrowserType.CHROME),
                        isTested = isChromeTested,
                        isTesting = testingBrowser == BrowserType.CHROME,
                        onTest = {
                            scope.launch {
                                testingBrowser = BrowserType.CHROME
                                val success = testBrowser(BrowserType.CHROME, snackbarHostState)
                                if (success) {
                                    isChromeTested = true
                                }
                                testingBrowser = null
                            }
                        }
                    )
                    
                    BrowserTab.SAFARI -> SafariBrowserContent(
                        isInstalled = availableBrowsers.containsKey(BrowserType.SAFARI),
                        isTested = isSafariTested,
                        isTesting = testingBrowser == BrowserType.SAFARI,
                        onTest = {
                            scope.launch {
                                testingBrowser = BrowserType.SAFARI
                                val success = testBrowser(BrowserType.SAFARI, snackbarHostState)
                                if (success) {
                                    isSafariTested = true
                                }
                                testingBrowser = null
                            }
                        }
                    )
                    
                    BrowserTab.EDGE -> EdgeBrowserContent(
                        isInstalled = availableBrowsers.containsKey(BrowserType.EDGE),
                        isTested = isEdgeTested,
                        isTesting = testingBrowser == BrowserType.EDGE,
                        onTest = {
                            scope.launch {
                                testingBrowser = BrowserType.EDGE
                                val success = testBrowser(BrowserType.EDGE, snackbarHostState)
                                if (success) {
                                    isEdgeTested = true
                                }
                                testingBrowser = null
                            }
                        }
                    )
                }
            }
            
            // Save Button (only show for config tabs, not for active browser view)
            if (selectedTab != BrowserTab.ACTIVE_BROWSER) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp)
                ) {
                    Button(
                        onClick = {
                            scope.launch {
                                // Check if selected browser is tested
                                val isSelectedTested = when (selectedBrowser) {
                                    BrowserType.SAFARI -> isSafariTested
                                    BrowserType.CHROME -> isChromeTested
                                    BrowserType.EDGE -> isEdgeTested
                                    else -> false
                                }
                                
                                if (!isSelectedTested) {
                                    snackbarHostState.showSnackbar(
                                        message = "⚠️ Please test ${selectedBrowser.displayName} first",
                                        duration = SnackbarDuration.Long,
                                        withDismissAction = true
                                    )
                                    return@launch
                                }
                                
                                try {
                                    val config = BrowserConfig(
                                        browserType = selectedBrowser,
                                        autoDetect = false  // Always manual selection
                                    )
                                    repository.saveConfig(config)
                                    currentConfig = config
                                    
                                    snackbarHostState.showSnackbar(
                                        message = "✓ Browser settings saved successfully!",
                                        duration = SnackbarDuration.Short,
                                        withDismissAction = true
                                    )
                                    
                                    // Switch to Active Browser tab after saving
                                    selectedTab = BrowserTab.ACTIVE_BROWSER
                                } catch (e: Exception) {
                                    logger.error(e) { "Failed to save browser configuration" }
                                    snackbarHostState.showSnackbar(
                                        message = "✗ Failed to save: ${e.message}",
                                        duration = SnackbarDuration.Long,
                                        withDismissAction = true
                                    )
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = testingBrowser == null
                    ) {
                        Text("Save Settings")
                    }
                }
            }
        }
    }
}

@Composable
fun ActiveBrowserTabContent(
    currentConfig: BrowserConfig?,
    availableBrowsers: Map<BrowserType, String?>,
    onConfigureClick: (BrowserType) -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        if (currentConfig != null && currentConfig.browserType in availableBrowsers.keys) {
            // Show current active browser
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "✓ Active Browser Configuration",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    
                    HorizontalDivider()
                    
                    Text(
                        text = "Browser: ${currentConfig.browserType.displayName} • Status: ✓ Ready",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Experimental Browser Warning (if Safari or Edge is configured)
            if (currentConfig.browserType == BrowserType.SAFARI || currentConfig.browserType == BrowserType.EDGE) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                    Text(
                        text = "⚠️ ${currentConfig.browserType.displayName} (Experimental)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = "${currentConfig.browserType.displayName} has not been fully tested. Screenshots may fail or appear blank. For best results, please switch to Chrome.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                    }
                }
            }
            
            // Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "ℹ️ Browser Information",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Your ${currentConfig.browserType.displayName} is configured and ready for automation. " +
                              "To change browsers, select a different tab and configure it.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
        } else {
            // No browser configured - show setup prompt
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.tertiaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "⚙️ No Browser Configured",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    
                    Text(
                        text = "Please configure a browser to enable automation features. Select a browser tab above to get started.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    
                    HorizontalDivider()
                    
                    Text(
                        text = "Available Browsers:",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    
                    // Show available browsers as buttons
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (availableBrowsers.containsKey(BrowserType.SAFARI)) {
                            FilledTonalButton(
                                onClick = { onConfigureClick(BrowserType.SAFARI) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Configure Safari")
                            }
                        }
                        if (availableBrowsers.containsKey(BrowserType.CHROME)) {
                            FilledTonalButton(
                                onClick = { onConfigureClick(BrowserType.CHROME) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Configure Chrome")
                            }
                        }
                        if (availableBrowsers.containsKey(BrowserType.EDGE)) {
                            FilledTonalButton(
                                onClick = { onConfigureClick(BrowserType.EDGE) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Configure Edge")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SafariBrowserContent(
    isInstalled: Boolean,
    isTested: Boolean,
    isTesting: Boolean,
    onTest: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // EXPERIMENTAL WARNING
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⚠️ Safari (Experimental)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f)
                    )
                    
                    Button(
                        onClick = onTest,
                        enabled = isInstalled && !isTesting,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        when {
                            isTesting -> Text("Testing...")
                            isTested -> Text("✓ Tested")
                            else -> Text("Test")
                        }
                    }
                }
                
                Text(
                    text = "Safari WebDriver has known limitations with WebGL canvas screenshots. Screenshots may fail or appear blank when using Safari. This is a Safari WebDriver limitation, not a bug in this app. For best results, use Chrome.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
        
        // Setup Instructions
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "🔧 Safari Setup Instructions",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                
                HorizontalDivider()
                
                SetupStep(
                    number = "1",
                    title = "Enable Develop Menu",
                    description = "Safari > Settings (⌘,) > Advanced > Check \"Show Develop menu in menu bar\""
                )
                
                SetupStep(
                    number = "2",
                    title = "Allow Remote Automation",
                    description = "Menu Bar > Develop > Check \"Allow Remote Automation\""
                )
                
                SetupStep(
                    number = "3",
                    title = "Done!",
                    description = "Safari is now ready for automation"
                )
            }
        }
    }
}

@Composable
fun ChromeBrowserContent(
    isInstalled: Boolean,
    isTested: Boolean,
    isTesting: Boolean,
    onTest: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (!isInstalled) {
            // Chrome Not Installed - Simple info card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "ℹ️ Chrome Not Found",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = "Please install Google Chrome from: https://www.google.com/chrome/",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        } else {
            // Chrome is Installed - Show success card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "✨ No Setup Required",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        
                        Button(
                            onClick = onTest,
                            enabled = isInstalled && !isTesting,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = MaterialTheme.colorScheme.primary
                            )
                        ) {
                            when {
                                isTesting -> Text("Testing...")
                                isTested -> Text("✓ Tested")
                                else -> Text("Test")
                            }
                        }
                    }
                    
                    Text(
                        text = "Chrome works out of the box! Just test it to verify the connection.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            
            // Chrome Installed Info Card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "✓ Chrome Installed",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = "Google Chrome is installed and ready for browser automation. Chrome is the recommended browser for KleverDesktop as it provides the most reliable screenshot capture and automation features.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        }
    }
}

@Composable
fun EdgeBrowserContent(
    isInstalled: Boolean,
    isTested: Boolean,
    isTesting: Boolean,
    onTest: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // EXPERIMENTAL WARNING
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.errorContainer
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "⚠️ Edge (Experimental)",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.weight(1f)
                    )
                    
                    Button(
                        onClick = onTest,
                        enabled = isInstalled && !isTesting,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.error
                        )
                    ) {
                        when {
                            isTesting -> Text("Testing...")
                            isTested -> Text("✓ Tested")
                            else -> Text("Test")
                        }
                    }
                }
                
                Text(
                    text = "Edge driver will be downloaded automatically on first use. Screenshots may fail or appear blank when using Edge. For best results, use Chrome.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        }
        
        // Setup Instructions
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant
            )
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "✨ Automatic Setup",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Edge driver will be downloaded automatically when you test. Just click the button above!",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        if (!isInstalled) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "ℹ️ Edge Not Found",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                    Text(
                        text = "Please install Microsoft Edge from: https://www.microsoft.com/edge",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }
        }
    }
}

@Composable
fun SetupStep(number: String, title: String, description: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Surface(
            color = MaterialTheme.colorScheme.primary,
            shape = MaterialTheme.shapes.small,
            modifier = Modifier.size(32.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = number,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

