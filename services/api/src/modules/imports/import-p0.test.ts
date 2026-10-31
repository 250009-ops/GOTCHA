import * as assert from 'node:assert/strict';
import { prepareRetryPayment, settleFailedImportPayment, RefundDb, liveReverseEnabled } from '../billing/import-refund';
import { buildImportNotices, importNoticeMessage } from './import-notice';
import { backoffMs } from './import-queue';
import { isRetryableImportError, presentImport, IMPORT_MAX_MANUAL_RETRIES } from './imports.service';

type Row = Record<string, any>;
function fakeDb(rows: Row[]): RefundDb & { rows: Row[] } {
  const match = (r: Row, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => r[k] === v);
  return {
    rows,
    importPayment: {
      async findFirst({ where }) { return (rows.find((r) => match(r, where)) as any) ?? null; },
      async updateMany({ where, data }) {
        let count = 0;
        for (const r of rows) if (match(r, where)) { Object.assign(r, data); count++; }
        return { count };
      },
    },
  };
}
const paid = () => ({ id: 'p1', userImportId: 'u1', status: 'paid', amountTiyins: 500000, providerPaymentId: '123', refundState: null });

async function main() {
  // --- refund: default marks due exactly once
  {
    const db = fakeDb([paid()]);
    const a = await settleFailedImportPayment(db, null, 'u1', 'boom');
    const b = await settleFailedImportPayment(db, null, 'u1', 'boom');
    assert.equal(a.action, 'refund_due');
    assert.deepEqual(b, { action: 'none', reason: 'already_claimed' });
    assert.equal(db.rows[0].status, 'paid');
    assert.equal(db.rows[0].refundState, 'due');
  }
  // --- refund: concurrent settle → one claim
  {
    const db = fakeDb([paid()]);
    const rs = await Promise.all([1, 2, 3, 4].map(() => settleFailedImportPayment(db, null, 'u1', 'x')));
    assert.equal(rs.filter((r) => r.action === 'refund_due').length, 1);
  }
  // --- refund: live reverse once, never twice
  {
    const db = fakeDb([paid()]);
    let calls = 0;
    const atmos = { async reverseTransaction() { calls++; } };
    const [a, b] = await Promise.all([
      settleFailedImportPayment(db, atmos, 'u1', 'x', { liveReverse: true }),
      settleFailedImportPayment(db, atmos, 'u1', 'x', { liveReverse: true }),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual([a.action, b.action].sort(), ['none', 'refunded']);
    assert.equal(db.rows[0].status, 'refunded');
    assert.equal((await settleFailedImportPayment(db, atmos, 'u1', 'x', { liveReverse: true })).action, 'none');
    assert.equal(calls, 1);
  }
  // --- refund: reverse error is parked, not retried
  {
    const db = fakeDb([paid()]);
    let calls = 0;
    const atmos = { async reverseTransaction() { calls++; throw new Error('timeout'); } };
    assert.equal((await settleFailedImportPayment(db, atmos, 'u1', 'x', { liveReverse: true })).action, 'reverse_failed');
    assert.equal((await settleFailedImportPayment(db, atmos, 'u1', 'x', { liveReverse: true })).action, 'none');
    assert.equal(calls, 1);
    assert.equal(db.rows[0].refundState, 'reverse_failed');
  }
  // --- refund: free / unpaid / missing
  assert.deepEqual(await settleFailedImportPayment(fakeDb([]), null, 'u1', 'x'), { action: 'none', reason: 'no_payment' });
  assert.equal(((await settleFailedImportPayment(fakeDb([{ ...paid(), amountTiyins: 0 }]), null, 'u1', 'x')) as any).reason, 'free');
  assert.equal(((await settleFailedImportPayment(fakeDb([{ ...paid(), status: 'pending' }]), null, 'u1', 'x')) as any).reason, 'not_paid');
  // --- retry: cancels 'due' mark (no new charge), refuses after refund
  {
    const db = fakeDb([{ ...paid(), refundState: 'due' }]);
    assert.deepEqual(await prepareRetryPayment(db, 'u1'), { ok: true, cancelledRefund: true });
    assert.equal(db.rows[0].refundState, null);
    assert.equal(db.rows[0].status, 'paid');
    // fails again → due again, still once
    assert.equal((await settleFailedImportPayment(db, null, 'u1', 'again')).action, 'refund_due');
    assert.deepEqual(await prepareRetryPayment(fakeDb([{ ...paid(), status: 'refunded', refundState: 'refunded' }]), 'u1'), { ok: false, reason: 'refunded' });
    assert.deepEqual(await prepareRetryPayment(fakeDb([{ ...paid(), refundState: 'processing' }]), 'u1'), { ok: false, reason: 'refund_in_progress' });
    assert.deepEqual(await prepareRetryPayment(fakeDb([paid()]), 'u1'), { ok: true, cancelledRefund: false });
  }
  assert.equal(liveReverseEnabled({}), false);
  assert.equal(liveReverseEnabled({ IMPORT_REFUND_LIVE_REVERSE: 'true' }), true);

  // --- notices
  {
    const n = buildImportNotices({ ocrSkippedPages: 122, ocrPagesDone: 200, ocrFirstSkippedPage: 201, truncatedPages: false, pagesNotExtracted: 0, pageCount: 322 });
    assert.equal(n.length, 1);
    assert.equal(n[0].code, 'ocr_page_cap');
    for (const lang of ['en', 'ru', 'uz'] as const) {
      const m = importNoticeMessage(n[0], lang);
      assert.match(m, /200/);
      assert.match(m, /122/);
      assert.doesNotMatch(m, /500/);
    }
    assert.notEqual(importNoticeMessage(n[0], 'en'), importNoticeMessage(n[0], 'ru'));
    assert.notEqual(importNoticeMessage(n[0], 'en'), importNoticeMessage(n[0], 'uz'));
    assert.deepEqual(buildImportNotices({ ocrSkippedPages: 0, ocrPagesDone: 10, ocrFirstSkippedPage: null, truncatedPages: false, pagesNotExtracted: 0, pageCount: 10 }), []);
    const t = buildImportNotices({ ocrSkippedPages: 0, ocrPagesDone: 0, ocrFirstSkippedPage: null, truncatedPages: true, pagesNotExtracted: 40, pageCount: 1040 });
    assert.equal(t[0].code, 'pdf_page_cap');
    for (const lang of ['en', 'ru', 'uz'] as const) assert.match(importNoticeMessage(t[0], lang), /40/);
  }

  // --- presentImport / retryability / backoff
  const q = { status: 'failed', attempts: 3, maxAttempts: 3, lastError: 'x' };
  assert.equal(presentImport({ ingestionStatus: 'failed', errorMessage: 'x', manualRetries: 0, queueJob: q }).canRetry, true);
  assert.equal(presentImport({ ingestionStatus: 'failed', errorMessage: 'x', manualRetries: IMPORT_MAX_MANUAL_RETRIES, queueJob: q }).canRetry, false);
  assert.equal(presentImport({ ingestionStatus: 'failed', errorMessage: 'x', manualRetries: 0, queueJob: null as any }).canRetry, false);
  assert.equal(presentImport({ ingestionStatus: 'ready', errorMessage: null, manualRetries: 0, queueJob: q }).canRetry, false);
  assert.deepEqual(presentImport({ ingestionStatus: 'queued', errorMessage: null, queueJob: { ...q, status: 'queued', attempts: 1 } }).queue, { status: 'queued', attempts: 1, maxAttempts: 3 });
  assert.equal(isRetryableImportError(new Error('This PDF is password-protected.')), false);
  assert.equal(isRetryableImportError(new Error('ECONNRESET')), true);
  assert.ok(backoffMs(1) < backoffMs(2));

  console.log('import-p0 unit tests: OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
