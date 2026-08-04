package com.decook.proleaguesync.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.decook.proleaguesync.prefs.SyncHistoryEntry
import com.decook.proleaguesync.sync.MatchSchedule
import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

private val DATE_LABEL_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy")

/**
 * Calendrier complet (tous statuts, tri décroissant par date) avec filtre
 * par date, et pour chaque match l'historique de synchro qui a eu lieu
 * pendant sa fenêtre live (voir ScheduleViewModel.historyFor).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(viewModel: ScheduleViewModel, onBack: () -> Unit) {
    val uiState by viewModel.uiState.collectAsState()
    val selectedDate by viewModel.selectedDate.collectAsState()
    var expandedKey by remember { mutableStateOf<String?>(null) }

    val dates = remember(uiState.matches) { availableDates(uiState.matches) }
    val filtered = remember(uiState.matches, selectedDate) { filterByDate(uiState.matches, selectedDate) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calendrier") },
                navigationIcon = { TextButton(onClick = onBack) { Text("Retour") } },
                actions = { TextButton(onClick = { viewModel.refresh() }) { Text("Rafraîchir") } },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize(),
        ) {
            DateFilterRow(dates = dates, selected = selectedDate, onSelect = { viewModel.selectDate(it) })

            if (uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator()
                }
            }

            uiState.error?.let { error ->
                Text(
                    "Erreur de chargement : $error",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp),
                )
            }

            if (!uiState.isLoading && filtered.isEmpty()) {
                Text(
                    "Aucun match trouvé.",
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(16.dp),
                )
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(vertical = 8.dp),
            ) {
                items(filtered) { match ->
                    MatchCard(
                        match = match,
                        isExpanded = expandedKey == match.key,
                        history = if (expandedKey == match.key) viewModel.historyFor(match) else emptyList(),
                        onToggle = { expandedKey = if (expandedKey == match.key) null else match.key },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateFilterRow(dates: List<LocalDate>, selected: LocalDate?, onSelect: (LocalDate?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = Modifier.padding(16.dp),
    ) {
        TextField(
            value = selected?.format(DATE_LABEL_FORMAT) ?: "Toutes les dates",
            onValueChange = {},
            readOnly = true,
            label = { Text("Filtrer par date") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Toutes les dates") },
                onClick = {
                    onSelect(null)
                    expanded = false
                },
            )
            dates.forEach { date ->
                DropdownMenuItem(
                    text = { Text(date.format(DATE_LABEL_FORMAT)) },
                    onClick = {
                        onSelect(date)
                        expanded = false
                    },
                )
            }
        }
    }
}

@Composable
private fun MatchCard(
    match: MatchSchedule,
    isExpanded: Boolean,
    history: List<SyncHistoryEntry>,
    onToggle: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onToggle)
                .padding(12.dp),
        ) {
            Text("${match.competition} · ${match.label}", style = MaterialTheme.typography.titleSmall)
            Text(
                match.eventDateMillis?.let { formatDateTime(it) } ?: "Date à confirmer",
                style = MaterialTheme.typography.bodySmall,
            )
            Text("Statut : ${match.status}", style = MaterialTheme.typography.bodySmall)

            if (isExpanded) {
                Spacer(modifier = Modifier.height(8.dp))
                if (history.isEmpty()) {
                    Text(
                        "Aucune synchro enregistrée pour la fenêtre de ce match.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        history.forEach { entry -> MatchHistoryRow(entry) }
                    }
                }
            }
        }
    }
}

@Composable
private fun MatchHistoryRow(entry: SyncHistoryEntry) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(formatDateTime(entry.timestamp, withSeconds = true), style = MaterialTheme.typography.bodySmall)
        Text(
            if (entry.success) "OK (${entry.updatedCount})" else "Échec : ${entry.error}",
            style = MaterialTheme.typography.bodySmall,
            color = if (entry.success) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
        )
    }
}

private fun formatDateTime(millis: Long, withSeconds: Boolean = false): String {
    val pattern = if (withSeconds) "dd/MM HH:mm:ss" else "dd/MM HH:mm"
    return SimpleDateFormat(pattern, Locale.FRANCE).format(Date(millis))
}
