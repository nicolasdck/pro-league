import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Reads android-sync/app/secrets.properties (gitignored). Only holds the
// Supabase *anon* key — public/read-only by RLS (see supabase/schema.sql),
// the same key already shipped in the deployed web app's JS bundle. Used
// solely to read the match schedule so the app can figure out its own sync
// windows automatically (ScheduleChecker.kt) instead of the user
// maintaining them by hand. Copy secrets.properties.example to start.
val secrets = Properties().apply {
    val secretsFile = file("secrets.properties")
    if (secretsFile.exists()) {
        secretsFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.decook.proleaguesync"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.decook.proleaguesync"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"

        // Public Vercel deployment of the web app — not a secret, it's the
        // exact same base URL the browser itself calls. No sensitive API
        // key lives in this app: api/live-scores.ts and
        // api/live-scores-euro.ts do all the fetching/scraping and hold the
        // real credentials (Supabase service role) server-side. This app's
        // only job is to keep pinging those two public endpoints on a
        // schedule, from a device that's actually reachable in the
        // background — see README.md for why.
        buildConfigField("String", "BASE_URL", "\"https://pro-league-delta.vercel.app\"")
        buildConfigField("String", "SUPABASE_URL", "\"${secrets.getProperty("SUPABASE_URL", "")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${secrets.getProperty("SUPABASE_ANON_KEY", "")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation(platform("androidx.compose:compose-bom:2024.09.03"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    testImplementation("junit:junit:4.13.2")
}
