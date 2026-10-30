// Google Play verification + unified entitlements (mocked Play API and an in-memory Prisma).
process.env.PLAY_TOKEN_KEY = process.env.PLAY_TOKEN_KEY || 'test-only-key';
import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PlayBillingService, playAccountId } from './play-billing.service';
import { EntitlementsService } from './entitlements.service';
import { GooglePlayClient } from './google-play.client';

function fakeDb() {
  const t: Record<string, any[]> = { storeProduct: [], playPurchase: [], entitlement: [], importPayment: [], contentPurchase: [], contentItem: [{ id: 'book1', salesCount: 0, publishStatus: 'published' }, { id: 'book2', salesCount: 0, publishStatus: 'draft' }], importPageTier: [{ id: 't1', minPages: 1, maxPages: 10 }], playRtdnMessage: [], userSubscription: [], subscriptionPlan: [{ id: 'plan-p', tier: 'premium' }], auditLog: [] };
  let n = 0;
  const match = (row: any, where: any = {}): boolean =>
    Object.entries(where).every(([k, v]: [string, any]) => {
      if (k === 'OR') return (v as any[]).some((w) => match(row, w));
      if (k === 'platform_sku') return row.platform === v.platform && row.sku === v.sku;
      if (k === 'source_sourceRef_kind') return row.source === v.source && row.sourceRef === v.sourceRef && row.kind === v.kind;
      if (v && typeof v === 'object' && !(v instanceof Date)) {
        if ('in' in v) return v.in.includes(row[k]);
        if ('lt' in v) return row[k] != null && row[k] < v.lt;
        if ('gt' in v && 'lt' in v) return row[k] != null && row[k] > v.gt && row[k] < v.lt;
        if ('gt' in v) return row[k] != null && row[k] > v.gt;
        if ('not' in v) return row[k] !== v.not;
        return true;
      }
      return (row[k] ?? null) === v;
    });
  const model = (name: string) => ({
    findUnique: async ({ where }: any) => t[name].find((r) => match(r, where)) ?? null,
    findFirst: async ({ where }: any = {}) => t[name].find((r) => match(r, where)) ?? null,
    findMany: async ({ where }: any = {}) => t[name].filter((r) => match(r, where)),
    create: async ({ data }: any) => {
      if ((name === 'importPayment' && t[name].some((r) => r.account === data.account)) || (name === 'playRtdnMessage' && t[name].some((r) => r.messageId === data.messageId))) throw Object.assign(new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)('dup', { code: 'P2002', clientVersion: 'x' }));
      const row = { id: `${name}-${++n}`, createdAt: new Date(), status: 'active', userImportId: null, ...data }; t[name].push(row); return row;
    },
    createMany: async ({ data }: any) => { for (const d of data) if (!t[name].some((r) => r.sourceRef === d.sourceRef && r.kind === d.kind)) t[name].push({ id: `${name}-${++n}`, status: 'active', createdAt: new Date(), ...d }); return { count: 1 }; },
    update: async ({ where, data }: any) => { const r = t[name].find((x) => match(x, where)); if (!r) throw new Error('nf'); for (const [k, v] of Object.entries<any>(data)) r[k] = v && typeof v === 'object' && 'increment' in v ? r[k] + v.increment : v && typeof v === 'object' && 'decrement' in v ? r[k] - v.decrement : v; return r; },
    updateMany: async ({ where, data }: any) => { const rs = t[name].filter((x) => match(x, where)); rs.forEach((r) => Object.assign(r, data)); return { count: rs.length }; },
    upsert: async ({ where, create, update }: any) => { const r = t[name].find((x) => match(x, where)); if (r) return Object.assign(r, update); const row = { id: `${name}-${++n}`, createdAt: new Date(), ...(name === 'playPurchase' ? { acknowledged: false, consumed: false } : {}), ...create }; t[name].push(row); return row; },
    count: async ({ where }: any = {}) => t[name].filter((r) => match(r, where)).length,
    deleteMany: async ({ where }: any = {}) => { const keep = t[name].filter((r) => !match(r, where)); const n0 = t[name].length; t[name].splice(0, n0, ...keep); return { count: n0 - keep.length }; },
  });
  const prisma: any = Object.fromEntries(Object.keys(t).map((k) => [k, model(k)]));
  prisma.$transaction = async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn));
  return { prisma, t };
}

async function main() {
  const { prisma, t } = fakeDb();
  t.storeProduct.push(
    { id: 'sp1', platform: 'google_play', sku: 'plus_monthly', kind: 'subscription', planTier: 'premium', priceUzs: 39990, active: true },
    { id: 'sp2', platform: 'google_play', sku: 'book_1', kind: 'catalog_book', contentId: 'book1', priceUzs: 25000, active: true },
    { id: 'sp3', platform: 'google_play', sku: 'import_tier_1_10', kind: 'import_tier', importTierId: 't1', priceUzs: 12000, active: true },
    { id: 'sp4', platform: 'google_play', sku: 'book_2', kind: 'catalog_book', contentId: 'book2', priceUzs: 25000, active: true },
  );
  let voided: string[] = [];
  const calls: string[] = [];
  const future = new Date(Date.now() + 30 * 86400_000).toISOString();
  const play: any = {
    packageName: () => 'app.gotcha.android',
    getSubscription: async (tok: string) => (tok === 'tok-sub-u1'
      ? { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', latestOrderId: 'GPA.1', externalAccountIdentifiers: { obfuscatedExternalAccountId: playAccountId('u1') }, lineItems: [{ productId: 'plus_monthly', expiryTime: future }] }
      : null),
    voidedPurchases: async () => voided.map((purchaseToken) => ({ purchaseToken })),
    getProduct: async (_sku: string, tok: string) => (tok.startsWith('tok-imp')
      ? { purchaseState: 0, acknowledgementState: 0, consumptionState: 0, orderId: 'GPA.3', obfuscatedExternalAccountId: playAccountId('u1') }
      : tok.startsWith('tok-book')
      ? { purchaseState: 0, acknowledgementState: 0, orderId: 'GPA.2', obfuscatedExternalAccountId: playAccountId(tok.endsWith('u2') ? 'u2' : 'u1') }
      : null),
    acknowledgeSubscription: async () => calls.push('ackSub'),
    acknowledgeProduct: async () => calls.push('ackProd'),
    consumeProduct: async () => { calls.push('consume'); if (play.consumeFails) throw new Error('503'); },
    consumeFails: false,
  };
  const ents = new EntitlementsService(prisma);
  const commerce: any = {
    quote: async () => ({ requiresPayment: true }),
    fulfillCatalogPurchase: async (p: any) => {
      if (t.contentPurchase.some((c) => c.importPaymentId === p.id)) return;
      t.contentPurchase.push({ id: 'cp-' + p.id, userId: p.userId, contentId: 'book1', status: 'completed', importPaymentId: p.id });
      t.entitlement.push({ id: 'e-' + p.id, userId: p.userId, kind: 'catalog_book', contentId: 'book1', source: 'google_play', sourceRef: p.id, importPaymentId: p.id, status: 'active', createdAt: new Date() });
    },
  };
  const svc = new PlayBillingService(prisma, play as GooglePlayClient, ents, commerce);

  assert.equal(playAccountId('u1'), playAccountId('u1'));
  assert.notEqual(playAccountId('u1'), playAccountId('u2'));

  // Unknown / inactive SKU
  await assert.rejects(svc.verify('u1', { sku: 'nope', purchaseToken: 'tok-xxxxxxxx' }), (e: any) => e.getResponse().code === 'play_unknown_sku');

  // Plus: verified with Google, bound to account, projected to user_subscriptions, acknowledged.
  const r1 = await svc.verify('u1', { sku: 'plus_monthly', purchaseToken: 'tok-sub-u1' });
  assert.equal(r1.status, 'granted');
  assert.equal(r1.entitlements.plus.active, true);
  assert.equal(r1.entitlements.plus.source, 'google_play');
  assert.equal(t.userSubscription.filter((s) => s.status === 'active' && s.provider === 'google_play').length, 1);
  assert.ok(calls.includes('ackSub'));
  // Idempotent re-verify: still one entitlement and one subscription row.
  await svc.verify('u1', { sku: 'plus_monthly', purchaseToken: 'tok-sub-u1' });
  assert.equal(t.entitlement.filter((e) => e.kind === 'plus').length, 1);
  assert.equal(t.userSubscription.length, 1);
  // Same token replayed from another account → 409; nothing granted to u2.
  await assert.rejects(svc.verify('u2', { sku: 'plus_monthly', purchaseToken: 'tok-sub-u1' }), (e: any) => e.getStatus() === 409);
  assert.equal((await ents.forUser('u2')).plus.active, false);

  // Book bought on u2's Play account but sent by u1 → 403 (obfuscated account id mismatch).
  await assert.rejects(svc.verify('u1', { sku: 'book_1', purchaseToken: 'tok-book-u2' }), (e: any) => e.getStatus() === 403);
  // Book: paid ImportPayment (provider google_play) → content purchase + entitlement, acknowledged.
  const r2: any = await svc.verify('u1', { sku: 'book_1', purchaseToken: 'tok-book-u1' });
  assert.equal(r2.status, 'granted');
  assert.deepEqual(r2.entitlements.books.map((b: any) => b.contentId), ['book1']);
  assert.equal(t.importPayment[0].provider, 'google_play');
  assert.ok(calls.includes('ackProd'));
  await svc.verify('u1', { sku: 'book_1', purchaseToken: 'tok-book-u1' });
  assert.equal(t.importPayment.length, 1, 'one payment per token');
  assert.equal(t.contentPurchase.length, 1);

  // RTDN: wrong package ignored; voided purchase revokes exactly that book.
  const push = (o: unknown) => ({ message: { data: Buffer.from(JSON.stringify(o)).toString('base64') } });
  assert.deepEqual(await svc.handleRtdn(push({ packageName: 'evil.app', voidedPurchaseNotification: { purchaseToken: 'tok-book-u1' } })), { ignored: 'package' });
  // PB1 + N-M3: a void Play doesn't confirm yet revokes nothing, answers 503 (Pub/Sub retries) and the
  // message id is NOT recorded, so the redelivery is processed.
  const vm = { message: { messageId: 'm1', ...push({ packageName: 'app.gotcha.android', voidedPurchaseNotification: { purchaseToken: 'tok-book-u1' } }).message } };
  await assert.rejects(svc.handleRtdn(vm), (e: any) => e.getStatus() === 503);
  assert.equal(t.contentPurchase[0].status, 'completed');
  assert.equal(t.playRtdnMessage.length, 0, 'unconfirmed void not marked processed');
  voided = ['tok-book-u1'];
  await svc.handleRtdn(vm); // redelivery, now confirmed
  // n-5: a processed message id is deduped (insert-first).
  assert.deepEqual(await svc.handleRtdn(vm), { ignored: 'duplicate' });
  assert.equal(t.contentPurchase[0].status, 'refunded');
  assert.equal(t.importPayment[0].status, 'refunded');
  assert.equal((await ents.forUser('u1')).books.length, 0);
  assert.equal((await ents.forUser('u1')).plus.active, true, 'other unlocks untouched');

  // PM6: Play still reports the same order as active → the revoked Plus is NOT resurrected.
  voided = ['tok-sub-u1'];
  await svc.handleRtdn(push({ packageName: 'app.gotcha.android', voidedPurchaseNotification: { purchaseToken: 'tok-sub-u1' } }));
  assert.equal((await ents.forUser('u1')).plus.active, false);
  await svc.verify('u1', { sku: 'plus_monthly', purchaseToken: 'tok-sub-u1' });
  assert.equal((await ents.forUser('u1')).plus.active, false, 'revoked stays revoked for the same order');
  // A genuinely new renewal order re-activates it.
  const origGet = play.getSubscription;
  play.getSubscription = async (tok: string) => ({ ...(await origGet(tok)), latestOrderId: 'GPA.1..0' });
  await svc.verify('u1', { sku: 'plus_monthly', purchaseToken: 'tok-sub-u1' });
  assert.equal((await ents.forUser('u1')).plus.active, true);
  play.getSubscription = origGet;

  // PM4: an RTDN whose re-verify hits a domain error (account mismatch) is handled, not retried forever.
  play.getSubscription = async () => ({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', externalAccountIdentifiers: { obfuscatedExternalAccountId: 'someone-else' }, lineItems: [{ productId: 'plus_monthly', expiryTime: future }] });
  assert.deepEqual(await svc.handleRtdn(push({ packageName: 'app.gotcha.android', subscriptionNotification: { purchaseToken: 'tok-sub-u1', notificationType: 2 } })), { ignored: 'domain_error' });
  play.getSubscription = origGet;

  // RTDN: subscription expired at Google → entitlement expired, projection cancelled.
  play.getSubscription = async () => ({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED', externalAccountIdentifiers: { obfuscatedExternalAccountId: playAccountId('u1') }, lineItems: [{ productId: 'plus_monthly', expiryTime: new Date(Date.now() - 1000).toISOString() }] });
  await svc.handleRtdn(push({ packageName: 'app.gotcha.android', subscriptionNotification: { purchaseToken: 'tok-sub-u1', notificationType: 13 } }));
  assert.equal((await ents.forUser('u1')).plus.active, false);
  assert.equal(t.userSubscription[0].status, 'canceled');

  // PB2: import credit verified WITHOUT a quote (interrupted flow) → tier credit, consumed server-side.
  play.consumeFails = true;
  const r3: any = await svc.verify('u1', { sku: 'import_tier_1_10', purchaseToken: 'tok-imp-1' });
  assert.equal(r3.status, 'granted');
  const credit = r3.entitlements.importCredits.find((c: any) => c.paymentId === r3.paymentId);
  assert.equal(credit.used, false);
  assert.equal(credit.tierId, 't1');
  assert.equal(credit.maxPages, 10);
  const pp = t.playPurchase.find((x) => x.sku === 'import_tier_1_10');
  assert.ok(String(pp.purchaseToken).startsWith('enc:v1:'), 'token sealed at rest');
  assert.ok(!pp.consumed);
  // PM1: the job retries the consume.
  play.consumeFails = false;
  const job = await svc.runJobs();
  assert.ok(job.settled >= 1);
  assert.equal(pp.consumed, true);

  // n-4: a subscription cancelled before acknowledgement is still acknowledged by the job.
  t.playPurchase.push({ tokenHash: 'h-canceled', purchaseToken: 'tok-c', userId: 'u1', sku: 'plus_monthly', kind: 'subscription', state: 'canceled', acknowledged: false, consumed: false, createdAt: new Date() });
  calls.length = 0;
  await svc.runJobs();
  assert.ok(calls.includes('ackSub'), 'canceled-but-unacked subscription acknowledged');
  // N-M3 backstop: the voided sweep revokes a purchase whose RTDN never got through.
  const sweepHash = createHash('sha256').update('tok-sweep').digest('hex');
  t.playPurchase.push({ tokenHash: sweepHash, purchaseToken: 'tok-sweep', userId: 'u1', sku: 'book_1', kind: 'catalog_book', state: 'purchased', acknowledged: true, createdAt: new Date() });
  voided = ['tok-sweep'];
  assert.equal(await svc.sweepVoided(), 1);
  assert.equal(t.playPurchase.find((x) => x.tokenHash === sweepHash).state, 'revoked');
  assert.equal(await svc.sweepVoided(), 0, 'already revoked rows skipped');

  // PM5: an upgrade's linkedPurchaseToken revokes the linked Plus of THIS user only.
  const linkedHash = createHash('sha256').update('tok-old').digest('hex');
  t.entitlement.push(
    { id: 'e-u2', userId: 'u2', kind: 'plus', source: 'google_play', sourceRef: linkedHash, status: 'active' },
    { id: 'e-u1', userId: 'u1', kind: 'plus', source: 'google_play', sourceRef: linkedHash, status: 'active' },
  );
  const origSub = play.getSubscription;
  play.getSubscription = async (tok: string) => (tok === 'tok-sub2-u1'
    ? { subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', latestOrderId: 'GPA.9', linkedPurchaseToken: 'tok-old', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED', externalAccountIdentifiers: { obfuscatedExternalAccountId: playAccountId('u1') }, lineItems: [{ productId: 'plus_monthly', expiryTime: future }] }
    : origSub(tok));
  await svc.verify('u1', { sku: 'plus_monthly', purchaseToken: 'tok-sub2-u1' });
  assert.equal(t.entitlement.find((e) => e.id === 'e-u1').status, 'revoked');
  assert.equal(t.entitlement.find((e) => e.id === 'e-u2').status, 'active', 'other user untouched');
  play.getSubscription = origSub;

  // m-p2-8: unpublished books expose no SKU.
  assert.equal(await svc.skuForBook('book2'), null);
  assert.deepEqual(await svc.skuForBook('book1'), { sku: 'book_1', priceUzs: 25000 });

  // Push auth fails closed with nothing configured.
  delete process.env.PLAY_RTDN_TOKEN; delete process.env.PLAY_RTDN_AUDIENCE; delete process.env.PLAY_RTDN_SA_EMAIL;
  const gp = new GooglePlayClient();
  assert.equal(await gp.verifyPush(undefined, 'x'), false);
  process.env.PLAY_RTDN_TOKEN = 'secret-123';
  assert.equal(await gp.verifyPush(undefined, 'secret-124'), false);
  assert.equal(await gp.verifyPush(undefined, 'secret-123'), true, 'legacy token only without OIDC');
  // PB1: once OIDC is configured the query token is ignored, and SA email is mandatory.
  process.env.PLAY_RTDN_AUDIENCE = 'https://api.example/rtdn';
  assert.equal(await gp.verifyPush(undefined, 'secret-123'), false);
  assert.equal(gp.rtdnConfigProblem(), 'PLAY_RTDN_SA_EMAIL is required with PLAY_RTDN_AUDIENCE');
  assert.equal(await gp.verifyPush('Bearer a.b.c', undefined), false);
  process.env.PLAY_RTDN_SA_EMAIL = 'rtdn@x.iam.gserviceaccount.com';
  assert.equal(gp.rtdnConfigProblem(), null);
  delete process.env.PLAY_RTDN_AUDIENCE; delete process.env.PLAY_RTDN_SA_EMAIL; delete process.env.PLAY_RTDN_TOKEN;
  assert.equal(gp.rtdnConfigProblem(), 'set PLAY_RTDN_AUDIENCE + PLAY_RTDN_SA_EMAIL');
  const { sealToken, openToken } = await import('./google-play.client');
  assert.equal(openToken(sealToken('abc.def')), 'abc.def');
  assert.equal(openToken('legacy-plain'), 'legacy-plain');
  console.log('play-billing.test.ts ok');
}

main().catch((e) => { console.error(e); process.exit(1); });
