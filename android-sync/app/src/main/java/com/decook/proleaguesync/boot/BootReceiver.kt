package com.decook.proleaguesync.boot

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.decook.proleaguesync.prefs.SyncPreferences
import com.decook.proleaguesync.sync.SyncForegroundService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val prefs = SyncPreferences(context.applicationContext)
                if (prefs.isEnabled()) {
                    SyncForegroundService.start(context.applicationContext)
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
