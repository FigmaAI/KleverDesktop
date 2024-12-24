package com.klever.desktop.ui

import javafx.geometry.Insets
import javafx.geometry.Pos
import javafx.scene.control.Button
import javafx.scene.layout.VBox
import javafx.scene.text.Text

class MainView(
    private val onStartExploration: () -> Unit,
    private val onOpenSettings: () -> Unit
) : VBox(20.0) {
    
    init {
        alignment = Pos.CENTER
        padding = Insets(20.0)
        
        children.addAll(
            Text("Klever Desktop").apply {
                style = "-fx-font-size: 24px; -fx-font-weight: bold;"
            },
            Button("Start Exploration").apply {
                styleClass.add("primary-button")
                setOnAction { onStartExploration() }
            },
            Button("Settings").apply {
                styleClass.add("secondary-button")
                setOnAction { onOpenSettings() }
            }
        )
    }
} 