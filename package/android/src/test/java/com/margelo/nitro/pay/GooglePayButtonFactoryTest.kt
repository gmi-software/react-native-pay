package com.margelo.nitro.pay

import org.junit.Assert.assertEquals
import org.junit.Test

class GooglePayButtonFactoryTest {

    @Test
    fun cornerRadiusPx_scalesDpByTheScreenDensity() {
        assertEquals(8, GooglePayButtonFactory.cornerRadiusPx(8.0, 1f))
        assertEquals(24, GooglePayButtonFactory.cornerRadiusPx(8.0, 3f))
        assertEquals(0, GooglePayButtonFactory.cornerRadiusPx(0.0, 3f))
    }

    @Test
    fun cornerRadiusPx_roundsToTheNearestPixel() {
        assertEquals(11, GooglePayButtonFactory.cornerRadiusPx(4.0, 2.625f))
        assertEquals(10, GooglePayButtonFactory.cornerRadiusPx(3.5, 2.75f))
    }

    @Test
    fun pressListener_callsTheHandlerSetAfterTheButtonWasBuilt() {
        // A button kept after a failed update was built while onPress was null.
        var onPress: (() -> Unit)? = null
        val listener = GooglePayButtonFactory.pressListener { onPress }
        val calls = mutableListOf<String>()

        listener.onClick(null)
        onPress = { calls.add("first") }
        listener.onClick(null)
        onPress = { calls.add("second") }
        listener.onClick(null)

        assertEquals(listOf("first", "second"), calls)
    }

    @Test
    fun pressListener_ignoresTapsWithoutAHandler() {
        // Does not throw.
        GooglePayButtonFactory.pressListener { null }.onClick(null)
    }
}
