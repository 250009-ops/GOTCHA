package app.gotcha.android

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
}
