package com.decook.proleaguesync.sync

data class SyncResult(
    val success: Boolean,
    val updatedCount: Int = 0,
    val errorMessage: String? = null,
    val attempts: Int = 1,
)
