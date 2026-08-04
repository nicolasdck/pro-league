package com.decook.proleaguesync.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.decook.proleaguesync.prefs.DEFAULT_FREQUENCY_SECONDS
import com.decook.proleaguesync.prefs.SyncHistoryEntry
import com.decook.proleaguesync.prefs.SyncPreferences
import com.decook.proleaguesync.sync.SyncForegroundService
import com.decook.proleaguesync.sync.SyncRunner
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SyncViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = SyncPreferences(application)

    val enabled: StateFlow<Boolean> = prefs.enabledFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    val history: StateFlow<List<SyncHistoryEntry>> = prefs.historyFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val lastCheckAt: StateFlow<Long?> = prefs.lastCheckAtFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val frequencySeconds: StateFlow<Int> = prefs.frequencySecondsFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, DEFAULT_FREQUENCY_SECONDS)

    private val _isSyncingNow = MutableStateFlow(false)
    val isSyncingNow: StateFlow<Boolean> = _isSyncingNow.asStateFlow()

    fun setEnabled(value: Boolean) {
        viewModelScope.launch {
            prefs.setEnabled(value)
            if (value) {
                SyncForegroundService.start(getApplication())
            } else {
                SyncForegroundService.stop(getApplication())
            }
        }
    }

    fun setFrequencySeconds(seconds: Int) {
        viewModelScope.launch {
            prefs.setFrequencySeconds(seconds)
        }
    }

    fun clearHistory() {
        viewModelScope.launch {
            prefs.clearHistory()
        }
    }

    fun syncNow() {
        if (_isSyncingNow.value) return
        viewModelScope.launch {
            _isSyncingNow.value = true
            try {
                // 1 seule tentative par endpoint pour la synchro manuelle : pas de retry
                // automatique, l'utilisateur reclique lui-même si besoin.
                val result = withContext(Dispatchers.IO) { SyncRunner().runOnce(maxAttempts = 1) }
                prefs.addHistoryEntry(
                    SyncHistoryEntry(
                        timestamp = System.currentTimeMillis(),
                        success = result.success,
                        updatedCount = result.updatedCount,
                        error = result.errorMessage,
                        manual = true,
                        attempts = result.attempts,
                    ),
                )
            } finally {
                _isSyncingNow.value = false
            }
        }
    }
}
