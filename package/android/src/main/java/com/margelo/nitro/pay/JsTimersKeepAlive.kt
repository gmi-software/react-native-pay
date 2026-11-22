package com.margelo.nitro.pay

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext

/**
 * Keeps JS timers running while `onAuthorize` runs under the Google Pay sheet.
 *
 * React Native stops JS timers while the app's activity is paused, as it is
 * under the sheet, unless a headless JS task is running. The library's JS
 * registers [PaymentConstants.SHEET_AUTHORIZATION_TASK], a task that never
 * settles by itself; this starts it and finishes it. Main thread only.
 */
internal class JsTimersKeepAlive(private val reactContext: () -> ReactContext) {
    private var taskId: Int? = null

    fun start() {
        if (taskId != null) return
        taskId = try {
            val config = HeadlessJsTaskConfig(
                PaymentConstants.SHEET_AUTHORIZATION_TASK,
                Arguments.createMap(),
                // A safety net past Google Pay's own 30-second limit.
                PaymentConstants.SHEET_AUTHORIZATION_TASK_TIMEOUT_MS,
                true
            )
            HeadlessJsTaskContext.getInstance(reactContext()).startTask(config)
        } catch (e: Exception) {
            // Timers then wait for the sheet to close, as React Native has them.
            PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, "Unable to keep JS timers running", e)
            null
        }
    }

    fun stop() {
        val id = taskId ?: return
        taskId = null
        try {
            HeadlessJsTaskContext.getInstance(reactContext()).finishTask(id)
        } catch (e: Exception) {
            PayLog.w(PaymentConstants.TAG_PAYMENT_HANDLER, "Unable to finish the JS timers task", e)
        }
    }
}
