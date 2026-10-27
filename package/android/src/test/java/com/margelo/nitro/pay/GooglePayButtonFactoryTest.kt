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
}
