package com.klever.desktop

import androidx.compose.runtime.*
import androidx.compose.ui.window.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.klever.desktop.server.KleverServer
import com.klever.desktop.server.config.AppConfig
import com.klever.desktop.ui.MainWindow
import com.klever.desktop.ui.ModelSettingsDialog
import mu.KotlinLogging
import androidx.compose.ui.window.rememberWindowState
import androidx.compose.ui.window.Tray
import androidx.compose.ui.window.TrayState
import androidx.compose.ui.window.MenuBar
import androidx.compose.ui.window.FrameWindowScope
import androidx.compose.ui.res.painterResource
import java.awt.Dimension
import androidx.compose.ui.window.DialogWindow
import androidx.compose.ui.window.rememberDialogState
import java.awt.Desktop
import java.net.URI
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import java.io.File

private val logger = KotlinLogging.logger {}

// Environment check data class
data class EnvironmentCheckResult(
    val isJavaOk: Boolean,
    val isChromeOk: Boolean,
    val javaVersion: String? = null,
    val javaVendor: String? = null,
    val chromeLocation: String? = null,
    val errorMessage: String? = null
)

// Check required environment (Java and Chrome)
fun checkEnvironment(): EnvironmentCheckResult {
    try {
        // Check Java environment
        val javaVersion = System.getProperty("java.version")
        val javaVendor = System.getProperty("java.vendor")
        
        logger.info { "Java Version: $javaVersion" }
        logger.info { "Java Vendor: $javaVendor" }
        
        // Check Java version (minimum Java 17 required)
        val versionParts = javaVersion.split(".")
        val majorVersion = when {
            javaVersion.startsWith("1.") -> versionParts[1].toInt() // 1.8 format
            else -> versionParts[0].toInt() // 9, 10, 11... format
        }
        
        val isJavaOk = majorVersion >= 17
        
        // Check Chrome browser installation
        val isChromeOk: Boolean
        val chromeLocation: String?
        
        when {
            System.getProperty("os.name").toLowerCase().contains("win") -> {
                // Windows Chrome locations
                val possibleLocations = listOf(
                    File("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"),
                    File("C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"),
                    File(System.getProperty("user.home") + "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe")
                )
                
                val chromeFile = possibleLocations.find { it.exists() }
                isChromeOk = chromeFile != null
                chromeLocation = chromeFile?.absolutePath
            }
            System.getProperty("os.name").toLowerCase().contains("mac") -> {
                // macOS Chrome location
                val chromeFile = File("/Applications/Google Chrome.app")
                isChromeOk = chromeFile.exists()
                chromeLocation = if (isChromeOk) chromeFile.absolutePath else null
            }
            else -> {
                // Linux Chrome locations
                val possibleLocations = listOf(
                    File("/usr/bin/google-chrome"),
                    File("/usr/bin/google-chrome-stable"),
                    File("/usr/bin/chromium-browser"),
                    File("/usr/bin/chromium")
                )
                
                val chromeFile = possibleLocations.find { it.exists() }
                isChromeOk = chromeFile != null
                chromeLocation = chromeFile?.absolutePath
            }
        }
        
        logger.info { "Chrome browser check: ${if (isChromeOk) "Found at $chromeLocation" else "Not found"}" }
        
        return EnvironmentCheckResult(
            isJavaOk = isJavaOk,
            isChromeOk = isChromeOk,
            javaVersion = javaVersion,
            javaVendor = javaVendor,
            chromeLocation = chromeLocation
        )
    } catch (e: Exception) {
        logger.error(e) { "Error checking environment: ${e.message}" }
        return EnvironmentCheckResult(
            isJavaOk = false,
            isChromeOk = false,
            errorMessage = e.message
        )
    }
}

class App {
    private var server: KleverServer? = null
    val config = AppConfig()

    fun startServer() {
        try {
            server = KleverServer(config.port)
            server?.start()
            logger.info { "KleverDesktop server started on port ${config.port}" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to start server: ${e.message}" }
            throw e
        }
    }

    fun stopServer() {
        try {
            server?.stop()
            server = null
            logger.info { "KleverDesktop server stopped" }
        } catch (e: Exception) {
            logger.error(e) { "Error stopping server: ${e.message}" }
        }
    }

    fun isServerRunning(): Boolean = server != null && server!!.connections.isNotEmpty()
}

fun main() = application {
    val app = remember { App() }
    var isServerRunning by remember { mutableStateOf(false) }
    var isVisible by remember { mutableStateOf(false) }
    var showModelSettings by remember { mutableStateOf(false) }
    var showEnvironmentWarning by remember { mutableStateOf(false) }
    var environmentCheckResult by remember { mutableStateOf<EnvironmentCheckResult?>(null) }
    val trayState = remember { TrayState() }

    // Check environment (Java and Chrome)
    LaunchedEffect(Unit) {
        val checkResult = checkEnvironment()
        if (!checkResult.isJavaOk || !checkResult.isChromeOk) {
            logger.error { "Environment check failed: Java OK: ${checkResult.isJavaOk}, Chrome OK: ${checkResult.isChromeOk}" }
            environmentCheckResult = checkResult
            showEnvironmentWarning = true
            return@LaunchedEffect
        }
        
        // Continue with existing code
        if (!app.config.isModelConfigured()) {
            showModelSettings = true
            logger.info { "No model configuration found, showing settings dialog" }
            return@LaunchedEffect
        }
        
        try {
            app.startServer()
            isServerRunning = true
            logger.info { "Auto-started server on application launch" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to auto-start server" }
        }
    }

    // Environment warning dialog
    if (showEnvironmentWarning && environmentCheckResult != null) {
        val result = environmentCheckResult!!
        
        DialogWindow(
            onCloseRequest = { 
                showEnvironmentWarning = false
                exitApplication()
            },
            title = "Environment Check Failed",
            state = rememberDialogState(
                width = 550.dp,
                height = 400.dp
            ),
            resizable = false
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Environment Check Failed",
                        style = MaterialTheme.typography.headlineMedium
                    )
                    
                    if (!result.isJavaOk) {
                        Text(
                            text = "Java Environment Error:",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "KleverDesktop requires Java 17 or later to run.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        if (result.javaVersion != null) {
                            Text(
                                text = "Detected Java version: ${result.javaVersion} (${result.javaVendor})",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                        
                        Button(
                            onClick = {
                                try {
                                    Desktop.getDesktop().browse(URI("https://adoptium.net/temurin/releases/?version=17"))
                                } catch (e: Exception) {
                                    logger.error(e) { "Failed to open browser: ${e.message}" }
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Download Java 17")
                        }
                    }
                    
                    if (!result.isChromeOk) {
                        Text(
                            text = "Chrome Browser Error:",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            text = "KleverDesktop requires Google Chrome to be installed.",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        
                        Button(
                            onClick = {
                                try {
                                    Desktop.getDesktop().browse(URI("https://www.google.com/chrome/"))
                                } catch (e: Exception) {
                                    logger.error(e) { "Failed to open browser: ${e.message}" }
                                }
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Download Google Chrome")
                        }
                    }
                    
                    Button(
                        onClick = { 
                            showEnvironmentWarning = false
                            exitApplication()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Exit")
                    }
                }
            }
        }
    }

    Tray(
        state = trayState,
        icon = painterResource("icon.png"),
        menu = {
            // Show Window menu item temporarily disabled
            // Item(
            //     text = "Show Window",
            //     onClick = { isVisible = true }
            // )
            Item(
                text = if (isServerRunning) "Stop Server" else "Start Server",
                onClick = {
                    if (isServerRunning) {
                        app.stopServer()
                        isServerRunning = false
                    } else {
                        app.startServer()
                        isServerRunning = true
                    }
                }
            )
            Item(
                text = "Model Settings",
                onClick = { showModelSettings = true }
            )
            Separator()
            Item(
                text = "Exit",
                onClick = {
                    app.stopServer()
                    exitApplication()
                }
            )
        }
    )

    if (isVisible) {
        Window(
            onCloseRequest = { isVisible = false },
            title = "Klever Desktop",
            state = rememberWindowState(width = 800.dp, height = 800.dp),
            visible = isVisible
        ) {
            MainWindow(
                isServerRunning = isServerRunning,
                onStartServer = {
                    app.startServer()
                    isServerRunning = true
                },
                onStopServer = {
                    app.stopServer()
                    isServerRunning = false
                },
                onMinimizeToTray = {
                    isVisible = false
                }
            )
        }
    }

    if (showModelSettings) {
        DialogWindow(
            onCloseRequest = { showModelSettings = false },
            title = "Model Settings",
            state = rememberDialogState(
                width = 600.dp,
                height = 600.dp
            ),
            resizable = false
        ) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                ModelSettingsDialog(
                    onClose = { showModelSettings = false }
                )
            }
        }
    }
}
