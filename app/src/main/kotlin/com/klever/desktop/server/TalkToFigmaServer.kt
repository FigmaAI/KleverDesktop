package com.klever.desktop.server

import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import mu.KotlinLogging
import org.java_websocket.WebSocket
import org.java_websocket.handshake.ClientHandshake
import org.java_websocket.server.WebSocketServer
import java.net.InetSocketAddress
import java.util.concurrent.ConcurrentHashMap

private val logger = KotlinLogging.logger {}
private val mapper = jacksonObjectMapper()

class TalkToFigmaServer(port: Int) : WebSocketServer(InetSocketAddress(port)) {

    private val channels = ConcurrentHashMap<String, MutableSet<WebSocket>>()
    private val clientChannels = ConcurrentHashMap<WebSocket, String>()

    override fun onOpen(conn: WebSocket, handshake: ClientHandshake) {
        logger.info { "[TalkToFigma] New client connected: ${conn.remoteSocketAddress}" }
        conn.send(mapper.writeValueAsString(mapOf(
            "type" to "system",
            "message" to "Please join a channel to start chatting"
        )))
    }

    override fun onClose(conn: WebSocket, code: Int, reason: String?, remote: Boolean) {
        logger.info { "[TalkToFigma] Client disconnected: ${conn.remoteSocketAddress}" }
        removeClientFromChannel(conn)
    }

    override fun onMessage(conn: WebSocket, message: String) {
        try {
            val data: Map<String, Any> = mapper.readValue(message)
            val type = data["type"] as? String

            when (type) {
                "join" -> handleJoin(conn, data)
                "message" -> handleMessage(conn, data)
                else -> {
                    logger.warn { "[TalkToFigma] Unknown message type: $type" }
                    conn.send(mapper.writeValueAsString(mapOf("type" to "error", "message" to "Unknown message type")))
                }
            }
        } catch (e: Exception) {
            logger.error(e) { "[TalkToFigma] Error handling message" }
            conn.send(mapper.writeValueAsString(mapOf("type" to "error", "message" to e.message)))
        }
    }

    private fun handleJoin(conn: WebSocket, data: Map<String, Any>) {
        val channelName = data["channel"] as? String
        if (channelName.isNullOrBlank()) {
            conn.send(mapper.writeValueAsString(mapOf("type" to "error", "message" to "Channel name is required")))
            return
        }

        // Remove from old channel if any
        removeClientFromChannel(conn)

        // Add to new channel
        channels.computeIfAbsent(channelName) { ConcurrentHashMap.newKeySet() }.add(conn)
        clientChannels[conn] = channelName

        logger.info { "[TalkToFigma] Client ${conn.remoteSocketAddress} joined channel: $channelName" }

        // Notify client of successful join
        conn.send(mapper.writeValueAsString(mapOf(
            "type" to "system",
            "message" to "Joined channel: $channelName",
            "channel" to channelName
        )))

        // Notify other clients in the channel
        val notification = mapOf(
            "type" to "system",
            "message" to "A new user has joined the channel",
            "channel" to channelName
        )
        broadcastToChannel(conn, channelName, mapper.writeValueAsString(notification))
    }

    private fun handleMessage(conn: WebSocket, data: Map<String, Any>) {
        val channelName = clientChannels[conn]
        if (channelName == null) {
            conn.send(mapper.writeValueAsString(mapOf("type" to "error", "message" to "You must join a channel first")))
            return
        }

        val messageContent = data["message"]
        val broadcastMessage = mapOf(
            "type" to "broadcast",
            "message" to messageContent,
            "sender" to "user", // Simplified sender logic
            "channel" to channelName
        )
        broadcastToChannel(conn, channelName, mapper.writeValueAsString(broadcastMessage))
    }

    private fun removeClientFromChannel(conn: WebSocket) {
        val channelName = clientChannels.remove(conn)
        if (channelName != null) {
            val clients = channels[channelName]
            clients?.remove(conn)
            logger.info { "[TalkToFigma] Client ${conn.remoteSocketAddress} removed from channel: $channelName" }

            // Notify remaining clients
            val notification = mapOf(
                "type" to "system",
                "message" to "A user has left the channel",
                "channel" to channelName
            )
            broadcastToChannel(null, channelName, mapper.writeValueAsString(notification))

            // Clean up empty channel
            if (clients?.isEmpty() == true) {
                channels.remove(channelName)
                logger.info { "[TalkToFigma] Channel removed: $channelName" }
            }
        }
    }

    private fun broadcastToChannel(sender: WebSocket?, channelName: String, message: String) {
        channels[channelName]?.forEach { client ->
            if (client != sender && client.isOpen) {
                client.send(message)
            }
        }
    }

    override fun onError(conn: WebSocket?, ex: Exception) {
        logger.error(ex) { "[TalkToFigma] WebSocket error occurred" }
    }

    override fun onStart() {
        logger.info { "TalkToFigma WebSocket server started on port $port" }
    }
} 