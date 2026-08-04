package com.decook.proleaguesync.sync

import com.decook.proleaguesync.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import java.util.concurrent.TimeUnit

// Mirrors src/lib/liveWindow.ts in the main repo — kept in sync by hand
// (Kotlin vs TypeScript, no shared source of truth possible here). A match
// can kick off a few minutes late and regularly runs past 90+ET with
// stoppage time, hence the generous window on both sides. Also used by
// ui/ScheduleViewModel.kt to correlate a match with the sync attempts that
// happened while it was live.
const val LIVE_WINDOW_BEFORE_MS = 15 * 60 * 1000L
const val LIVE_WINDOW_AFTER_MS = 130 * 60 * 1000L

private val LIVE_STATUSES = setOf("1H", "HT", "2H", "ET", "P")
private val FINISHED_STATUSES = setOf("FT", "AET", "PEN")

private val EUROPEAN_COMPETITION_LABELS = mapOf(
    "CL" to "Ligue des Champions",
    "EL" to "Europa League",
    "ECL" to "Conference League",
)

data class ScheduleStatus(
    val isLive: Boolean,
    val nextLabel: String?,
    val nextAtMillis: Long?,
)

/** Un "match" du calendrier, tous statuts confondus (pas seulement ceux à venir). */
data class MatchSchedule(
    val key: String, // id (championnat) ou match_url (Coupe/Europe) — identifie le match de façon stable
    val competition: String,
    val label: String, // journée/tour/phase
    val status: String,
    val eventDateMillis: Long?,
)

private data class LiveCheckSource(val table: String, val extraFilter: String, val labelColumn: String)

// select=...&label:<column> aliases each table's own name for "round/phase"
// to the same "label" key, so the three responses can be parsed identically
// without per-table branching.
private val LIVE_CHECK_SOURCES = listOf(
    LiveCheckSource(table = "fixtures", extraFilter = "", labelColumn = "round"),
    LiveCheckSource(table = "cup_fixtures", extraFilter = "&match_url=not.is.null", labelColumn = "phase"),
    LiveCheckSource(table = "european_fixtures", extraFilter = "&match_url=not.is.null", labelColumn = "phase"),
)

/**
 * Lit directement le calendrier public (lecture seule, clé anon — RLS n'autorise que le SELECT,
 * jamais l'écriture, voir supabase/schema.sql). Deux usages :
 *  - [checkNow] : requête légère (5 lignes/table, non terminées seulement), appelée à chaque
 *    cycle du service pour savoir s'il vaut la peine de synchroniser maintenant.
 *  - [fetchFullSchedule] : requête plus large (tous statuts, y compris terminés), pour l'écran
 *    "Calendrier" — voir ui/ScheduleScreen.kt.
 * Une source indisponible ou une erreur de parsing n'empêche pas de regarder les autres — mieux
 * vaut une détection partielle qu'aucune.
 */
class ScheduleChecker {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .protocols(listOf(Protocol.HTTP_1_1))
        .build()

    fun checkNow(): ScheduleStatus {
        val now = System.currentTimeMillis()
        var isLive = false
        var nextAtMillis: Long? = null
        var nextLabel: String? = null

        for (source in LIVE_CHECK_SOURCES) {
            val rows = try {
                fetchRows(source)
            } catch (e: Exception) {
                continue
            }

            for (i in 0 until rows.length()) {
                val row = rows.optJSONObject(i) ?: continue
                val status = row.optString("status", "NS")
                if (status in FINISHED_STATUSES) continue
                if (status in LIVE_STATUSES) {
                    isLive = true
                    continue
                }

                val kickoffMillis = parseIsoToMillis(row.optString("event_date")) ?: continue
                if (now in (kickoffMillis - LIVE_WINDOW_BEFORE_MS)..(kickoffMillis + LIVE_WINDOW_AFTER_MS)) {
                    isLive = true
                }
                if (kickoffMillis >= now && (nextAtMillis == null || kickoffMillis < nextAtMillis)) {
                    nextAtMillis = kickoffMillis
                    nextLabel = row.optString("label", source.table)
                }
            }
        }

        return ScheduleStatus(isLive = isLive, nextLabel = nextLabel, nextAtMillis = nextAtMillis)
    }

    /** Calendrier complet (tous statuts), trié du plus récent au plus ancien. */
    fun fetchFullSchedule(limitPerTable: Int = 20): List<MatchSchedule> {
        val results = mutableListOf<MatchSchedule>()

        results += fetchTable(
            table = "fixtures",
            select = "id,round,status,event_date",
            extraFilter = "",
            limit = limitPerTable,
        ) { row ->
            MatchSchedule(
                key = row.optLong("id", 0L).toString(),
                competition = "Championnat",
                label = row.optString("round", "Championnat"),
                status = row.optString("status", "NS"),
                eventDateMillis = parseIsoToMillis(row.optString("event_date")),
            )
        }

        results += fetchTable(
            table = "cup_fixtures",
            select = "match_url,phase,status,event_date",
            extraFilter = "&match_url=not.is.null",
            limit = limitPerTable,
        ) { row ->
            MatchSchedule(
                key = row.optString("match_url"),
                competition = "Coupe de Belgique",
                label = row.optString("phase", "Coupe"),
                status = row.optString("status", "NS"),
                eventDateMillis = parseIsoToMillis(row.optString("event_date")),
            )
        }

        results += fetchTable(
            table = "european_fixtures",
            select = "match_url,phase,status,event_date,competition",
            extraFilter = "&match_url=not.is.null",
            limit = limitPerTable,
        ) { row ->
            val code = row.optString("competition", "")
            MatchSchedule(
                key = row.optString("match_url"),
                competition = EUROPEAN_COMPETITION_LABELS[code] ?: "Europe",
                label = row.optString("phase", "Europe"),
                status = row.optString("status", "NS"),
                eventDateMillis = parseIsoToMillis(row.optString("event_date")),
            )
        }

        return results.sortedByDescending { it.eventDateMillis ?: 0L }
    }

    private fun fetchTable(
        table: String,
        select: String,
        extraFilter: String,
        limit: Int,
        mapRow: (JSONObject) -> MatchSchedule,
    ): List<MatchSchedule> {
        val url = "${BuildConfig.SUPABASE_URL}/rest/v1/$table" +
            "?select=$select$extraFilter&order=event_date.desc.nullslast&limit=$limit"

        val request = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .get()
            .build()

        return try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string() ?: ""
                if (!response.isSuccessful) return emptyList()
                val array = JSONArray(body)
                (0 until array.length()).mapNotNull { i -> array.optJSONObject(i)?.let(mapRow) }
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun fetchRows(source: LiveCheckSource): JSONArray {
        val select = "select=event_date,status,label:${source.labelColumn}"
        val url = "${BuildConfig.SUPABASE_URL}/rest/v1/${source.table}" +
            "?$select&status=neq.FT${source.extraFilter}&order=event_date.asc&limit=5"

        val request = Request.Builder()
            .url(url)
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (!response.isSuccessful) throw IOException("Erreur ${response.code} sur ${source.table}: $body")
            return JSONArray(body)
        }
    }
}

private fun parseIsoToMillis(raw: String?): Long? {
    if (raw.isNullOrBlank()) return null
    return try {
        OffsetDateTime.parse(raw).toInstant().toEpochMilli()
    } catch (e: DateTimeParseException) {
        null
    }
}
