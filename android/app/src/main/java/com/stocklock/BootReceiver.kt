// android/app/src/main/java/com/stocklock/BootReceiver.kt
package com.stocklock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Re-start the lock screen service after device reboot
            val serviceIntent = Intent(context, LockScreenService::class.java)
            context.startForegroundService(serviceIntent)
        }
    }
}
