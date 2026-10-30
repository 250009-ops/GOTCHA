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
import com.android.billingclient.api.QueryProductDetailsResult
import com.android.billingclient.api.QueryPurchasesParams
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
        .enableAutoServiceReconnection() // PBL 8+: reconnects transparently when the Play service drops
        .build()
    @Volatile private var lastSyncMs = 0L
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
        when (outcome(result.responseCode)) {
            PlayPurchaseLogic.Launch.PURCHASED -> d.complete(purchases.orEmpty())
            PlayPurchaseLogic.Launch.CANCELLED -> d.completeExceptionally(PlayBillingException("Purchase cancelled.", cancelled = true))
            PlayPurchaseLogic.Launch.ALREADY_OWNED -> d.complete(emptyList()) // launch() falls back to the owned token
            PlayPurchaseLogic.Launch.FAILED -> d.completeExceptionally(PlayBillingException("Purchase failed. Please try again."))
        }
    }

    private fun outcome(code: Int) = PlayPurchaseLogic.launchOutcome(
        code, BillingClient.BillingResponseCode.OK, BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED, BillingClient.BillingResponseCode.USER_CANCELED,
    )

    /**
     * PBL 8+: uses the callback API because only QueryProductDetailsResult carries unfetchedProductList (the ktx
     * ProductDetailsResult drops it). N2-m5: unfetched products are logged with their status code.
     */
    private suspend fun productDetails(sku: String, type: String): ProductDetails? {
        connect()
        val params = QueryProductDetailsParams.newBuilder().setProductList(
            listOf(QueryProductDetailsParams.Product.newBuilder().setProductId(sku).setProductType(type).build()),
        ).build()
        val res: QueryProductDetailsResult? = suspendCancellableCoroutine { cont ->
            client.queryProductDetailsAsync(params) { br, r ->
                if (br.responseCode != BillingClient.BillingResponseCode.OK) {
                    android.util.Log.w("PlayBilling", "queryProductDetails $sku failed: ${br.responseCode} ${br.debugMessage}")
                }
                if (cont.isActive) cont.resume(r)
            }
        }
        res?.unfetchedProductList?.forEach { u ->
            android.util.Log.w("PlayBilling", "unfetched product ${u.productId}: statusCode=${u.statusCode} (check Play Console: product active, country, app version)")
        }
        return res?.productDetailsList?.firstOrNull { it.productId == sku }
    }

    private suspend fun launch(sku: String, type: String): Purchase? = flowLock.withLock {
        connect()
        val activity = activityRef?.get() ?: throw PlayBillingException("Open Gotcha to complete the purchase.")
        val details: ProductDetails = productDetails(sku, type) ?: throw PlayBillingException("This item is not available in your country yet.")
        val pp = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).apply {
            // m-p2-6: pick the plain base-plan offer (no offerId) explicitly, never a promo/trial offer by position.
            details.subscriptionOfferDetails?.let { offers ->
                PlayPurchaseLogic.baseOffer(offers) { it.offerId }?.offerToken?.let { setOfferToken(it) }
            }
            // PBL 8+: one-time products can carry several offers; buy the default (first) one.
            details.oneTimePurchaseOfferDetailsList?.firstOrNull()?.offerToken?.let { setOfferToken(it) }
        }.build()
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(pp))
            .setObfuscatedAccountId(products().obfuscatedAccountId)
            .build()
        val d = CompletableDeferred<List<Purchase>>()
        pending = d
        val r = client.launchBillingFlow(activity, params)
        val lo = outcome(r.responseCode)
        if (lo != PlayPurchaseLogic.Launch.PURCHASED && lo != PlayPurchaseLogic.Launch.ALREADY_OWNED) {
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
        when (PlayPurchaseLogic.verifyOutcome(r.status)) {
            PlayPurchaseLogic.Verify.GRANTED -> return r
            PlayPurchaseLogic.Verify.PENDING -> throw PlayBillingException(PENDING_MSG, pending = true)
            PlayPurchaseLogic.Verify.NOT_CONFIRMED -> throw PlayBillingException("Google Play didn't confirm this purchase. If you were charged, it will be refunded automatically.")
        }
    }

    /** PM3: the localized price Google Play will actually charge (null if Play is unavailable). */
    suspend fun bookPrice(contentId: String): String? = runCatching {
        val sku = api.playBookSku(contentId)?.sku ?: return null
        // N2-M1: the list is only set for multi-offer products; single-price books use oneTimePurchaseOfferDetails.
        productDetails(sku, BillingClient.ProductType.INAPP)?.let { d ->
            PlayPurchaseLogic.priceOf(d.oneTimePurchaseOfferDetailsList?.firstOrNull()?.formattedPrice, d.oneTimePurchaseOfferDetails?.formattedPrice)
        }
    }.getOrNull()

    /** Pays for one import with the Play SKU mapped to the quoted page tier; returns the server payment id. */
    suspend fun buyImport(tierId: String, quote: ImportQuoteRequest, maxPages: Int? = null): String {
        val sku = products().products.firstOrNull { it.kind == "import_tier" && it.importTierId == tierId }?.sku
            ?: throw PlayBillingException("This import size can't be purchased in the app yet. Try a shorter document.")
        // PB2: reuse an unused Play credit that covers this tier (bought earlier, verify finished but import never ran).
        val ents = runCatching { api.entitlements() }.getOrNull()
        ents?.importCredits?.let { PlayPurchaseLogic.reusableCredit(it, tierId, maxPages) }?.let { return it.paymentId }
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
    suspend fun syncAtLogin(force: Boolean = true): EntitlementsResponse? {
        val now = System.currentTimeMillis()
        if (!PlayPurchaseLogic.syncDue(lastSyncMs, now, force)) return null // N-M4: resume syncs at most every 5 min
        lastSyncMs = now
        runCatching {
            connect()
            val known = products().products.associateBy { it.sku }
            for (type in listOf(BillingClient.ProductType.INAPP, BillingClient.ProductType.SUBS)) {
                client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(type).build()).purchasesList
                    .forEach { p ->
                        val sku = p.products.firstOrNull() ?: return@forEach
                        // N-M4: only unacknowledged purchases and owned import consumables; owned books aren't re-verified.
                        if (!PlayPurchaseLogic.shouldResync(p.purchaseState == Purchase.PurchaseState.PURCHASED, p.isAcknowledged, known[sku]?.kind)) return@forEach
                        runCatching { api.playVerify(PlayVerifyRequest(sku, p.purchaseToken, null)) }
                    }
            }
        }
        return runCatching { api.entitlements() }.getOrNull()
    }
}
