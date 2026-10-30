package app.gotcha.android.data.billing

import app.gotcha.android.data.billing.PlayPurchaseLogic.Launch
import app.gotcha.android.data.billing.PlayPurchaseLogic.Verify
import app.gotcha.android.data.model.ImportCreditEntitlement
import com.android.billingclient.api.BillingClient.BillingResponseCode as C
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayPurchaseLogicTest {
    private fun outcome(code: Int) = PlayPurchaseLogic.launchOutcome(code, C.OK, C.ITEM_ALREADY_OWNED, C.USER_CANCELED)

    @Test fun purchaseFlowResponseCodes() {
        assertEquals(Launch.PURCHASED, outcome(C.OK))
        assertEquals(Launch.ALREADY_OWNED, outcome(C.ITEM_ALREADY_OWNED))
        assertEquals(Launch.CANCELLED, outcome(C.USER_CANCELED))
        assertEquals(Launch.FAILED, outcome(C.SERVICE_UNAVAILABLE))
        assertEquals(Launch.FAILED, outcome(C.ERROR))
    }

    @Test fun onlyGrantedUnlocks() {
        assertEquals(Verify.GRANTED, PlayPurchaseLogic.verifyOutcome("granted"))
        assertEquals(Verify.PENDING, PlayPurchaseLogic.verifyOutcome("pending"))
        assertEquals(Verify.NOT_CONFIRMED, PlayPurchaseLogic.verifyOutcome("expired"))
        assertEquals(Verify.NOT_CONFIRMED, PlayPurchaseLogic.verifyOutcome(""))
    }

    @Test fun resyncSkipsOwnedAcknowledgedBooks() {
        assertFalse(PlayPurchaseLogic.shouldResync(purchased = true, acknowledged = true, kind = "catalog_book"))
        assertFalse(PlayPurchaseLogic.shouldResync(true, true, "subscription"))
        assertTrue(PlayPurchaseLogic.shouldResync(true, false, "catalog_book"))
        assertTrue(PlayPurchaseLogic.shouldResync(true, true, "import_tier")) // owned consumable = never consumed
        assertFalse(PlayPurchaseLogic.shouldResync(false, false, "catalog_book")) // pending
        assertFalse(PlayPurchaseLogic.shouldResync(true, false, null)) // unknown SKU
    }

    @Test fun resumeSyncDebounced() {
        assertTrue(PlayPurchaseLogic.syncDue(0, 1_000, false))
        assertFalse(PlayPurchaseLogic.syncDue(1_000, 1_000 + 60_000, false))
        assertTrue(PlayPurchaseLogic.syncDue(1_000, 1_000 + PlayPurchaseLogic.SYNC_DEBOUNCE_MS, false))
        assertTrue(PlayPurchaseLogic.syncDue(1_000, 1_001, true))
    }

    private fun credit(tier: String, max: Int?, used: Boolean = false, source: String = "google_play") =
        ImportCreditEntitlement("p-$tier", source, used, tier, max)

    @Test fun creditReuse() {
        val credits = listOf(credit("t10", 10), credit("t50", 50, used = true), credit("web", 500, source = "atmos"))
        assertEquals("p-t10", PlayPurchaseLogic.reusableCredit(credits, "t10", 10)?.paymentId)
        assertEquals("p-t10", PlayPurchaseLogic.reusableCredit(credits, "t5", 5)?.paymentId)
        assertNull(PlayPurchaseLogic.reusableCredit(credits, "t50", 50))
        // n-2: the unlimited (100+) credit covers smaller tiers and the unlimited tier
        val big = listOf(credit("t100", null))
        assertEquals("p-t100", PlayPurchaseLogic.reusableCredit(big, "t10", 10)?.paymentId)
        assertEquals("p-t100", PlayPurchaseLogic.reusableCredit(big, "tX", null)?.paymentId)
        assertNull(PlayPurchaseLogic.reusableCredit(listOf(credit("t10", 10)), "tX", null))
    }

    @Test fun basePlanOfferPicked() {
        val offers = listOf("trial" to "o1", "base" to null)
        assertEquals("base", PlayPurchaseLogic.baseOffer(offers) { it.second }?.first)
        assertEquals("trial", PlayPurchaseLogic.baseOffer(listOf("trial" to "o1")) { it.second }?.first)
        assertNull(PlayPurchaseLogic.baseOffer(emptyList<Pair<String, String?>>()) { it.second })
    }
}
