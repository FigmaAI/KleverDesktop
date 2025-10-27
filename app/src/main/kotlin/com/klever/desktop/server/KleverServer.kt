package com.klever.desktop.server

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import mu.KotlinLogging
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.klever.desktop.server.handlers.MessageHandler
import com.klever.desktop.server.handlers.MessageType
import com.klever.desktop.server.handlers.WebSocketResponse
import com.klever.desktop.server.config.AppConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

class KleverServer(port: Int) : WebSocketServer(InetSocketAddress(port)) {
    private val messageHandler = MessageHandler()
    private val _connections = mutableSetOf<WebSocket>()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    val connections: Set<WebSocket>
        get() = _connections.toSet()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        _connections.add(conn)
        logger.info { "New connection established from: ${conn.remoteSocketAddress}" }
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String, remote: Boolean) {
        _connections.remove(conn)
        logger.info { "Connection closed: $reason (code: $code)" }
    }

    override fun onMessage(conn: WebSocket, message: String) {
        scope.launch {
            try {
                // Log message type without base64 data
                val messagePreview = if (message.contains("imageBase64") || message.contains("imageData")) {
                    "${message.take(100)}... [contains image data]"
                } else {
                    message.take(200)
                }
                logger.info { "[IN] Received message: $messagePreview..." }
                
                val response = messageHandler.handle(message)
                val jsonResponse = mapper.writeValueAsString(response)
                
                if (conn.isOpen) {
                    // Log response without base64 data
                    val responsePreview = if (jsonResponse.contains("base64")) {
                        "${jsonResponse.take(100)}... [contains base64 data, length=${jsonResponse.length}]"
                    } else {
                        jsonResponse.take(200)
                    }
                    logger.info { "[OUT] Sending response: $responsePreview" }
                    conn.send(jsonResponse)
                    logger.info { "[OK] Response sent successfully" }
                } else {
                    logger.error { "WebSocket connection closed before sending response" }
                }
            } catch (e: Exception) {
                logger.error(e) { "Failed to handle message" }
                if (conn.isOpen) {
                    val errorResponse = WebSocketResponse(
                        type = parseMessageType(message),
                        status = "error",
                        payload = mapOf("error" to (e.message ?: "Unknown error"))
                    )
                    conn.send(mapper.writeValueAsString(errorResponse))
                }
            }
        }
    }

    private fun parseMessageType(message: String): MessageType {
        return try {
            val jsonNode = mapper.readTree(message)
            MessageType.valueOf(jsonNode.get("type").asText())
        } catch (e: Exception) {
            logger.error(e) { "Failed to parse message type, defaulting to INIT" }
            MessageType.INIT
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        logger.error(ex) { "WebSocket error occurred: ${ex.message}" }
    }

    override fun onStart() {
        logger.info { "WebSocket server started" }
    }

    override fun broadcast(message: String) {
        super.broadcast(message)
    }
}
