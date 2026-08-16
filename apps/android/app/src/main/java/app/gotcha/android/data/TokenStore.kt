package app.gotcha.android.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore("gotcha_session")

class TokenStore(private val context: Context) {
    private val accessKey = stringPreferencesKey("access_token")
    private val refreshKey = stringPreferencesKey("refresh_token")
    private val userJsonKey = stringPreferencesKey("user_json")
    private val isAdminKey = stringPreferencesKey("is_admin")
    private val onboardingKey = stringPreferencesKey("onboarding_done")

    val accessTokenFlow: Flow<String?> = context.dataStore.data.map { it[accessKey] }

    suspend fun accessToken(): String? = context.dataStore.data.first()[accessKey]
    suspend fun refreshToken(): String? = context.dataStore.data.first()[refreshKey]
    suspend fun userJson(): String? = context.dataStore.data.first()[userJsonKey]
    suspend fun isAdmin(): Boolean = context.dataStore.data.first()[isAdminKey] == "true"
    suspend fun onboardingDone(): Boolean = context.dataStore.data.first()[onboardingKey] == "true"

    suspend fun saveSession(
        access: String,
        refresh: String,
        userJson: String,
        isAdmin: Boolean,
    ) {
        context.dataStore.edit {
            it[accessKey] = access
            it[refreshKey] = refresh
            it[userJsonKey] = userJson
            it[isAdminKey] = if (isAdmin) "true" else "false"
        }
    }

    suspend fun clear() {
        context.dataStore.edit {
            it.remove(accessKey)
            it.remove(refreshKey)
            it.remove(userJsonKey)
            it.remove(isAdminKey)
        }
    }

    suspend fun setOnboardingDone() {
        context.dataStore.edit { it[onboardingKey] = "true" }
    }
}
