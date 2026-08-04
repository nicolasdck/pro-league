package com.decook.proleaguesync.sync

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import com.decook.proleaguesync.MainActivity
import com.decook.proleaguesync.R
import com.decook.proleaguesync.ProLeagueSyncApp
import com.decook.proleaguesync.prefs.SyncHistoryEntry
import com.decook.proleaguesync.prefs.SyncPreferences
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Service de fond unique (pas WorkManager/AlarmManager) : la notification persistante exempte
 * déjà le process des restrictions Doze, donc une simple boucle interne à la fréquence choisie
 * par l'utilisateur (voir [SyncPreferences.frequencySecondsFlow]) est plus simple que de
 * reconstruire l'état à chaque réveil d'alarme. Même architecture que android-sync/ du projet
 * worldcup-2026 (voir la doc de ce projet-ci pour le détail du choix).
 *
 * Limite Android 15 (targetSdk 35) : un service `dataSync` est arrêté par l'OS au-delà de 6h de
 * fonctionnement cumulé sur une fenêtre glissante de 24h ([onTimeout]).
 */
class SyncForegroundService : Service() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var prefs: SyncPreferences
    private var loopJob: Job? = null

    override fun onCreate() {
        super.onCreate()
        prefs = SyncPreferences(applicationContext)
        startForeground(NOTIFICATION_ID, buildNotification("Démarrage…"))
        loopJob = scope.launch { loop() }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    override fun onDestroy() {
        loopJob?.cancel()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onTimeout(startId: Int, fgsType: Int) {
        super.onTimeout(startId, fgsType)
        // L'OS impose ce callback quand la limite des 6h/24h pour les services dataSync est
        // atteinte ; il faut s'arrêter nous-mêmes. On retente un démarrage immédiat : si la
        // limite n'est pas encore retombée, l'OS le bloquera silencieusement, mais ça minimise
        // la coupure dès que la fenêtre de 24h glisse à nouveau sous 6h.
        stopSelf()
        start(applicationContext)
    }

    private suspend fun loop() {
        while (scope.isActive) {
            if (!prefs.isEnabled()) {
                stopSelf()
                return
            }

            prefs.setLastCheckAt(System.currentTimeMillis())
            val frequencySeconds = prefs.getFrequencySeconds()

            // Pas de plages horaires à configurer à la main : le calendrier public
            // (fixtures/cup_fixtures/european_fixtures, lecture seule) dit lui-même
            // s'il y a un match en cours ou proche — voir ScheduleChecker. Ce check est
            // volontairement bon marché (3 lectures Supabase) : il tourne à chaque cycle, même à
            // 30s, sans jamais appeler TheSportsDB/footmercato tant qu'aucun match n'est
            // réellement dans sa fenêtre live — seul runSyncWithWakeLock() le fait.
            val schedule = ScheduleChecker().checkNow()
            if (schedule.isLive) {
                runSyncWithWakeLock()
            } else {
                updateNotification(offWindowMessage(schedule, frequencySeconds))
            }

            delay(frequencySeconds * 1000L)
        }
    }

    private fun offWindowMessage(schedule: ScheduleStatus, frequencySeconds: Int): String {
        val nextAt = schedule.nextAtMillis
        return if (nextAt != null) {
            val formatted = SimpleDateFormat("dd/MM HH:mm", Locale.FRANCE).format(Date(nextAt))
            "Aucun match en cours — prochain : ${schedule.nextLabel} le $formatted"
        } else {
            "Aucun match trouvé au calendrier — prochaine vérification dans ${formatDuration(frequencySeconds)}"
        }
    }

    private suspend fun runSyncWithWakeLock() {
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "ProLeagueSync::SyncWakeLock",
        )
        wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS)
        try {
            updateNotification("Synchronisation en cours…")
            // Un SyncRunner neuf à chaque cycle : entre deux cycles espacés,
            // une connexion HTTP réutilisée depuis un client partagé serait déjà périmée
            // côté serveur/réseau mobile, provoquant un "connection closed" à la reprise.
            val result = SyncRunner().runOnce()
            prefs.addHistoryEntry(
                SyncHistoryEntry(
                    timestamp = System.currentTimeMillis(),
                    success = result.success,
                    updatedCount = result.updatedCount,
                    error = result.errorMessage,
                    manual = false,
                    attempts = result.attempts,
                ),
            )

            updateNotification(
                if (result.success) {
                    "Dernière sync réussie — ${result.updatedCount} match(s) mis à jour"
                } else {
                    "Échec de la dernière sync : ${result.errorMessage}"
                },
            )
        } finally {
            if (wakeLock.isHeld) wakeLock.release()
        }
    }

    private fun buildNotification(text: String): Notification {
        val openAppIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, ProLeagueSyncApp.CHANNEL_ID)
            .setContentTitle("Sync Pro League")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notification)
            .setOngoing(true)
            .setContentIntent(openAppIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(text))
    }

    companion object {
        private const val NOTIFICATION_ID = 1
        // Doit couvrir le pire cas du retry de SyncRunner (3 tentatives par endpoint, chacune
        // pouvant atteindre ~25s de timeout, espacées de 3s) pour que le CPU ne se rendorme pas
        // en plein milieu d'une séquence de retry.
        private const val WAKE_LOCK_TIMEOUT_MS = 2 * 60 * 1000L

        fun start(context: Context) {
            val intent = Intent(context, SyncForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SyncForegroundService::class.java))
        }
    }
}
