package com.margelo.nitro.pay

import com.google.android.gms.wallet.button.ButtonConstants
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
    fun mapButtonType_mapsEveryTypeToItsGooglePayButton() {
        val expected = mapOf(
            GooglePayButtonType.BUY to ButtonConstants.ButtonType.BUY,
            GooglePayButtonType.BOOK to ButtonConstants.ButtonType.BOOK,
            GooglePayButtonType.CHECKOUT to ButtonConstants.ButtonType.CHECKOUT,
            GooglePayButtonType.DONATE to ButtonConstants.ButtonType.DONATE,
            GooglePayButtonType.ORDER to ButtonConstants.ButtonType.ORDER,
            GooglePayButtonType.PAY to ButtonConstants.ButtonType.PAY,
            GooglePayButtonType.SUBSCRIBE to ButtonConstants.ButtonType.SUBSCRIBE,
            GooglePayButtonType.PLAIN to ButtonConstants.ButtonType.PLAIN,
            GooglePayButtonType.PIX to ButtonConstants.ButtonType.PIX,
            GooglePayButtonType.EWALLET to ButtonConstants.ButtonType.EWALLET,
        )

        assertEquals(GooglePayButtonType.entries.toSet(), expected.keys)
        for ((type, buttonType) in expected) {
            assertEquals(type.name, buttonType, GooglePayButtonFactory.mapButtonType(type))
        }
    }

    @Test
    fun mapButtonType_givesEachTypeADifferentButton() {
        val buttonTypes = GooglePayButtonType.entries.map(GooglePayButtonFactory::mapButtonType)

        assertEquals(buttonTypes.size, buttonTypes.toSet().size)
    }

    @Test
    fun pressListener_ignoresTapsWithoutAHandler() {
        // Does not throw.
        GooglePayButtonFactory.pressListener { null }.onClick(null)
    }
}
