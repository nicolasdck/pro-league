package com.decook.proleaguesync

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class ProLeagueSyncApp : Application() {

    override fun onCreate() {
        super.onCreate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Synchronisation Pro League",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Statut de la synchronisation des scores en arrière-plan"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        const val CHANNEL_ID = "proleague_sync_channel"
    }
}
