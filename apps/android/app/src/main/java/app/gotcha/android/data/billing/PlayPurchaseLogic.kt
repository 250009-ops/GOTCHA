package app.gotcha.android.data.billing

import app.gotcha.android.data.model.ImportCreditEntitlement

/**
 * Pure decision logic of the Play purchase flows, kept free of BillingClient types so it is unit-tested on
 * the JVM (PlayPurchaseLogicTest). PlayBilling maps Play objects onto these inputs.
 */
object PlayPurchaseLogic {
    const val KIND_IMPORT = "import_tier"
    const val SYNC_DEBOUNCE_MS = 5 * 60_000L

    /** Outcome of onPurchasesUpdated / launchBillingFlow response codes. */
    enum class Launch { PURCHASED, ALREADY_OWNED, CANCELLED, FAILED }

    fun launchOutcome(code: Int, ok: Int, owned: Int, cancelled: Int): Launch = when (code) {
        ok -> Launch.PURCHASED
        owned -> Launch.ALREADY_OWNED
        cancelled -> Launch.CANCELLED
        else -> Launch.FAILED
    }

    /** Server verify status → what the UI may do. Only "granted" unlocks anything. */
    enum class Verify { GRANTED, PENDING, NOT_CONFIRMED }

    fun verifyOutcome(status: String): Verify = when (status) {
        "granted" -> Verify.GRANTED
        "pending" -> Verify.PENDING
        else -> Verify.NOT_CONFIRMED
    }

    /**
     * N-M4: which owned purchases to re-send to the server on login/resume. Unacknowledged purchases always;
     * acknowledged ones only if they are owned import consumables (the server never consumed them). Owned,
     * acknowledged books / subscriptions are already granted and are NOT re-verified.
     */
    fun shouldResync(purchased: Boolean, acknowledged: Boolean, kind: String?): Boolean =
        purchased && kind != null && (!acknowledged || kind == KIND_IMPORT)

    fun syncDue(lastSyncMs: Long, nowMs: Long, force: Boolean): Boolean = force || lastSyncMs == 0L || nowMs - lastSyncMs >= SYNC_DEBOUNCE_MS

    /**
     * Unused Play credit covering [tierId] whose tier holds [neededMaxPages] (null = unlimited, the "100+" tier).
     * A credit with maxPages == null is unlimited and covers everything (n-2).
     */
    fun reusableCredit(credits: List<ImportCreditEntitlement>, tierId: String, neededMaxPages: Int?): ImportCreditEntitlement? =
        credits.firstOrNull { c ->
            !c.used && c.source == "google_play" &&
                (c.tierId == tierId || covers(c.maxPages, neededMaxPages))
        }

    private fun covers(have: Int?, need: Int?): Boolean = when {
        have == null -> true // unlimited tier
        need == null -> false // need unlimited, have a capped credit
        else -> have >= need
    }

    /** Base-plan offer = the offer without an offerId; fall back to the first offer. */
    fun <T> baseOffer(offers: List<T>, offerId: (T) -> String?): T? = offers.firstOrNull { offerId(it) == null } ?: offers.firstOrNull()
}
