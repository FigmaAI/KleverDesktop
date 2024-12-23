 package com.klever.desktop

import javafx.application.Application
import javafx.scene.Scene
import javafx.scene.control.Label
import javafx.scene.layout.StackPane
import javafx.stage.Stage

class KleverDesktopApp : Application() {
    override fun start(stage: Stage) {
        val label = Label("Klever Desktop")
        val scene = Scene(StackPane(label), 800.0, 600.0)
        stage.title = "Klever Desktop"
        stage.scene = scene
        stage.show()
    }
}

fun main() {
    Application.launch(KleverDesktopApp::class.java)
}