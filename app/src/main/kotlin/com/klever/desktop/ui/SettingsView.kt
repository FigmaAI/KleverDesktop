package com.klever.desktop.ui

import com.klever.desktop.config.AppConfig
import com.klever.desktop.model.Settings
import javafx.geometry.Insets
import javafx.scene.control.*
import javafx.scene.layout.GridPane
import javafx.scene.layout.Priority
import javafx.scene.layout.VBox

class SettingsView : VBox() {
    private val appConfig = AppConfig()
    private val settings = appConfig.loadSettings()
    
    private val modelComboBox = ComboBox<String>().apply {
        items.add("OpenAI")
        value = settings.model
    }
    
    private val openAiApiBaseField = TextField(settings.openAiApiBase)
    private val openAiApiKeyField = PasswordField().apply {
        text = settings.openAiApiKey
    }
    private val openAiApiModelField = TextField(settings.openAiApiModel)
    private val figmaAccessTokenField = PasswordField().apply {
        text = settings.figmaAccessToken
    }
    
    init {
        spacing = 10.0
        padding = Insets(20.0)
        
        val grid = GridPane().apply {
            hgap = 10.0
            vgap = 10.0
            
            add(Label("Model:"), 0, 0)
            add(modelComboBox, 1, 0)
            
            add(Label("OpenAI API Base:"), 0, 1)
            add(openAiApiBaseField, 1, 1)
            
            add(Label("OpenAI API Key:"), 0, 2)
            add(openAiApiKeyField, 1, 2)
            
            add(Label("OpenAI API Model:"), 0, 3)
            add(openAiApiModelField, 1, 3)
            
            add(Label("Figma Access Token:"), 0, 4)
            add(figmaAccessTokenField, 1, 4)
        }
        
        val saveButton = Button("Save").apply {
            setOnAction {
                saveSettings()
            }
        }
        
        children.addAll(
            Label("Settings").apply { style = "-fx-font-size: 20px" },
            grid,
            saveButton
        )
        
        VBox.setVgrow(grid, Priority.ALWAYS)
    }
    
    private fun saveSettings() {
        val newSettings = Settings(
            model = modelComboBox.value,
            openAiApiBase = openAiApiBaseField.text,
            openAiApiKey = openAiApiKeyField.text,
            openAiApiModel = openAiApiModelField.text,
            figmaAccessToken = figmaAccessTokenField.text
        )
        
        if (newSettings.isValid()) {
            appConfig.saveSettings(newSettings)
            showAlert("Success", "Settings saved successfully", Alert.AlertType.INFORMATION)
        } else {
            showAlert("Error", "Please fill in all required fields", Alert.AlertType.ERROR)
        }
    }
    
    private fun showAlert(title: String, content: String, type: Alert.AlertType) {
        Alert(type).apply {
            this.title = title
            this.contentText = content
            showAndWait()
        }
    }
} 