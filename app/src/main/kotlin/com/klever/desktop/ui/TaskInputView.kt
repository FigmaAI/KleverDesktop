package com.klever.desktop.ui

import com.klever.desktop.model.ExplorationData
import javafx.geometry.Insets
import javafx.scene.control.*
import javafx.scene.layout.Priority
import javafx.scene.layout.VBox

class TaskInputView(
    private val explorationData: ExplorationData,
    private val onBack: () -> Unit,
    private val onStart: () -> Unit
) : VBox(20.0) {
    
    private val taskDescArea = TextArea().apply {
        promptText = "Example: 'Find the cheapest hotel in Bali. Compare prices and locations, " +
                    "then select the most affordable option with good reviews.'"
        isWrapText = true
        prefRowCount = 3
        styleClass.add("input-field")
    }
    
    private val personaDescArea = TextArea().apply {
        promptText = "Example: 'A Korean female traveler who doesn't speak English well " +
                    "and prefers using translated interfaces. Budget-conscious and " +
                    "prioritizes safety and cleanliness.'"
        isWrapText = true
        prefRowCount = 2
        styleClass.add("input-field")
    }
    
    init {
        padding = Insets(20.0)
        
        children.addAll(
            Label("Task Input (Step 2/2)").apply { 
                styleClass.add("title-text")
            },
            VBox(5.0).apply {
                children.addAll(
                    Label("Task Description:"),
                    taskDescArea
                )
            },
            VBox(5.0).apply {
                children.addAll(
                    Label("Persona Description (Optional):"),
                    personaDescArea
                )
            },
            ButtonBar().apply {
                buttons.addAll(
                    Button("Back").apply {
                        styleClass.add("secondary-button")
                        setOnAction { onBack() }
                    },
                    Button("Start Exploration").apply {
                        styleClass.add("primary-button")
                        setOnAction {
                            if (saveAndValidate()) {
                                onStart()
                            }
                        }
                    }
                )
            }
        )
        
        VBox.setVgrow(taskDescArea, Priority.ALWAYS)
    }
    
    private fun saveAndValidate(): Boolean {
        explorationData.apply {
            taskDescription = taskDescArea.text.trim()
            personaDescription = personaDescArea.text.trim()
        }
        
        return if (explorationData.isTaskDataValid()) {
            true
        } else {
            Alert(Alert.AlertType.ERROR).apply {
                title = "Validation Error"
                contentText = "Please enter a task description"
                showAndWait()
            }
            false
        }
    }
} 