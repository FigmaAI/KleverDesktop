package com.klever.desktop

import kotlin.test.Test
import kotlin.test.assertNotNull

class AppTest {
    @Test 
    fun appHasGreeting() {
        val app = KleverDesktopApp()
        assertNotNull(app, "app should not be null")
    }
} 