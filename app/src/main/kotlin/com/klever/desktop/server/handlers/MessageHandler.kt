package com.klever.desktop.server.handlers

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mu.KotlinLogging
import com.klever.desktop.browser.SeleniumController

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

class MessageHandler {
    private var seleniumController: SeleniumController? = null

    fun handle(message: String): Map<String, Any> {
        val request = parseMessage(message)
        
        return when (request["type"]) {
            "connect" -> handleConnect(request)
            "startTest" -> handleStartTest(request)
            "executeAction" -> handleExecuteAction(request)
            "INIT" -> handleInit(request)
            "CLOSE" -> handleClose(request)
            else -> handleUnknownMessage(request)
        }
    }

    private fun parseMessage(message: String): Map<String, Any> {
        return try {
            mapper.readValue(message)
        } catch (e: Exception) {
            logger.error(e) { "Failed to parse message: $message" }
            mapOf("type" to "unknown")
        }
    }

    private fun handleConnect(request: Map<String, Any>): Map<String, Any> {
        return mapOf(
            "status" to "success",
            "type" to "connect",
            "message" to "Connection established"
        )
    }

    private fun handleStartTest(request: Map<String, Any>): Map<String, Any> {
        // TODO: Implement test initialization logic
        return mapOf(
            "status" to "success",
            "type" to "startTest",
            "message" to "Test started"
        )
    }

    private fun handleExecuteAction(request: Map<String, Any>): Map<String, Any> {
        // TODO: Implement action execution logic
        return mapOf(
            "status" to "success",
            "type" to "executeAction",
            "message" to "Action executed"
        )
    }

    private fun handleInit(request: Map<String, Any>): Map<String, Any> {
        return try {
            logger.debug("Handling INIT request with payload: ${request["payload"]}")
            
            val url = request["payload"]?.let { 
                (it as Map<*, *>)["url"] as String 
            } ?: throw IllegalArgumentException("URL is required")
            
            val password = request["payload"]?.let { 
                (it as Map<*, *>)["password"] as String? 
            }
            
            seleniumController?.close()
            seleniumController = SeleniumController(url, password)
            seleniumController?.initialize()
            
            logger.info("Browser initialized successfully for URL: $url")
            
            mapOf(
                "type" to "INIT",
                "status" to "success",
                "payload" to mapOf(
                    "message" to "Browser initialized successfully"
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to initialize browser: ${e.message}" }
            mapOf(
                "type" to "INIT",
                "status" to "error",
                "payload" to mapOf(
                    "message" to "Failed to initialize browser: ${e.message}"
                )
            )
        }
    }

    private fun handleClose(request: Map<String, Any>): Map<String, Any> {
        return try {
            seleniumController?.close()
            seleniumController = null
            
            mapOf(
                "type" to "CLOSE",
                "status" to "success",
                "payload" to mapOf(
                    "message" to "Browser session closed successfully"
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to close browser: ${e.message}" }
            mapOf(
                "type" to "CLOSE",
                "status" to "error",
                "payload" to mapOf(
                    "message" to "Failed to close browser: ${e.message}"
                )
            )
        }
    }

    private fun handleUnknownMessage(request: Map<String, Any>): Map<String, Any> {
        return mapOf(
            "status" to "error",
            "type" to "unknown",
            "message" to "Unknown message type"
        )
    }
}
