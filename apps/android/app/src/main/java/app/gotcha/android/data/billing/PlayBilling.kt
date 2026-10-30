package app.gotcha.android.data.billing

import android.app.Activity
import android.content.Context
import app.gotcha.android.data.api.GotchaApi
import app.gotcha.android.data.model.EntitlementsResponse
import app.gotcha.android.data.model.ImportQuoteRequest
import app.gotcha.android.data.model.PlayProductsResponse
import app.gotcha.android.data.model.PlayVerifyRequest
import app.gotcha.android.data.model.PlayVerifyResponse
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.android.billingclient.api.queryProductDetails
import com.android.billingclient.api.queryPurchasesAsync
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.lang.ref.WeakReference
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/** User-facing billing failure (message is shown as-is; never mentions other payment routes). */
class PlayBillingException(message: String, val cancelled: Boolean = false, val pending: Boolean = false) : Exception(message)

/**
 * Google Play Billing for every digital purchase in the app (imports, catalog books, Plus).
 * The server is the source of truth: each purchase token is sent to /billing/play/verify, which checks it with
 * the Play Developer API, grants the unlock and acknowledges/consumes it. Purchases made on the web unlock here
 * through GET /billing/entitlements.
 */
private const val PENDING_MSG = "Your payment is pending. The item unlocks as soon as Google Play confirms it."

class PlayBilling(context: Context, private val api: GotchaApi) : PurchasesUpdatedListener {
    private val client: BillingClient = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .build()
    private var activityRef: WeakReference<Activity>? = null
    private var pending: CompletableDeferred<List<Purchase>>? = null
    private val flowLock = Mutex()
    private var catalog: PlayProductsResponse? = null

    /** MainActivity calls this in onResume so the purchase sheet has a host. */
    fun attach(activity: Activity) { activityRef = WeakReference(activity) }

    private suspend fun connect() {
        if (client.isReady) return
        val ok = suspendCancellableCoroutine { cont ->
            client.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (cont.isActive) cont.resume(result.responseCode == BillingClient.BillingResponseCode.OK)
                }
                override fun onBillingServiceDisconnected() {
                    if (cont.isActive) cont.resume(false)
                }
            })
        }
        if (!ok) throw PlayBillingException("Google Play is not available on this device right now.")
    }

    private suspend fun products(): PlayProductsResponse = catalog ?: api.playProducts().also { catalog = it }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        val d = pending ?: return
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> d.complete(purchases.orEmpty())
            BillingClient.BillingResponseCode.USER_CANCELED -> d.completeExceptionally(PlayBillingException("Purchase cancelled.", cancelled = true))
            BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> d.complete(emptyList())
            else -> d.completeExceptionally(PlayBillingException("Purchase failed. Please try again."))
        }
    }

    private suspend fun launch(sku: String, type: String): Purchase? = flowLock.withLock {
        connect()
        val activity = activityRef?.get() ?: throw PlayBillingException("Open Gotcha to complete the purchase.")
        val details: ProductDetails = client.queryProductDetails(
            QueryProductDetailsParams.newBuilder().setProductList(
                listOf(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(type).build()),
            ).build(),
        ).productDetailsList?.firstOrNull() ?: throw PlayBillingException("This item is not available in your country yet.")
        val pp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).apply {
            // m-p2-6: pick the plain base-plan offer (no offerId) explicitly, never a promo/trial offer by position.
            details.subscriptionOfferDetails?.let { offers ->
                (offers.firstOrNull { it.offerId == null } ?: offers.firstOrNull())?.offerToken?.let { setOfferToken(it) }
            }
        }.build()
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(pp))
            .setObfuscatedAccountId(products().obfuscatedAccountId)
            .build()
        val d = CompletableDeferred<List<Purchase>>()
        pending = d
        val r = client.launchBillingFlow(activity, params)
        if (r.responseCode != BillingClient.BillingResponseCode.OK && r.responseCode != BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            pending = null
            throw PlayBillingException("Purchase failed. Please try again.")
        }
        try {
            d.await().firstOrNull { it.products.contains(sku) } ?: ownedPurchase(sku, type)
        } finally {
            pending = null
        }
    }

    private suspend fun ownedPurchase(sku: String, type: String): Purchase? =
        client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build())
            .purchasesList.firstOrNull { it.products.contains(sku) }

    private suspend fun verify(sku: String, purchase: Purchase, importQuote: ImportQuoteRequest? = null): PlayVerifyResponse {
        if (purchase.purchaseState == Purchase.PurchaseState.PENDING) throw PlayBillingException(PENDING_MSG, pending = true)
        val r = api.playVerify(PlayVerifyRequest(sku, purchase.purchaseToken, importQuote))
        // PM3: only "granted" unlocks anything; pending / expired are surfaced instead of a false success.
        when (r.status) {
            "granted" -> return r
            "pending" -> throw PlayBillingException(PENDING_MSG, pending = true)
            else -> throw PlayBillingException("Google Play didn't confirm this purchase. If you were charged, it will be refunded automatically.")
        }
    }

    /** PM3: the localized price Google Play will actually charge (null if Play is unavailable). */
    suspend fun bookPrice(contentId: String): String? = runCatching {
        val sku = api.playBookSku(contentId)?.sku ?: return null
        connect()
        client.queryProductDetails(
            QueryProductDetailsParams.newBuilder().setProductList(
                listOf(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(BillingClient.ProductType.INAPP).build()),
            ).build(),
        ).productDetailsList?.firstOrNull()?.oneTimePurchaseOfferDetails?.formattedPrice
    }.getOrNull()

    /** Pays for one import with the Play SKU mapped to the quoted page tier; returns the server payment id. */
    suspend fun buyImport(tierId: String, quote: ImportQuoteRequest, maxPages: Int? = null): String {
        val sku = products().products.firstOrNull { it.kind == "import_tier" && it.importTierId == tierId }?.sku
            ?: throw PlayBillingException("This import size can't be purchased in the app yet. Try a shorter document.")
        // PB2: reuse an unused Play credit that covers this tier (bought earlier, verify finished but import never ran).
        val ents = runCatching { api.entitlements() }.getOrNull()
        val needed = maxPages ?: Int.MAX_VALUE
        ents?.importCredits?.firstOrNull { !it.used && it.source == "google_play" && (it.tierId == tierId || (it.maxPages ?: -1) >= needed) }
            ?.let { return it.paymentId }
        // On ITEM_ALREADY_OWNED, launch() falls back to the owned token; the server verifies it without needing a quote.
        val purchase = launch(sku, BillingClient.ProductType.INAPP) ?: throw PlayBillingException("Purchase failed. Please try again.")
        return verify(sku, purchase, quote).paymentId ?: throw PlayBillingException("Purchase could not be confirmed. Please try again.")
    }

    /** Unlocks a catalog book with its Play SKU. */
    suspend fun buyBook(contentId: String): EntitlementsResponse? {
        val sku = api.playBookSku(contentId)?.sku ?: throw PlayBillingException("This book can't be purchased in the app yet.")
        val purchase = launch(sku, BillingClient.ProductType.INAPP) ?: throw PlayBillingException("Purchase failed. Please try again.")
        return verify(sku, purchase).entitlements
    }

    /** Gotcha Plus subscription. */
    suspend fun buyPlus(): EntitlementsResponse? {
        val sku = products().products.firstOrNull { it.kind == "subscription" && it.planTier == "premium" }?.sku
            ?: throw PlayBillingException("Plus is not available in the app yet.")
        val purchase = launch(sku, BillingClient.ProductType.SUBS) ?: throw PlayBillingException("Purchase failed. Please try again.")
        return verify(sku, purchase).entitlements
    }

    /**
     * After login / on resume: re-send any Play purchase the server hasn't confirmed (app killed mid-flow,
     * pending payment completed), then return the unified entitlements (web + Play).
     */
    suspend fun syncAtLogin(): EntitlementsResponse? {
        runCatching {
            connect()
            val known = products().products.associateBy { it.sku }
            for (type in listOf(BillingClient.ProductType.INAPP, BillingClient.ProductType.SUBS)) {
                client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build()).purchasesList
                    // PB2: unacknowledged purchases AND every still-owned INAPP item (an owned consumable means
                    // the server never consumed it). Import tiers verify without a quote and become a tier credit.
                    .filter { it.purchaseState == Purchase.PurchaseState.PURCHASED && (!it.isAcknowledged || type == BillingClient.ProductType.INAPP) }
                    .forEach { p ->
                        val sku = p.products.firstOrNull() ?: return@forEach
                        if (known[sku] == null) return@forEach
                        runCatching { api.playVerify(PlayVerifyRequest(sku, p.purchaseToken, null)) }
                    }
            }
        }
        return runCatching { api.entitlements() }.getOrNull()
    }
}
