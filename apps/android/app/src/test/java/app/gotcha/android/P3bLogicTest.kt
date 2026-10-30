package app.gotcha.android

import app.gotcha.android.data.api.networkUserMessage
import app.gotcha.android.data.model.ContentItem
import app.gotcha.android.ui.learner.REPORT_REASONS
import app.gotcha.android.ui.learner.isPaid
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** P3b: m1 price display, Atmos flag, report reasons contract. */
class P3bLogicTest {
    @Test fun usdPriceIsNeverShownAsSom() {
        val usdOnly = ContentItem(id = "1", isFree = false, priceUsd = 4.99)
        assertNull(usdOnly.catalogPriceUzs())
        // ...but it is still treated as paid and locked (access is decided server-side).
        assertTrue(usdOnly.needsCatalogPayment())
        assertTrue(usdOnly.isPaid())
    }

    @Test fun uzsPriceIsKept() {
        val item = ContentItem(id = "2", isFree = false, priceUzs = 25_000.0)
        assertEquals(25_000.0, item.catalogPriceUzs()!!, 0.0)
        assertTrue(item.needsCatalogPayment())
        assertFalse(item.copy(accessGranted = true).needsCatalogPayment())
    }

    @Test fun freeItemIsNotPaid() {
        val item = ContentItem(id = "3", isFree = true)
        assertNull(item.catalogPriceUzs())
        assertFalse(item.needsCatalogPayment())
        assertFalse(item.isPaid())
    }

    @Test fun playBuildHasAtmosCheckoutOff() {
        assertFalse(BuildConfig.ATMOS_CHECKOUT_ENABLED)
    }

    @Test fun reportReasonsMatchApiEnum() {
        // services/api prisma enum UserReportReason
        assertEquals(listOf("spam", "harassment", "inappropriate", "underage", "other"), REPORT_REASONS.map { it.first })
    }

    // P3b.1 GOT-QA-P3b-06 / PS-09: `||` let a free item with an access grant count as paid -> "Owned".
    @Test fun freeItemWithAccessGrantIsNeverPaidOrOwned() {
        val freeGranted = ContentItem(id = "4", isFree = true, priceUzs = 25_000.0, accessGranted = true)
        assertFalse(freeGranted.isPaid())
        val freeDenied = ContentItem(id = "5", isFree = true, priceUzs = 25_000.0, accessGranted = false)
        assertFalse(freeDenied.isPaid())
    }

    @Test fun pricedItemIsPaidWhetherOwnedOrNot() {
        assertTrue(ContentItem(id = "6", isFree = false, priceUzs = 25_000.0, accessGranted = true).isPaid())
        assertTrue(ContentItem(id = "7", isFree = false, priceUzs = 25_000.0, accessGranted = false).isPaid())
        assertTrue(ContentItem(id = "8", isFree = null, priceUzs = 25_000.0).isPaid())
        assertFalse(ContentItem(id = "9", isFree = false).isPaid()) // no price -> not paid
    }

    // P3b.1 GOT-QA-P3b-05: one offline wording (same as forgot-password); TLS is not reported as "offline".
    @Test fun offlineAndTlsFailuresHaveDistinctConsistentMessages() {
        val offline = java.net.UnknownHostException("Unable to resolve host \"gotchaa.uz\"").networkUserMessage()
        assertEquals("You're offline. Connect to the internet and try again.", offline)
        val tls = javax.net.ssl.SSLHandshakeException("Trust anchor for certification path not found.").networkUserMessage()
        assertTrue(tls!!.contains("secure connection"))
        assertFalse(tls.contains("offline"))
    }
}
