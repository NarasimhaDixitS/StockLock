// android/app/src/main/java/com/stocklock/LockScreenModule.kt
package com.stocklock

import android.content.Intent
import com.facebook.react.bridge.*

class LockScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LockScreenModule"

    @ReactMethod
    fun startService() {
        val intent = Intent(reactApplicationContext, LockScreenService::class.java)
        reactApplicationContext.startForegroundService(intent)
    }

    @ReactMethod
    fun stopService() {
        val intent = Intent(reactApplicationContext, LockScreenService::class.java)
        reactApplicationContext.stopService(intent)
    }

    @ReactMethod
    fun setTrackedSymbols(symbolsJson: String) {
        val intent = Intent(LockScreenService.ACTION_SET_TRACKED_SYMBOLS).apply {
            putExtra("symbols_json", symbolsJson)
        }
        reactApplicationContext.sendBroadcast(intent)
    }
}
