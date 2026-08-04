package com.decook.proleaguesync

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.decook.proleaguesync.ui.ScheduleScreen
import com.decook.proleaguesync.ui.ScheduleViewModel
import com.decook.proleaguesync.ui.SettingsScreen
import com.decook.proleaguesync.ui.SyncViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: SyncViewModel by viewModels()
    private val scheduleViewModel: ScheduleViewModel by viewModels()

    private val requestNotificationPermission =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestNotificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        setContent {
            var showSchedule by remember { mutableStateOf(false) }
            if (showSchedule) {
                ScheduleScreen(viewModel = scheduleViewModel, onBack = { showSchedule = false })
            } else {
                SettingsScreen(viewModel = viewModel, onOpenSchedule = { showSchedule = true })
            }
        }
    }
}
