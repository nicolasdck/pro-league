package com.decook.proleaguesync.ui

import android.content.Context
import android.content.Intent
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.decook.proleaguesync.prefs.SyncHistoryEntry
import com.decook.proleaguesync.sync.formatDuration
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

// En secondes. En dessous de 1 min, chaque cycle appelle quand même le calendrier Supabase
// (3 lectures bon marché) — voir SyncForegroundService — mais si un match est en direct,
// footmercato est re-scrapé à cette même fréquence : rester poli avec un tiers plutôt qu'agressif
// est une bonne raison de ne pas descendre sous 30s en usage prolongé.
private val FREQUENCY_OPTIONS_SECONDS = listOf(30, 60, 180, 300, 600, 900, 1200, 1800)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: SyncViewModel, onOpenSchedule: () -> Unit) {
    val enabled by viewModel.enabled.collectAsState()
    val history by viewModel.history.collectAsState()
    val isSyncingNow by viewModel.isSyncingNow.collectAsState()
    val lastCheckAt by viewModel.lastCheckAt.collectAsState()
    val frequencySeconds by viewModel.frequencySeconds.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sync Pro League") },
                actions = { TextButton(onClick = onOpenSchedule) { Text("Calendrier") } },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    "Cette app ne fait qu'appeler les endpoints de mise à jour des scores de " +
                        "l'app web Pro League, en arrière-plan — elle ne contient aucune clé " +
                        "sensible. Elle lit le calendrier des matchs (public, lecture seule) " +
                        "pour savoir automatiquement quand synchroniser, sans plage horaire à " +
                        "configurer à la main.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Synchronisation active", style = MaterialTheme.typography.titleMedium)
                    Switch(checked = enabled, onCheckedChange = { viewModel.setEnabled(it) })
                }
            }

            if (enabled) {
                item { BatteryOptimizationRow() }

                item {
                    FrequencyDropdown(
                        selected = frequencySeconds,
                        onSelect = { viewModel.setFrequencySeconds(it) },
                    )
                }

                item { SyncStatusRow(lastCheckAt = lastCheckAt, frequencySeconds = frequencySeconds) }

                item {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Button(onClick = { viewModel.syncNow() }, enabled = !isSyncingNow) {
                            Text(if (isSyncingNow) "Synchronisation…" else "Sync maintenant")
                        }
                        if (isSyncingNow) {
                            Spacer(modifier = Modifier.width(12.dp))
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        }
                    }
                }
            }

            item {
                HistoryHeader(hasEntries = history.isNotEmpty(), onClear = { viewModel.clearHistory() })
            }

            if (history.isEmpty()) {
                item { Text("Aucune synchro effectuée pour l'instant.") }
            }

            items(history) { entry ->
                HistoryRow(entry)
            }
        }
    }
}

@Composable
private fun HistoryHeader(hasEntries: Boolean, onClear: () -> Unit) {
    var showConfirm by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("Historique des synchros", style = MaterialTheme.typography.titleMedium)
        if (hasEntries) {
            TextButton(onClick = { showConfirm = true }) { Text("Effacer") }
        }
    }

    if (showConfirm) {
        AlertDialog(
            onDismissRequest = { showConfirm = false },
            title = { Text("Effacer l'historique ?") },
            text = { Text("Cette action est irréversible.") },
            confirmButton = {
                TextButton(onClick = {
                    showConfirm = false
                    onClear()
                }) { Text("Effacer") }
            },
            dismissButton = {
                TextButton(onClick = { showConfirm = false }) { Text("Annuler") }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FrequencyDropdown(selected: Int, onSelect: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        TextField(
            value = formatDuration(selected),
            onValueChange = {},
            readOnly = true,
            label = { Text("Fréquence de vérification") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            FREQUENCY_OPTIONS_SECONDS.forEach { seconds ->
                DropdownMenuItem(
                    text = { Text(formatDuration(seconds)) },
                    onClick = {
                        onSelect(seconds)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun SyncStatusRow(lastCheckAt: Long?, frequencySeconds: Int) {
    var nowTick by remember { mutableStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            nowTick = System.currentTimeMillis()
        }
    }

    if (lastCheckAt == null) {
        Text("Aucune vérification effectuée pour l'instant.", style = MaterialTheme.typography.bodySmall)
        return
    }

    val elapsedSeconds = (nowTick - lastCheckAt) / 1000
    val intervalSeconds = frequencySeconds.toLong()
    val remainingSeconds = (intervalSeconds - elapsedSeconds).coerceAtLeast(0)
    val lastFormatted = SimpleDateFormat("HH:mm:ss", Locale.FRANCE).format(Date(lastCheckAt))

    Column {
        Text(
            "Dernière vérification : $lastFormatted (il y a ${elapsedSeconds}s)",
            style = MaterialTheme.typography.bodySmall,
        )
        Text("Prochaine vérification dans ${remainingSeconds}s", style = MaterialTheme.typography.bodySmall)
        if (elapsedSeconds > intervalSeconds * 2) {
            Text(
                "Le service semble arrêté — désactivez puis réactivez la synchro.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
            )
        }
    }
}

@Composable
private fun HistoryRow(entry: SyncHistoryEntry) {
    Card {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                val formatted = SimpleDateFormat("dd/MM HH:mm:ss", Locale.FRANCE)
                    .format(Date(entry.timestamp))
                Text("$formatted · ${if (entry.manual) "manuel" else "auto"}")
                Text(
                    if (entry.success) {
                        "${entry.updatedCount} match(s) mis à jour · après ${entry.attempts} tentative(s)"
                    } else {
                        "Échec après ${entry.attempts} tentative(s) : ${entry.error}"
                    },
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(if (entry.success) "OK" else "X")
        }
    }
}

@Composable
private fun BatteryOptimizationRow() {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    var isExempted by remember { mutableStateOf(isIgnoringBatteryOptimizations(context)) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                isExempted = isIgnoringBatteryOptimizations(context)
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Column {
        Button(onClick = {
            if (isExempted) {
                // Android ne permet pas de révoquer cette exemption programmatiquement :
                // on ouvre l'écran système où l'utilisateur peut le faire lui-même.
                context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } else {
                requestBatteryOptimizationExemption(context)
            }
        }) {
            Text(
                if (isExempted) {
                    "Réactiver l'optimisation de batterie"
                } else {
                    "Désactiver l'optimisation de batterie"
                },
            )
        }
    }
}

private fun isIgnoringBatteryOptimizations(context: Context): Boolean {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    return powerManager.isIgnoringBatteryOptimizations(context.packageName)
}

private fun requestBatteryOptimizationExemption(context: Context) {
    val intent = Intent(
        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        "package:${context.packageName}".toUri(),
    )
    context.startActivity(intent)
}
