package app.gotcha.android.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.Looper
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Observes device network availability for offline UX and reconnection celebrations.
 *
 * UI-27: tracks every available network (not just `activeNetwork`, which is briefly null during a
 * Wi-Fi ↔ LTE handover), requires NET_CAPABILITY_VALIDATED, and debounces the online → offline
 * transition by [OFFLINE_DEBOUNCE_MS] so a handover never flashes the offline banner.
 * Going back online is reported immediately.
 */
class ConnectivityObserver(context: Context) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private val main = Handler(Looper.getMainLooper())

    /** Network → validated internet. */
    private val networks = ConcurrentHashMap<Network, Boolean>()

    private val _isOnline = MutableStateFlow(currentOnline())
    val isOnline: StateFlow<Boolean> = _isOnline.asStateFlow()

    private val goOffline = Runnable {
        if (!anyValidated()) _isOnline.value = false
    }

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val caps = connectivityManager.getNetworkCapabilities(network)
            networks[network] = caps?.isValidatedInternet() == true
            refreshOnline()
        }

        override fun onLost(network: Network) {
            networks.remove(network)
            refreshOnline()
        }

        override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
            networks[network] = caps.isValidatedInternet()
            refreshOnline()
        }
    }

    init {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        connectivityManager.registerNetworkCallback(request, callback)
        refreshOnline()
    }

    /** PS-11: last time our own API answered (any HTTP status). */
    @Volatile private var lastApiReachableAt = 0L

    /**
     * PS-11: some networks never get NET_CAPABILITY_VALIDATED (VPN apps, filtered/private DNS blocking
     * Google's probe) while the Gotcha API works fine. A real API response within [API_TRUST_MS] counts as
     * online as long as some INTERNET network exists. Called from the OkHttp interceptor.
     */
    fun reportApiReachable() {
        lastApiReachableAt = System.currentTimeMillis()
        main.post { refreshOnline() }
    }

    private fun apiRecentlyReachable(): Boolean =
        networks.isNotEmpty() && System.currentTimeMillis() - lastApiReachableAt < API_TRUST_MS

    private fun anyValidated(): Boolean = networks.values.any { it } || currentOnline() || apiRecentlyReachable()

    private fun refreshOnline() {
        if (anyValidated()) {
            main.removeCallbacks(goOffline)
            _isOnline.value = true
        } else if (_isOnline.value) {
            main.removeCallbacks(goOffline)
            main.postDelayed(goOffline, OFFLINE_DEBOUNCE_MS)
        }
    }

    fun currentOnline(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val caps = connectivityManager.getNetworkCapabilities(network) ?: return false
        return caps.isValidatedInternet()
    }

    private fun NetworkCapabilities.isValidatedInternet(): Boolean =
        hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

    private companion object {
        const val OFFLINE_DEBOUNCE_MS = 2_000L
        const val API_TRUST_MS = 60_000L
    }
}
