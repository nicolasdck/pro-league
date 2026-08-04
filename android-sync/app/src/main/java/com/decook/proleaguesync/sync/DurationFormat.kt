package com.decook.proleaguesync.sync

/** "30s", "1 min", "3 min"… — utilisé par le service (notification) et l'écran de réglages. */
fun formatDuration(seconds: Int): String {
    return if (seconds < 60) "${seconds}s" else "${seconds / 60} min"
}
