package com.klever.desktop.server

import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import mu.KotlinLogging
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.klever.desktop.server.handlers.MessageHandler
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
                val response = messageHandler.handle(message)
                val jsonResponse = mapper.writeValueAsString(response)
                conn.send(jsonResponse)
            } catch (e: Exception) {
                logger.error(e) { "Failed to handle message" }
            }
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
