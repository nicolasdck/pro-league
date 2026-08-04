package com.decook.proleaguesync.prefs

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

private val Context.dataStore by preferencesDataStore(name = "sync_prefs")

private const val MAX_HISTORY_ENTRIES = 30
const val DEFAULT_FREQUENCY_SECONDS = 180

data class SyncHistoryEntry(
    val timestamp: Long,
    val success: Boolean,
    val updatedCount: Int,
    val error: String?,
    val manual: Boolean,
    val attempts: Int = 1,
)

class SyncPreferences(private val context: Context) {

    private object Keys {
        val ENABLED = booleanPreferencesKey("sync_enabled")
        val HISTORY = stringPreferencesKey("sync_history")
        val LAST_CHECK_AT = longPreferencesKey("last_check_at")
        // Nouvelle clé (pas une réutilisation de l'ancienne "frequency_minutes") : une valeur
        // déjà stockée en minutes (ex: 3) serait sinon réinterprétée à tort comme des secondes
        // pour les installs existantes.
        val FREQUENCY_SECONDS = intPreferencesKey("frequency_seconds")
    }

    val enabledFlow: Flow<Boolean> = context.dataStore.data.map { it[Keys.ENABLED] ?: false }

    // Le plus récent en premier.
    val historyFlow: Flow<List<SyncHistoryEntry>> = context.dataStore.data.map {
        deserializeHistory(it[Keys.HISTORY] ?: "")
    }

    val lastCheckAtFlow: Flow<Long?> = context.dataStore.data.map { it[Keys.LAST_CHECK_AT] }

    val frequencySecondsFlow: Flow<Int> =
        context.dataStore.data.map { it[Keys.FREQUENCY_SECONDS] ?: DEFAULT_FREQUENCY_SECONDS }

    suspend fun isEnabled(): Boolean = enabledFlow.first()

    suspend fun setEnabled(enabled: Boolean) {
        context.dataStore.edit { it[Keys.ENABLED] = enabled }
    }

    suspend fun addHistoryEntry(entry: SyncHistoryEntry) {
        context.dataStore.edit { prefs ->
            val current = deserializeHistory(prefs[Keys.HISTORY] ?: "")
            val updated = (listOf(entry) + current).take(MAX_HISTORY_ENTRIES)
            prefs[Keys.HISTORY] = serializeHistory(updated)
        }
    }

    suspend fun clearHistory() {
        context.dataStore.edit { it[Keys.HISTORY] = "" }
    }

    suspend fun setLastCheckAt(timestamp: Long) {
        context.dataStore.edit { it[Keys.LAST_CHECK_AT] = timestamp }
    }

    suspend fun getFrequencySeconds(): Int = frequencySecondsFlow.first()

    suspend fun setFrequencySeconds(seconds: Int) {
        context.dataStore.edit { it[Keys.FREQUENCY_SECONDS] = seconds }
    }
}

private fun serializeHistory(entries: List<SyncHistoryEntry>): String {
    val array = JSONArray()
    entries.forEach { e ->
        val obj = JSONObject()
        obj.put("timestamp", e.timestamp)
        obj.put("success", e.success)
        obj.put("updatedCount", e.updatedCount)
        obj.put("error", e.error ?: JSONObject.NULL)
        obj.put("manual", e.manual)
        obj.put("attempts", e.attempts)
        array.put(obj)
    }
    return array.toString()
}

// Chaque entrée est parsée indépendamment : une entrée corrompue est ignorée plutôt que de
// faire échouer (et vider) tout l'historique.
private fun deserializeHistory(raw: String): List<SyncHistoryEntry> {
    if (raw.isBlank()) return emptyList()
    val array = try {
        JSONArray(raw)
    } catch (e: Exception) {
        return emptyList()
    }
    return (0 until array.length()).mapNotNull { i ->
        try {
            val obj = array.getJSONObject(i)
            SyncHistoryEntry(
                timestamp = obj.getLong("timestamp"),
                success = obj.getBoolean("success"),
                updatedCount = obj.optInt("updatedCount", 0),
                error = if (obj.isNull("error")) null else obj.optString("error"),
                manual = obj.optBoolean("manual", false),
                attempts = obj.optInt("attempts", 1),
            )
        } catch (e: Exception) {
            null
        }
    }
}
