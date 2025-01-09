package com.klever.desktop

import androidx.compose.runtime.*
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import com.klever.desktop.server.KleverServer
import com.klever.desktop.config.AppConfig
import com.klever.desktop.ui.MainWindow
import mu.KotlinLogging
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.rememberWindowState
import androidx.compose.ui.window.Tray
import androidx.compose.ui.window.TrayState
import androidx.compose.ui.window.MenuBar
import androidx.compose.ui.window.FrameWindowScope
import androidx.compose.ui.res.painterResource
import java.awt.Dimension

private val logger = KotlinLogging.logger {}

class App {
    private var server: KleverServer? = null
    private val config = AppConfig()

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
    val trayState = remember { TrayState() }

    LaunchedEffect(Unit) {
        try {
            app.startServer()
            isServerRunning = true
            logger.info { "Auto-started server on application launch" }
        } catch (e: Exception) {
            logger.error(e) { "Failed to auto-start server" }
        }
    }

    Tray(
        state = trayState,
        icon = painterResource("icon.png"),
        menu = {
            Item(
                text = "Show Window",
                onClick = { isVisible = true }
            )
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
            onCloseRequest = {
                isVisible = false
            },
            title = "Klever Desktop",
            state = rememberWindowState(
                width = 800.dp,
                height = 600.dp
            ),
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
}
