package com.klever.desktop

import com.klever.desktop.model.ExplorationData
import com.klever.desktop.ui.MainView
import com.klever.desktop.ui.SettingsView
import com.klever.desktop.ui.URLInputView
import com.klever.desktop.ui.TaskInputView
import com.klever.desktop.browser.SeleniumController
import javafx.application.Application
import javafx.scene.Scene
import javafx.stage.Modality
import javafx.stage.Stage
import javafx.scene.control.Alert

class KleverDesktopApp : Application() {
    private lateinit var mainStage: Stage
    private val explorationData = ExplorationData()
    private val seleniumController = SeleniumController()
    
    override fun start(stage: Stage) {
        mainStage = stage
        
        // Load CSS
        val css = javaClass.getResource("/styles.css")?.toExternalForm()
        
        showMainView()
        css?.let { mainStage.scene.stylesheets.add(it) }
        
        mainStage.title = "Klever Desktop"
        mainStage.show()
    }
    
    private fun showMainView() {
        val mainView = MainView(
            onStartExploration = { showUrlInputView() },
            onOpenSettings = { showSettingsDialog() }
        )
        mainStage.scene = Scene(mainView, 600.0, 400.0)
    }
    
    private fun showSettingsDialog() {
        val settingsStage = Stage()
        settingsStage.initModality(Modality.APPLICATION_MODAL)
        settingsStage.initOwner(mainStage)
        
        val settingsView = SettingsView()
        settingsStage.scene = Scene(settingsView, 500.0, 400.0)
        settingsStage.title = "Settings"
        
        settingsStage.showAndWait()
    }
    
    private fun showUrlInputView() {
        val urlInputView = URLInputView(
            explorationData = explorationData,
            onBack = { showMainView() },
            onNext = { showTaskInputView() }
        )
        mainStage.scene = Scene(urlInputView, 600.0, 400.0)
    }
    
    private fun showTaskInputView() {
        val taskInputView = TaskInputView(
            explorationData = explorationData,
            onBack = { showUrlInputView() },
            onStart = { startExploration() }
        )
        mainStage.scene = Scene(taskInputView, 600.0, 400.0)
    }
    
    private fun startExploration() {
        try {
            seleniumController.initialize()
            seleniumController.openFigmaPrototype(
                url = explorationData.url,
                password = explorationData.password
            )
            // TODO: Implement exploration logic
        } catch (e: Exception) {
            Alert(Alert.AlertType.ERROR).apply {
                title = "Exploration Error"
                contentText = "Failed to start exploration: ${e.message}"
                showAndWait()
            }
        }
    }
    
    override fun stop() {
        seleniumController.close()
        super.stop()
    }
}

fun main() {
    Application.launch(KleverDesktopApp::class.java)
}