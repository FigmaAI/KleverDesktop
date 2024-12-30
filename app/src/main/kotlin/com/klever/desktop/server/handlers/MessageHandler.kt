package com.klever.desktop.server.handlers

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mu.KotlinLogging
import com.klever.desktop.browser.SeleniumController
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

enum class MessageType {
    INIT,
    CLOSE,
    GET_SCREENSHOT
}

data class WebSocketMessage(
    val type: MessageType,
    val payload: Map<String, Any>
)

data class WebSocketResponse(
    val type: MessageType,
    val status: String,
    val payload: Map<String, Any>
)

private fun createResponse(
    type: MessageType,
    status: String = "success",
    payload: Map<String, Any>
): WebSocketResponse = WebSocketResponse(type, status, payload)

class MessageHandler {
    private var seleniumController: SeleniumController? = null
    private var currentTaskDir: File? = null
    private var currentFileKey: String? = null
    private var currentScreenshotArea: ScreenshotArea? = null

    data class ScreenshotArea(
        val x: Int,          // 캔버스 내에서의 스크린샷 시작 x 좌표
        val y: Int,          // 캔버스 내에서의 스크린샷 시작 y 좌표
        val width: Int,      // 스크린샷 영역의 너비
        val height: Int      // 스크린샷 영역의 높이
    )

    private fun setupTaskDirectory(requestedWidth: Int, requestedHeight: Int): Map<String, Any> {
        return try {
            // Get current URL and extract file key
            val currentUrl = seleniumController?.getCurrentUrl()
                ?: throw IllegalStateException("Failed to get current URL")
            
            // Extract and convert nodeId
            val nodeId = Regex("node-id=([^&]+)").find(currentUrl)?.groupValues?.get(1)
                ?.replace("-", ":")
                ?: throw IllegalStateException("Failed to extract node ID from URL")
            
            // Extract file key
            val fileKey = Regex("/(file|proto)/(.*?)/").find(currentUrl)?.groupValues?.get(2)
                ?: throw IllegalStateException("Failed to extract file key from URL")
            
            // Create directory structure
            val rootDir = File("./")
            val demosDir = File(rootDir, "demos").apply { mkdirs() }
            val fileDir = File(demosDir, fileKey).apply { mkdirs() }
            
            // Create task directory with timestamp
            val timestamp = System.currentTimeMillis()
            val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss")
            val taskName = "self_explore_${dateFormat.format(Date(timestamp))}"
            val taskDir = File(fileDir, taskName).apply { mkdirs() }
            
            // Store directory info
            currentTaskDir = taskDir
            currentFileKey = fileKey
            
            // Calculate screenshot area
            val (canvasWidth, canvasHeight) = seleniumController?.getCanvasSize()
                ?: throw IllegalStateException("Failed to get canvas size")
            
            // Calculate centered position
            val x = (canvasWidth - requestedWidth) / 2
            val y = (canvasHeight - requestedHeight) / 2
            
            // Store screenshot area for reuse
            currentScreenshotArea = ScreenshotArea(x, y, requestedWidth, requestedHeight)
            
            mapOf(
                "status" to "success",
                "fileKey" to fileKey,
                "nodeId" to nodeId,
                "taskDir" to taskDir.absolutePath,
                "screenshotArea" to mapOf(
                    "x" to currentScreenshotArea!!.x,
                    "y" to currentScreenshotArea!!.y,
                    "width" to currentScreenshotArea!!.width,
                    "height" to currentScreenshotArea!!.height
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to setup task directory: ${e.message}" }
            mapOf(
                "status" to "error",
                "message" to "Failed to setup task directory: ${e.message}"
            )
        }
    }

    private fun captureCanvasScreenshot(prefix: String, round: Int = 1): Map<String, Any> {
        return try {
            val taskDir = currentTaskDir
                ?: throw IllegalStateException("Task directory not set up")
            val screenshotArea = currentScreenshotArea
                ?: throw IllegalStateException("Screenshot area not set up")
            
            // Get current URL and extract node ID
            val currentUrl = seleniumController?.getCurrentUrl()
                ?: throw IllegalStateException("Failed to get current URL")
            val nodeId = Regex("""node-id=([^&]+)""").find(currentUrl)?.groupValues?.get(1)
                ?: throw IllegalStateException("Failed to extract node ID from URL")
            
            // Take screenshot using stored screenshot area
            val screenshotPath = File(taskDir, "${round}_${prefix}.png").absolutePath
            seleniumController?.takeScreenshot(
                x = screenshotArea.x,
                y = screenshotArea.y,
                width = screenshotArea.width,
                height = screenshotArea.height,
                outputPath = screenshotPath
            ) ?: throw IllegalStateException("Failed to take screenshot")
            
            mapOf(
                "type" to "SCREENSHOT",
                "status" to "success",
                "payload" to mapOf(
                    "nodeId" to nodeId,
                    "screenshotPath" to screenshotPath,
                    "round" to round
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to capture canvas screenshot: ${e.message}" }
            mapOf(
                "type" to "SCREENSHOT",
                "status" to "error",
                "payload" to mapOf(
                    "message" to "Failed to capture canvas screenshot: ${e.message}"
                )
            )
        }
    }

    private fun handleInit(payload: Map<String, Any>): WebSocketResponse {
        return try {
            // 1. Initialize browser
            seleniumController?.close()
            seleniumController = SeleniumController(
                url = payload["url"] as String,
                password = payload["password"] as? String
            ).apply { initialize() }

            // 2. Setup task directory and screenshot area
            val setupResult = setupTaskDirectory(
                requestedWidth = payload["width"] as Int,
                requestedHeight = payload["height"] as Int
            )

            if (setupResult["status"] == "error") {
                throw IllegalStateException(setupResult["message"] as String)
            }

            // setupResult의 모든 정보를 응답에 포함
            createResponse(
                type = MessageType.INIT,
                payload = mapOf(
                    "message" to "Browser initialized and task setup completed",
                    "fileKey" to (setupResult["fileKey"] ?: ""),
                    "taskDir" to (setupResult["taskDir"] ?: ""),
                    "nodeId" to (setupResult["nodeId"] ?: ""),
                    "screenshotArea" to (setupResult["screenshotArea"] ?: mapOf<String, Any>())
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to initialize: ${e.message}" }
            createResponse(
                type = MessageType.INIT,
                status = "error",
                payload = mapOf("message" to "Failed to initialize: ${e.message}")
            )
        }
    }

    private fun handleScreenshot(payload: Map<String, Any>): WebSocketResponse {
        return try {
            val prefix = payload["prefix"] as String
            val round = payload["round"] as? Int ?: 1  // 기본값 1
            val result = captureCanvasScreenshot(prefix, round)
            
            if (result["status"] == "error") {
                throw IllegalStateException(result["message"] as String)
            }

            createResponse(
                type = MessageType.GET_SCREENSHOT,
                payload = result
            )
        } catch (e: Exception) {
            createResponse(
                type = MessageType.GET_SCREENSHOT,
                status = "error",
                payload = mapOf("message" to "Failed to capture screenshot: ${e.message}")
            )
        }
    }

    private fun handleClose(): WebSocketResponse {
        return try {
            seleniumController?.close()
            seleniumController = null
            currentTaskDir = null
            currentFileKey = null
            
            createResponse(
                type = MessageType.CLOSE,
                payload = mapOf(
                    "message" to "Browser session closed successfully"
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to close browser: ${e.message}" }
            createResponse(
                type = MessageType.CLOSE,
                status = "error",
                payload = mapOf("message" to "Failed to close browser: ${e.message}")
            )
        }
    }

    private fun parseMessage(message: String): WebSocketMessage {
        return try {
            mapper.readValue(message)
        } catch (e: Exception) {
            logger.error(e) { "Failed to parse message: $message" }
            WebSocketMessage(MessageType.INIT, emptyMap()) // 기본값
        }
    }

    fun handle(message: String): WebSocketResponse {
        val request = parseMessage(message)
        
        return try {
            when (request.type) {
                MessageType.INIT -> handleInit(request.payload)
                MessageType.CLOSE -> handleClose()
                MessageType.GET_SCREENSHOT -> handleScreenshot(request.payload)
            }
        } catch (e: Exception) {
            logger.error(e) { "Error handling message: ${e.message}" }
            createResponse(
                type = request.type,
                status = "error",
                payload = mapOf("message" to (e.message ?: "Unknown error"))
            )
        }
    }
}
