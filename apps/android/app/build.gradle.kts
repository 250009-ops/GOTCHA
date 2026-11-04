import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use(::load)
}

/**
 * versionCode is derived, never hand-edited: -PversionCode / VERSION_CODE (CI: run number), else the git
 * commit count, else 1. versionName: -PversionName / VERSION_NAME, else 1.0.<code>.
 */
/**
 * Floor above every versionCode already uploaded (closed testing used CI run numbers / git commit counts,
 * all < 1000). Play rejects a versionCode that is not higher than the last upload; raise this if needed.
 */
val VERSION_CODE_FLOOR = 1000
val derivedVersionCode: Int = (
    (project.findProperty("versionCode") as String?) ?: System.getenv("VERSION_CODE")
)?.toIntOrNull() ?: runCatching {
    providers.exec { commandLine("git", "rev-list", "--count", "HEAD") }
        .standardOutput.asText.get().trim().toInt()
}.getOrDefault(1).coerceAtLeast(VERSION_CODE_FLOOR)
val debugApiBaseUrl: String = ((project.findProperty("apiBaseUrl") as String?) ?: System.getenv("GOTCHA_API_BASE_URL")
    ?: "https://gotchaa.uz/api/v1/").trim().let { if (it.endsWith("/")) it else "$it/" }
val debugWebBaseUrl: String = ((project.findProperty("webBaseUrl") as String?) ?: System.getenv("GOTCHA_WEB_BASE_URL")
    ?: "https://gotchaa.uz").trim().trimEnd('/')
val derivedVersionName: String =
    (project.findProperty("versionName") as String?) ?: System.getenv("VERSION_NAME") ?: "1.0.$derivedVersionCode"

android {
    namespace = "app.gotcha.android"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.gotcha.android"
        minSdk = 24
        targetSdk = 36
        versionCode = derivedVersionCode
        versionName = derivedVersionName
        buildConfigField("String", "API_BASE_URL", "\"https://gotchaa.uz/api/v1/\"")
        buildConfigField("String", "WEB_BASE_URL", "\"https://gotchaa.uz\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = localProperties.getProperty("release.storeFile")
            if (!storeFilePath.isNullOrBlank()) {
                storeFile = rootProject.file(storeFilePath)
                storePassword = localProperties.getProperty("release.storePassword")
                keyAlias = localProperties.getProperty("release.keyAlias")
                keyPassword = localProperties.getProperty("release.keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            isDebuggable = false
            // Never ship a debug-signed release: without the upload keystore the release build fails (see below).
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            buildConfigField("String", "API_BASE_URL", "\"https://gotchaa.uz/api/v1/\"")
            buildConfigField("String", "WEB_BASE_URL", "\"https://gotchaa.uz\"")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
            // N10: debug can target a test API: -PapiBaseUrl=http://10.0.2.2:3000/api/v1/ (or GOTCHA_API_BASE_URL).
            // Cleartext is allowed only in debug (src/debug/res/xml/network_security_config.xml).
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
            buildConfigField("String", "WEB_BASE_URL", "\"$debugWebBaseUrl\"")
        }
    }

    compileOptions {
        // Instant.parse is API 26; minSdk is 24. Desugaring is what lint accepts instead of raising minSdk.
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    // All in-app digital purchases (imports, catalog books, Plus) — Play payments policy.
    implementation("com.android.billingclient:billing-ktx:9.1.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.navigation:navigation-compose:2.8.5")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.foundation:foundation")
    implementation("com.google.android.material:material:1.12.0")

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation("junit:junit:4.13.2")

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")

    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("androidx.datastore:datastore-preferences:1.1.1")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    // Backdrop blur for learner bottom nav (frosted glass over scrolling content).
    implementation("dev.chrisbanes.haze:haze:1.1.1")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

// Fail release builds early when the upload keystore is missing (REVIEW: no silent debug signing).
gradle.taskGraph.whenReady {
    val wantsRelease = allTasks.any { it.project == project && it.name.contains("Release") && (it.name.startsWith("assemble") || it.name.startsWith("bundle") || it.name.startsWith("package")) }
    val store = android.signingConfigs.getByName("release").storeFile
    if (wantsRelease && (store == null || !store.exists())) {
        throw GradleException("Release signing keystore missing: set release.storeFile/storePassword/keyAlias/keyPassword in local.properties.")
    }
}
