// android/app/src/main/java/com/stocklock/LockScreenModule.kt
package com.stocklock

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class LockScreenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LockScreenModule"

    @ReactMethod
    fun startService() {
        val intent = Intent(reactApplicationContext, LockScreenService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(reactApplicationContext, intent)
        } else {
            reactApplicationContext.startService(intent)
        }
    }

    @ReactMethod
    fun isOverlayPermissionGranted(promise: Promise) {
        promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
    }

    @ReactMethod
    fun areNotificationsEnabled(promise: Promise) {
        val enabled = NotificationManagerCompat.from(reactApplicationContext).areNotificationsEnabled()
        promise.resolve(enabled)
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        val pm = reactApplicationContext.getSystemService(PowerManager::class.java)
        val pkg = reactApplicationContext.packageName
        promise.resolve(pm?.isIgnoringBatteryOptimizations(pkg) == true)
    }

    @ReactMethod
    fun openOverlaySettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:${reactApplicationContext.packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun openNotificationSettings() {
        val intent = Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
            putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactApplicationContext.startActivity(intent)
    }

    @ReactMethod
    fun openBatteryOptimizationSettings() {
        val pkg = reactApplicationContext.packageName
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
            data = Uri.parse("package:$pkg")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            reactApplicationContext.startActivity(intent)
        } catch (_: Exception) {
            val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(fallback)
        }
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
