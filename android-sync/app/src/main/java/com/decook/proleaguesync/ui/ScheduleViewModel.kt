package com.decook.proleaguesync.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.decook.proleaguesync.prefs.SyncHistoryEntry
import com.decook.proleaguesync.prefs.SyncPreferences
import com.decook.proleaguesync.sync.LIVE_WINDOW_AFTER_MS
import com.decook.proleaguesync.sync.LIVE_WINDOW_BEFORE_MS
import com.decook.proleaguesync.sync.MatchSchedule
import com.decook.proleaguesync.sync.ScheduleChecker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

data class ScheduleUiState(
    val isLoading: Boolean = false,
    val matches: List<MatchSchedule> = emptyList(),
    val error: String? = null,
)

/**
 * Corrèle chaque match du calendrier avec l'historique de synchro existant
 * (déjà horodaté) en comparant les timestamps à la fenêtre live du match,
 * plutôt que de faire remonter une identité de match précise depuis
 * api/live-scores*.ts — cet historique existe déjà pour tout autre usage
 * (voir SyncPreferences.historyFlow) et cette corrélation ne demande aucun
 * changement côté serveur ni dans SyncRunner.
 */
class ScheduleViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = SyncPreferences(application)

    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    val history: StateFlow<List<SyncHistoryEntry>> = prefs.historyFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    // null = toutes les dates.
    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val matches = withContext(Dispatchers.IO) { ScheduleChecker().fetchFullSchedule() }
                _uiState.value = ScheduleUiState(isLoading = false, matches = matches)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message ?: "Erreur inconnue")
            }
        }
    }

    fun selectDate(date: LocalDate?) {
        _selectedDate.value = date
    }

    fun historyFor(match: MatchSchedule): List<SyncHistoryEntry> {
        val kickoff = match.eventDateMillis ?: return emptyList()
        val windowStart = kickoff - LIVE_WINDOW_BEFORE_MS
        val windowEnd = kickoff + LIVE_WINDOW_AFTER_MS
        return history.value.filter { it.timestamp in windowStart..windowEnd }
    }
}

fun availableDates(matches: List<MatchSchedule>): List<LocalDate> =
    matches.mapNotNull { it.eventDateMillis }
        .map { Instant.ofEpochMilli(it).atZone(ZoneId.systemDefault()).toLocalDate() }
        .distinct()
        .sortedDescending()

fun filterByDate(matches: List<MatchSchedule>, date: LocalDate?): List<MatchSchedule> {
    if (date == null) return matches
    return matches.filter { match ->
        val millis = match.eventDateMillis ?: return@filter false
        Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate() == date
    }
}
