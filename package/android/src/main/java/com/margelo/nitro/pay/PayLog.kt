package com.margelo.nitro.pay

import android.util.Log

/**
 * Logcat output of the library, written in debug builds only.
 *
 * Release builds log nothing: payment requests hold merchant IDs, item labels
 * and amounts, and payment errors already reach JS in `PaymentResult.error`.
 */
internal object PayLog {
    fun d(tag: String, message: String) {
        if (BuildConfig.DEBUG) Log.d(tag, message)
    }

    fun w(tag: String, message: String, error: Throwable? = null) {
        if (BuildConfig.DEBUG) Log.w(tag, message, error)
    }

    fun e(tag: String, message: String, error: Throwable? = null) {
        if (BuildConfig.DEBUG) Log.e(tag, message, error)
    }
}
