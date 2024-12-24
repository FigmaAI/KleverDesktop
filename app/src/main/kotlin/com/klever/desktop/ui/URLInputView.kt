package com.klever.desktop.ui

import com.klever.desktop.model.ExplorationData
import javafx.geometry.Insets
import javafx.scene.control.*
import javafx.scene.layout.Priority
import javafx.scene.layout.VBox

class URLInputView(
    private val explorationData: ExplorationData,
    private val onBack: () -> Unit,
    private val onNext: () -> Unit
) : VBox(20.0) {
    
    private val appNameField = TextField(explorationData.appName).apply {
        promptText = "Enter app name"
        styleClass.add("input-field")
    }
    
    private val urlField = TextField(explorationData.url).apply {
        promptText = "Enter Figma prototype URL"
        styleClass.add("input-field")
    }
    
    private val passwordField = PasswordField().apply {
        text = explorationData.password ?: ""
        promptText = "Enter password (optional)"
        styleClass.add("input-field")
    }
    
    init {
        padding = Insets(20.0)
        
        children.addAll(
            Label("URL Input (Step 1/2)").apply { 
                styleClass.add("title-text")
            },
            VBox(5.0).apply {
                children.addAll(
                    Label("App Name:"),
                    appNameField
                )
            },
            VBox(5.0).apply {
                children.addAll(
                    Label("Figma URL:"),
                    urlField
                )
            },
            VBox(5.0).apply {
                children.addAll(
                    Label("Password (Optional):"),
                    passwordField
                )
            },
            ButtonBar().apply {
                buttons.addAll(
                    Button("Back").apply {
                        styleClass.add("secondary-button")
                        setOnAction { onBack() }
                    },
                    Button("Next").apply {
                        styleClass.add("primary-button")
                        setOnAction {
                            if (saveAndValidate()) {
                                onNext()
                            }
                        }
                    }
                )
            }
        )
    }
    
    private fun saveAndValidate(): Boolean {
        explorationData.apply {
            appName = appNameField.text.trim()
            url = urlField.text.trim()
            password = passwordField.text.takeIf { it.isNotBlank() }
        }
        
        return if (explorationData.isUrlDataValid()) {
            true
        } else {
            Alert(Alert.AlertType.ERROR).apply {
                title = "Validation Error"
                contentText = "Please enter a valid app name and Figma URL"
                showAndWait()
            }
            false
        }
    }
} 