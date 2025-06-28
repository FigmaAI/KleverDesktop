package com.klever.desktop

import androidx.compose.runtime.*
import androidx.compose.ui.window.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.klever.desktop.server.KleverServer
import com.klever.desktop.server.TalkToFigmaServer
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
            System.getProperty("os.name").lowercase().contains("win") -> {
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
            System.getProperty("os.name").lowercase().contains("mac") -> {
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
    private var talkToFigmaServer: TalkToFigmaServer? = null
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
            server?.stop(1000)
            server = null
            logger.info { "KleverDesktop server stopped" }
        } catch (e: Exception) {
            logger.error(e) { "Error stopping server: ${e.message}" }
        }
    }

    fun isServerRunning(): Boolean = server != null

    fun startTalkToFigmaServer() {
        try {
            if (talkToFigmaServer != null) {
                logger.warn { "TalkToFigma server is already running." }
                return
            }
            talkToFigmaServer = TalkToFigmaServer(3055)
            talkToFigmaServer?.start()
            logger.info { "TalkToFigma server starting on port 3055" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to start TalkToFigma server: ${e.message}" }
            talkToFigmaServer = null
            throw e
        }
    }

    fun stopTalkToFigmaServer() {
        try {
            talkToFigmaServer?.stop(1000)
            talkToFigmaServer = null
            logger.info { "TalkToFigma server stopped" }
        } catch (e: Exception) {
            logger.error(e) { "Error stopping TalkToFigma server: ${e.message}" }
        }
    }

    fun isTalkToFigmaServerRunning(): Boolean = talkToFigmaServer != null
}

fun main() = application {
    val app = remember { App() }
    var isServerRunning by remember { mutableStateOf(false) }
    var isTalkToFigmaServerRunning by remember { mutableStateOf(false) }
    var isVisible by remember { mutableStateOf(false) }
    var showModelSettings by remember { mutableStateOf(false) }
    var showEnvironmentWarning by remember { mutableStateOf(false) }
    var environmentCheckResult by remember { mutableStateOf<EnvironmentCheckResult?>(null) }
    val trayState = remember { TrayState() }

    // Add a JVM shutdown hook to ensure servers are stopped gracefully.
    DisposableEffect(Unit) {
        val shutdownHook = Thread {
            logger.info { "JVM Shutdown Hook: Stopping servers..." }
            app.stopServer()
            app.stopTalkToFigmaServer()
            logger.info { "JVM Shutdown Hook: Servers stopped." }
        }
        Runtime.getRuntime().addShutdownHook(shutdownHook)
        onDispose {
            try {
                // Attempt to remove the hook when the composition is disposed
                Runtime.getRuntime().removeShutdownHook(shutdownHook)
            } catch (e: IllegalStateException) {
                // This can happen if the JVM is already shutting down. It's safe to ignore.
                logger.warn { "Could not remove shutdown hook, maybe shutdown is in progress." }
            }
        }
    }

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
        icon = painterResource("icon.png"),
        state = trayState,
        tooltip = "Klever Desktop",
        onAction = { isVisible = !isVisible },
        menu = {
            if (isServerRunning) {
                Item("Stop Klever Server", onClick = {
                    app.stopServer()
                    isServerRunning = false
                })
            } else {
                Item("Start Klever Server", onClick = {
                    try {
                        if (!app.config.isModelConfigured()) {
                            showModelSettings = true
                            isVisible = true
                            return@Item
                        }
                        app.startServer()
                        isServerRunning = true
                    } catch (e: Exception) {
                        logger.error(e) { "Failed to start server from tray" }
                    }
                })
            }

            if (isTalkToFigmaServerRunning) {
                Item("Stop TalkToFigma Server", onClick = {
                    app.stopTalkToFigmaServer()
                    isTalkToFigmaServerRunning = false
                })
            } else {
                Item("Start TalkToFigma Server", onClick = {
                    try {
                        app.startTalkToFigmaServer()
                        isTalkToFigmaServerRunning = true
                    } catch (e: Exception) {
                        logger.error(e) { "Failed to start TalkToFigma server from tray" }
                    }
                })
            }

            Item("Model Settings", onClick = {
                showModelSettings = true
            })

            Separator()
            Item("Exit", onClick = {
                exitApplication()
            })
        }
    )

    if (isVisible) {
        Window(
            onCloseRequest = { exitApplication() },
            state = rememberWindowState(width = 1000.dp, height = 700.dp),
            title = "Klever Desktop",
            icon = painterResource("icon.png"),
            visible = isVisible,
        ) {
            MenuBar {
                Menu("File", mnemonic = 'F') {
                    Item(
                        "Show/Hide Window",
                        onClick = { isVisible = !isVisible }
                    )
                    Separator()
                    Item("Exit", onClick = { exitApplication() })
                }
            }

            MainWindow(
                isServerRunning = isServerRunning,
                onStartServer = {
                    try {
                        app.startServer()
                        isServerRunning = true
                    } catch (e: Exception) {
                        logger.error(e) { "Failed to start server from UI" }
                    }
                },
                onStopServer = {
                    app.stopServer()
                    isServerRunning = false
                },
                onMinimizeToTray = {
                    isVisible = false
                },
                isTalkToFigmaServerRunning = isTalkToFigmaServerRunning,
                onStartTalkToFigmaServer = {
                    try {
                        app.startTalkToFigmaServer()
                        isTalkToFigmaServerRunning = true
                    } catch (e: Exception) {
                        logger.error(e) { "Failed to start TalkToFigma server from UI" }
                    }
                },
                onStopTalkToFigmaServer = {
                    app.stopTalkToFigmaServer()
                    isTalkToFigmaServerRunning = false
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
