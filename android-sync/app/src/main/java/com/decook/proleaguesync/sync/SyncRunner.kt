package com.decook.proleaguesync.sync

import com.decook.proleaguesync.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

// Both endpoints already do all the real work server-side (scrape
// footmercato.net, write to Supabase with the service-role key) — see
// api/live-scores.ts and api/live-scores-euro.ts in the main web repo. This
// app holds no API key or Supabase credential of any kind: it's a plain,
// unauthenticated GET, exactly what the browser's own polling already does
// (see src/hooks/useLiveScorePolling*.ts). Its only reason to exist is to
// keep pinging those URLs from a device that's reachable in the background,
// for when nobody has the web app open — see README.md.
private const val LEAGUE_ENDPOINT = "${BuildConfig.BASE_URL}/api/live-scores"

// No query params = self-discovery mode: the endpoint queries Supabase
// itself for whichever Cup/CL/EL/ECL matches are currently in their live
// window, instead of requiring the caller to already know which ones (the
// way the browser, which has the fixtures loaded, targets it).
private const val EURO_ENDPOINT = "${BuildConfig.BASE_URL}/api/live-scores-euro"

// User-Agent d'un vrai navigateur mobile, par précaution — comme pour
// worldcup-sync, un serveur peut traiter un User-Agent par défaut d'OkHttp
// comme un signal de bot.
private const val USER_AGENT =
    "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/128.0.0.0 Mobile Safari/537.36"
private const val DEFAULT_MAX_ATTEMPTS = 3
private const val RETRY_DELAY_MS = 3_000L

class SyncRunner {

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS) // live-scores-euro can sequentially scrape a few pages
        .protocols(listOf(Protocol.HTTP_1_1))
        .build()

    fun runOnce(maxAttempts: Int = DEFAULT_MAX_ATTEMPTS): SyncResult {
        return try {
            val leagueUpdated = pingWithRetry(LEAGUE_ENDPOINT, maxAttempts)
            val euroUpdated = pingWithRetry(EURO_ENDPOINT, maxAttempts)
            SyncResult(success = true, updatedCount = leagueUpdated + euroUpdated, attempts = maxAttempts)
        } catch (e: IOException) {
            SyncResult(success = false, errorMessage = e.message ?: e::class.java.simpleName, attempts = maxAttempts)
        } catch (e: Exception) {
            SyncResult(success = false, errorMessage = e.message ?: e::class.java.simpleName, attempts = maxAttempts)
        }
    }

    private fun pingWithRetry(url: String, maxAttempts: Int): Int {
        var lastError: IOException? = null
        for (attempt in 1..maxAttempts) {
            try {
                return ping(url)
            } catch (e: IOException) {
                lastError = e
                if (attempt < maxAttempts) Thread.sleep(RETRY_DELAY_MS)
            }
        }
        throw lastError ?: IOException("Échec inconnu de $url")
    }

    private fun ping(url: String): Int {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", USER_AGENT)
            .get()
            .build()

        client.newCall(request).execute().use { response ->
            val body = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                throw IOException("Erreur ${response.code}: $body")
            }
            val json = JSONObject(body)
            return json.optJSONArray("updated")?.length() ?: 0
        }
    }
}
