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

class MessageHandler {
    private var seleniumController: SeleniumController? = null

    fun handle(message: String): Map<String, Any> {
        val request = parseMessage(message)
        
        return when (request["type"]) {
            "connect" -> handleConnect(request)
            // "startTest" -> handleStartTest(request)
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

    private fun handleConnect(_request: Map<String, Any>): Map<String, Any> {
        logger.info("Handling connect request with payload: ${_request["payload"]}")
        return mapOf(
            "status" to "success",
            "type" to "connect",
            "message" to "Connection established"
        )
    }

    // private fun handleStartTest(request: Map<String, Any>): Map<String, Any> {
    //     // TODO: Implement test initialization logic
    //     return mapOf(
    //         "status" to "success",
    //         "type" to "startTest",
    //         "message" to "Test started"
    //     )
    // }

    private fun handleExecuteAction(_request: Map<String, Any>): Map<String, Any> {
        logger.info("Handling execute action request with payload: ${_request["payload"]}")
        // TODO: Implement action execution logic
        return mapOf(
            "status" to "success",
            "type" to "executeAction",
            "message" to "Action executed"
        )
    }

    private fun handleInit(request: Map<String, Any>): Map<String, Any> {
        return try {
            logger.info("Handling INIT request with payload: ${request["payload"]}")
            
            val payload = request["payload"] as? Map<*, *> 
                ?: throw IllegalArgumentException("Invalid payload")
                
            val url = payload["url"] as? String 
                ?: throw IllegalArgumentException("URL is required")
                
            // Figma file key 추출
            val fileKey = Regex("/(file|proto)/(.*?)/").find(url)?.groupValues?.get(2)
                ?: throw IllegalArgumentException("Could not extract file key from URL")
                
            // 작업 디렉토리 구조 생성
            val rootDir = File("./")
            val demosDir = File(rootDir, "demos").apply { mkdirs() }
            val fileDir = File(demosDir, fileKey).apply { mkdirs() }            
            // 타임스탬프로 태스크 이름 생성
            val timestamp = System.currentTimeMillis()
            val dateFormat = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss")
            val taskName = "self_explore_${dateFormat.format(Date(timestamp))}"
            
            val taskDir = File(fileDir, taskName).apply { mkdirs() }
            
            val password = payload["password"] as? String
            
            val screenWidth = payload["screenWidth"] as? Number
                ?: throw IllegalArgumentException("Screen width is required")
                
            val screenHeight = payload["screenHeight"] as? Number
                ?: throw IllegalArgumentException("Screen height is required")
                
            val nodeId = payload["nodeId"] as? String
                ?: throw IllegalArgumentException("Node ID is required")
                
            logger.info("Initializing browser with dimensions: ${screenWidth}x${screenHeight} for node: $nodeId")
            
            seleniumController?.close()
            seleniumController = SeleniumController(
                url = url,
                password = password,
                screenWidth = screenWidth.toInt(),
                screenHeight = screenHeight.toInt()
            )
            seleniumController?.initialize()
            
            // 실제 캔버스 크기 가져오기
            val (canvasWidth, canvasHeight) = seleniumController?.getCanvasSize()
                ?: throw IllegalStateException("Failed to get canvas size")
                
            // 중앙 정렬을 위한 x, y 좌표 계산
            val x = (canvasWidth - screenWidth.toInt()) / 2
            val y = (canvasHeight - screenHeight.toInt()) / 2
            
            logger.info("Bounding box: ($x, $y, ${screenWidth}, ${screenHeight})")
            
            // 스크린샷 저장 경로 설정
            val screenshotPath = File(taskDir, "1_before.png").absolutePath
            
            // 스크린샷 캡처
            seleniumController?.takeScreenshot(
                x = x,
                y = y,
                width = screenWidth.toInt(),
                height = screenHeight.toInt(),
                outputPath = screenshotPath
            )
            
            mapOf(
                "type" to "INIT",
                "status" to "success",
                "payload" to mapOf(
                    "x" to x,
                    "y" to y,
                    "width" to screenWidth,
                    "height" to screenHeight,
                    "canvasWidth" to canvasWidth,
                    "canvasHeight" to canvasHeight,
                    "screenshotPath" to screenshotPath,
                    "message" to "Browser initialized successfully"
                )
            )
        } catch (e: Exception) {
            logger.error(e) { "Failed to initialize browser: ${e.message}" }
            logger.error { "Stack trace: ${e.stackTraceToString()}" }
            mapOf(
                "type" to "INIT",
                "status" to "error",
                "payload" to mapOf(
                    "message" to "Failed to initialize browser: ${e.message}"
                )
            )
        }
    }

    private fun handleClose(_request: Map<String, Any>): Map<String, Any> {
        logger.info("Handling close request with payload: ${_request["payload"]}")
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

    private fun handleUnknownMessage(_request: Map<String, Any>): Map<String, Any> {
        logger.info("Handling unknown message type with payload: ${_request["payload"]}")
        return mapOf(
            "status" to "error",
            "type" to "unknown",
            "message" to "Unknown message type"
        )
    }
}
