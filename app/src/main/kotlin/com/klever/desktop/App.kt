package com.klever.desktop

import com.klever.desktop.server.KleverServer
import com.klever.desktop.config.AppConfig
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

class App {
    private lateinit var server: KleverServer
    private val config = AppConfig()

    fun start() {
        try {
            // 서버 초기화 및 시작
            server = KleverServer(config.port)
            server.start()
            logger.info { "KleverDesktop server started on port ${config.port}" }

            // 종료 시그널 처리
            Runtime.getRuntime().addShutdownHook(Thread {
                stop()
            })

        } catch (e: Exception) {
            logger.error(e) { "Failed to start server: ${e.message}" }
            throw e
        }
    }

    private fun stop() {
        try {
            server.stop()
            logger.info { "KleverDesktop server stopped" }
        } catch (e: Exception) {
            logger.error(e) { "Error stopping server: ${e.message}" }
        }
    }
}

fun main() {
    App().start()
}
