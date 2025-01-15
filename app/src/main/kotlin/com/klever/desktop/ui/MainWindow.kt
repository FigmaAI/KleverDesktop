package com.klever.desktop.ui

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.ui.window.FrameWindowScope
import com.klever.desktop.ui.ModelSettings
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import java.util.Locale

// List of supported languages
private val supportedLocales = listOf(
    Locale.ENGLISH,
    Locale.KOREAN,
    Locale.JAPANESE,
    Locale.CHINESE,
    Locale.FRENCH,
    Locale.GERMAN,
    Locale("ms"),  // Malay
    Locale("th"),  // Thai
    Locale("id"),  // Indonesian
    Locale("es")   // Spanish
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainWindow(
    isServerRunning: Boolean,
    onStartServer: () -> Unit,
    onStopServer: () -> Unit,
    onMinimizeToTray: () -> Unit
) {
    var selectedCategory by remember { mutableStateOf("WebSocket") }

    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background
        ) {
            PermanentNavigationDrawer(
                drawerContent = {
                    PermanentDrawerSheet(
                        Modifier.width(240.dp),
                        drawerContainerColor = MaterialTheme.colorScheme.surface,
                    ) {
                        Column(
                            modifier = Modifier
                                .padding(end = 16.dp)
                                .padding(vertical = 48.dp)
                        ) {
                            NavigationDrawerItem(
                                modifier = Modifier.height(40.dp),
                                icon = { Icon(Icons.Default.Settings, "WebSocket") },
                                label = { Text("WebSocket") },
                                selected = selectedCategory == "WebSocket",
                                onClick = { selectedCategory = "WebSocket" },
                                shape = RoundedCornerShape(
                                    topStart = 0.dp,
                                    bottomStart = 0.dp,
                                    topEnd = 24.dp,
                                    bottomEnd = 24.dp
                                )
                            )
                            Spacer(Modifier.height(16.dp))
                            NavigationDrawerItem(
                                modifier = Modifier.height(40.dp),
                                icon = { Icon(Icons.Default.Build, "Model") },
                                label = { Text("Model") },
                                selected = selectedCategory == "Model",
                                onClick = { selectedCategory = "Model" },
                                shape = RoundedCornerShape(
                                    topStart = 0.dp,
                                    bottomStart = 0.dp,
                                    topEnd = 24.dp,
                                    bottomEnd = 24.dp
                                )
                            )
                            Spacer(Modifier.height(16.dp))
                            NavigationDrawerItem(
                                modifier = Modifier.height(40.dp),
                                icon = { Icon(Icons.Default.Edit, "Prompts") },
                                label = { Text("Prompts") },
                                selected = selectedCategory == "Prompts",
                                onClick = { selectedCategory = "Prompts" },
                                shape = RoundedCornerShape(
                                    topStart = 0.dp,
                                    bottomStart = 0.dp,
                                    topEnd = 24.dp,
                                    bottomEnd = 24.dp
                                )
                            )
                        }
                    }
                }
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    TopAppBar(
                        title = {
                            Text(
                                when (selectedCategory) {
                                    "WebSocket" -> "WebSocket Settings"
                                    "Model" -> "Model Settings"
                                    else -> "Prompts Settings"
                                }
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = MaterialTheme.colorScheme.primary,
                            titleContentColor = MaterialTheme.colorScheme.onPrimary
                        )
                    )

                    Surface(
                        modifier = Modifier.fillMaxSize(),
                        color = MaterialTheme.colorScheme.surface,
                        tonalElevation = 1.dp
                    ) {
                        Box(
                            Modifier
                                .fillMaxSize()
                                .padding(24.dp)
                        ) {
                            when (selectedCategory) {
                                "WebSocket" -> WebSocketSettingsContent(
                                    isServerRunning = isServerRunning,
                                    onStartServer = onStartServer,
                                    onStopServer = onStopServer,
                                    onMinimizeToTray = onMinimizeToTray
                                )
                                "Model" -> ModelSettings()
                                "Prompts" -> Text("Prompts settings coming soon...")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun WebSocketSettingsContent(
    isServerRunning: Boolean,
    onStartServer: () -> Unit,
    onStopServer: () -> Unit,
    onMinimizeToTray: () -> Unit
) {
    var maxRounds by remember { mutableStateOf(30) }
    var maxRoundsText by remember { mutableStateOf("30") }
    var selectedLocale by remember { mutableStateOf(Locale.ENGLISH) }
    var isLanguageDropdownExpanded by remember { mutableStateOf(false) }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = if (isServerRunning) "Server Status: Running" else "Server Status: Stopped",
            style = MaterialTheme.typography.titleMedium
        )
        
        // Language Dropdown
        Box {
            OutlinedButton(
                onClick = { isLanguageDropdownExpanded = true },
                modifier = Modifier.width(200.dp)
            ) {
                Text(selectedLocale.displayLanguage)
                Icon(
                    Icons.Default.KeyboardArrowDown,
                    contentDescription = "Select Language",
                    modifier = Modifier.padding(start = 8.dp)
                )
            }
            
            DropdownMenu(
                expanded = isLanguageDropdownExpanded,
                onDismissRequest = { isLanguageDropdownExpanded = false }
            ) {
                supportedLocales.forEach { locale ->
                    DropdownMenuItem(
                        text = { Text(locale.displayLanguage) },
                        onClick = {
                            selectedLocale = locale
                            isLanguageDropdownExpanded = false
                        }
                    )
                }
            }
        }
        
        OutlinedTextField(
            value = maxRoundsText,
            onValueChange = { text ->
                if (text.isEmpty() || text.all { it.isDigit() }) {
                    maxRoundsText = text
                    text.toIntOrNull()?.let { value ->
                        if (value in 10..50) {
                            maxRounds = value
                        }
                    }
                }
            },
            label = { Text("Max Rounds (10-50)") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(200.dp)
        )
        
        Button(
            onClick = if (isServerRunning) onStopServer else { 
                { 
                    onStartServer() 
                }
            },
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isServerRunning) MaterialTheme.colorScheme.error 
                               else MaterialTheme.colorScheme.primary
            )
        ) {
            Text(if (isServerRunning) "Stop Server" else "Start Server")
        }

        OutlinedButton(
            onClick = onMinimizeToTray,
            modifier = Modifier.padding(top = 8.dp)
        ) {
            Icon(
                Icons.Default.KeyboardArrowDown,
                contentDescription = "Minimize to Tray",
                modifier = Modifier.padding(end = 8.dp)
            )
            Text("Minimize to Tray")
        }
    }
}
