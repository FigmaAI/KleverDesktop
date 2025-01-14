package com.klever.desktop.server.handlers

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mu.KotlinLogging
import com.klever.desktop.browser.SeleniumController
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import com.klever.desktop.server.models.AIModel
import com.klever.desktop.server.models.OpenAIModel
// import com.klever.desktop.server.models.QwenModel
import com.klever.desktop.server.config.ModelConfig
import com.klever.desktop.server.config.OpenAIConfig
// import com.klever.desktop.server.config.QwenConfig
import com.klever.desktop.server.repositories.ModelConfigRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import com.klever.desktop.server.models.AzureModel
import com.klever.desktop.server.config.AzureConfig
import com.klever.desktop.server.config.OllamaConfig
import com.klever.desktop.server.models.OllamaModel
import kotlinx.coroutines.withContext

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

enum class MessageType {
    INIT,
    CLOSE,
    GET_SCREENSHOT,
    EXECUTE_ACTION,
    EXPLORE,
    REFLECT
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

data class ExploreRequest(
    val prompt: String,
    val imageBase64: List<String>
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
    private var modelInstance: AIModel? = null
    private val repository = ModelConfigRepository()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val configChangeListener = repository.addConfigChangeListener { 
        scope.launch {
            initializeModel()
        }
    }

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
            
            // prefix를 사용하여 임시 파일 이름 생성
            val tempFile = File.createTempFile("screenshot_${prefix}_", ".png").apply { 
                deleteOnExit() 
            }
            
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

    private fun createRequestScope() = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private suspend fun handleModelRequest(
        type: MessageType,
        payload: Map<String, Any>
    ): WebSocketResponse {
        return withContext(Dispatchers.IO) {
            try {
                if (modelInstance == null) {
                    logger.info { "Model instance is null, initializing..." }
                    initializeModel()
                }
                
                logger.info { "📤 Processing ${type.name} request..." }
                val request = ExploreRequest(
                    prompt = payload["prompt"] as String,
                    imageBase64 = when (val img = payload["imageBase64"]) {
                        is List<*> -> img.filterIsInstance<String>()
                        is String -> listOf(img)
                        else -> throw IllegalArgumentException("Invalid imageBase64 format")
                    }
                )
                
                val (success, response) = modelInstance?.get_model_response(
                    prompt = request.prompt,
                    images = request.imageBase64
                ) ?: (false to "Model not initialized")
                
                createResponse(
                    type = type,
                    status = if (success) "success" else "error",
                    payload = mapOf("response" to response)
                )
            } catch (e: Exception) {
                logger.error(e) { "Failed to handle $type request: ${e.message}" }
                createResponse(
                    type = type,
                    status = "error",
                    payload = mapOf("response" to "Error: ${e.message}")
                )
            }
        }
    }

    private suspend fun handleExplore(payload: Map<String, Any>): WebSocketResponse {
        return handleModelRequest(MessageType.EXPLORE, payload)
    }

    private suspend fun handleReflect(payload: Map<String, Any>): WebSocketResponse {
        return handleModelRequest(MessageType.REFLECT, payload)
    }

    private suspend fun initializeModel() {
        try {
            val config = repository.loadCurrentConfig() 
                ?: throw IllegalStateException("No model configuration found")
            
            modelInstance = when (config) {
                is OpenAIConfig -> OpenAIModel(config)
                is AzureConfig -> AzureModel(config)
                is OllamaConfig -> OllamaModel(config)
                else -> throw IllegalStateException("Unknown config type: ${config::class.simpleName}")
            }
        } catch (e: Exception) {
            logger.error(e) { "Failed to initialize AI model" }
            throw e
        }
    }

    private fun handleInit(payload: Map<String, Any>): WebSocketResponse {
        return try {
            // 1. Initialize browser
            seleniumController?.close()
            seleniumController = SeleniumController(
                url = payload["url"] as String,
                password = (payload["password"] as? String) ?: ""  // null일 경우 빈 문자열 반환
            ).apply { initialize() }

            // 2. Setup task directory and screenshot area
            val setupResult = setupTaskDirectory(
                requestedWidth = payload["width"] as Int,
                requestedHeight = payload["height"] as Int
            )

            if (setupResult["status"] == "error") {
                throw IllegalStateException(setupResult["message"] as String)
            }

            // suspend 함수를 코루틴 스코프 내에서 호출
            scope.launch {
                initializeModel()
            }
            
            createResponse(
                type = MessageType.INIT,
                payload = setupResult  // setupTaskDirectory의 결과를 그대로 사용
            )
        } catch (e: Exception) {
            logger.error(e) { "❌ Initialization failed: ${e.message}" }
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
            repository.removeConfigChangeListener(configChangeListener)
            seleniumController?.close()
            seleniumController = null
            currentTaskDir = null
            currentFileKey = null
            modelInstance = null
            
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
            val action = payload["action"] as? String
                ?: throw IllegalArgumentException("Missing or invalid action")
            
            @Suppress("UNCHECKED_CAST")
            val bbox = payload["bbox"] as? Map<String, Any>
                ?: throw IllegalArgumentException("Missing or invalid bbox")
            
            @Suppress("UNCHECKED_CAST")
            val screenshotArea = payload["screenshotArea"] as? Map<String, Any>
                ?: throw IllegalArgumentException("Missing or invalid screenshotArea")

            // Calculate click coordinates with null safety
            val centerX = ((bbox["x"] as? Number)?.toInt() ?: 0).plus(
                ((bbox["width"] as? Number)?.toInt() ?: 0) / 2
            ).plus((screenshotArea["x"] as? Number)?.toInt() ?: 0)
                ?: throw IllegalArgumentException("Invalid x coordinate calculation")
            
            val centerY = ((bbox["y"] as? Number)?.toInt() ?: 0).plus(
                ((bbox["height"] as? Number)?.toInt() ?: 0) / 2
            ).plus((screenshotArea["y"] as? Number)?.toInt() ?: 0)
                ?: throw IllegalArgumentException("Invalid y coordinate calculation")

            logger.info { "🎯 Received action request:" }
            logger.info { "  - Action type: $action" }
            logger.info { "  - Element bbox: $bbox" }
            logger.info { "  - Screenshot area: $screenshotArea" }
            logger.info { "  - Calculated target coordinates: ($centerX, $centerY)" }
            
            when (action) {
                "tap" -> {
                    logger.info { "📍 Executing tap..." }
                    seleniumController?.tap(centerX, centerY)
                    Thread.sleep(1000)
                }
                "long_press" -> {
                    logger.info { "📍 Executing long press..." }
                    seleniumController?.longPress(centerX, centerY)
                    Thread.sleep(1500)
                }
                "swipe" -> {
                    val direction = SeleniumController.SwipeDirection.valueOf(
                        (payload["direction"] as? String)?.uppercase()
                            ?: throw IllegalArgumentException("Missing or invalid swipe direction")
                    )
                    val distance = SeleniumController.SwipeDistance.valueOf(
                        (payload["distance"] as? String)?.uppercase()
                            ?: throw IllegalArgumentException("Missing or invalid swipe distance")
                    )
                    logger.info { "📍 Executing swipe..." }
                    logger.info { "  - Direction: $direction" }
                    logger.info { "  - Distance: $distance" }
                    seleniumController?.swipe(centerX, centerY, direction, distance)
                    Thread.sleep(1500)
                }
            }

            logger.info { "✅ Action executed successfully" }
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
            logger.error(e) { "❌ Action execution failed: ${e.message}" }
            logger.error { "Payload was: $payload" }
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

    suspend fun handle(message: String): WebSocketResponse {
        val request = parseMessage(message)
        
        return try {
            when (request.type) {
                MessageType.INIT -> handleInit(request.payload)
                MessageType.CLOSE -> handleClose()
                MessageType.GET_SCREENSHOT -> handleScreenshot(request.payload)
                MessageType.EXECUTE_ACTION -> handleExecuteAction(request.payload)
                MessageType.EXPLORE -> handleExplore(request.payload)
                MessageType.REFLECT -> handleReflect(request.payload)
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

    fun close() {
        try {
            repository.removeConfigChangeListener(configChangeListener)
            seleniumController?.close()
            seleniumController = null
            currentTaskDir = null
            currentFileKey = null
            modelInstance = null
        } catch (e: Exception) {
            logger.error(e) { "Error during MessageHandler cleanup" }
        }
    }
}
