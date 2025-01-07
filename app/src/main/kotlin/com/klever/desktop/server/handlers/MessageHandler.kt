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
    GET_SCREENSHOT,
    EXECUTE_ACTION
}

data class WebSocketMessage(
    val type: MessageType,
    val payload: Map<String, Any>
)

data class WebSocketResponse(
    val type: MessageType,
    val status: String = "success",
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
            
            // Extract file key
            val fileKey = Regex("/(file|proto)/(.*?)/").find(currentUrl)?.groupValues?.get(2)
                ?: throw IllegalStateException("Failed to extract file key from URL")
            
            // Create directory structure
            val rootDir = File("demos")
            val fileDir = File(rootDir, fileKey).apply { mkdirs() }
            
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

    private fun getImageAsBase64(imagePath: String): String {
        return try {
            val file = File(imagePath)
            if (!file.exists()) {
                throw IllegalArgumentException("Image file not found: $imagePath")
            }
            val bytes = file.readBytes()
            java.util.Base64.getEncoder().encodeToString(bytes)
        } catch (e: Exception) {
            logger.error(e) { "Failed to encode image to base64: ${e.message}" }
            throw e
        }
    }

    private fun captureCanvasScreenshot(prefix: String): Map<String, Any> {
        return try {
            val screenshotArea = currentScreenshotArea
                ?: throw IllegalStateException("Screenshot area not set up")
            
            // 임시 파일로 스크린샷 저장
            val tempFile = File.createTempFile("screenshot", ".png").apply { deleteOnExit() }
            
            // 스크린샷 캡처
            seleniumController?.takeScreenshot(
                x = screenshotArea.x,
                y = screenshotArea.y,
                width = screenshotArea.width,
                height = screenshotArea.height,
                outputPath = tempFile.absolutePath
            ) ?: throw IllegalStateException("Failed to take screenshot")
            
            // 현재 활성화된 노드 ID 가져오기
            val nodeId = seleniumController?.getCurrentActiveNodeId()
                ?: throw IllegalStateException("Failed to get active node ID")
            
            // 이미지를 Base64로 인코딩하고 임시 파일 삭제
            val imageBase64 = getImageAsBase64(tempFile.absolutePath)
            tempFile.delete()
            
            mapOf(
                "type" to "SCREENSHOT",
                "status" to "success",
                "payload" to mapOf(
                    "nodeId" to nodeId,
                    "imageData" to "data:image/png;base64,$imageBase64"
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to capture canvas screenshot: ${e.message}" }
            mapOf(
                "type" to "SCREENSHOT",
                "status" to "error",
                "payload" to mapOf("message" to "Failed to capture screenshot: ${e.message}")
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
            val result = captureCanvasScreenshot(prefix)
            
            if (result["status"] == "error") {
                throw IllegalStateException(
                    (result["payload"] as? Map<String, Any>)?.get("message") as? String 
                    ?: "Unknown error"
                )
            }

            createResponse(
                type = MessageType.GET_SCREENSHOT,
                payload = (result["payload"] as Map<String, Any>)
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

    private fun handleExecuteAction(payload: Map<String, Any>): WebSocketResponse {
        return try {
            val action = payload["action"] as String
            val centerX = payload["centerX"] as Int
            val centerY = payload["centerY"] as Int

            when (action) {
                "tap" -> {
                    seleniumController?.tap(centerX, centerY)
                }
                "long_press" -> {
                    seleniumController?.longPress(centerX, centerY)
                }
                "swipe" -> {
                    val direction = SeleniumController.SwipeDirection.valueOf(
                        (payload["direction"] as String).uppercase()
                    )
                    val distance = SeleniumController.SwipeDistance.valueOf(
                        (payload["distance"] as String).uppercase()
                    )
                    seleniumController?.swipe(centerX, centerY, direction, distance)
                }
            }

            // 액션 실행 후 성공 응답
            createResponse(
                type = MessageType.EXECUTE_ACTION,
                payload = mapOf(
                    "message" to "Action executed successfully",
                    "action" to action,
                    "coordinates" to mapOf(
                        "x" to centerX,
                        "y" to centerY
                    )
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to execute action: ${e.message}" }
            createResponse(
                type = MessageType.EXECUTE_ACTION,
                status = "error",
                payload = mapOf("message" to "Failed to execute action: ${e.message}")
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
                MessageType.EXECUTE_ACTION -> handleExecuteAction(request.payload)
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
