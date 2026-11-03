import { ImportPaymentStatus } from '@prisma/client';

/**
 * Import-failure refunds (import-p0).
 *
 * Exactly-once: the refund is *claimed* with a conditional update
 * (`status = paid AND refund_state IS NULL`). Only the caller whose update hits one row may act,
 * so a reaper + worker race, a duplicate retry, or a re-run can never refund twice.
 *
 * final-6.1b-r2 (Kai: a failed paid import is never charged): live reversal (Atmos /merchant/pay/reverse,
 * the same call the admin refund already uses) is ON by default. IMPORT_REFUND_LIVE_REVERSE=false|0|no|off
 * is a kill switch that falls back to refund_state = 'due' + needsAttention for a manual refund.
 * A reverse error parks the row as 'reverse_failed' + needsAttention (never auto-retried).
 */
export type RefundState = 'due' | 'processing' | 'refunded' | 'reverse_failed';

export interface RefundDb {
  importPayment: {
    findFirst(args: { where: Record<string, unknown> }): Promise<RefundPaymentRow | null>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
}
export interface RefundPaymentRow {
  id: string;
  status: ImportPaymentStatus | string;
  amountTiyins: number;
  providerPaymentId: string | null;
  refundState: string | null;
}
export interface Reverser {
  reverseTransaction(p: { transactionId: number; reason?: string; idempotencyKey?: string }): Promise<unknown>;
}

const BUSY_IMPORT = new Set(['queued', 'processing', 'tokenizing']);

/**
 * Admin Atmos reverse is refused while the import is still running, while an automatic
 * reverse is in flight or may already have moved money, and while the row is flagged
 * for a manual look. A failed import marked refund-due (or refund_state due) stays
 * refundable: that is the manual reverse.
 */
export function adminRefundBlockReason(p: {
  needsAttention?: boolean | null;
  refundDue?: boolean | null;
  refundState?: string | null;
  importStatus?: string | null;
}): 'import_processing' | 'needs_attention' | 'auto_refund_in_progress' | null {
  if (p.importStatus && BUSY_IMPORT.has(p.importStatus)) return 'import_processing';
  if (p.refundState === 'processing' || p.refundState === 'reverse_failed') return 'auto_refund_in_progress';
  if (p.needsAttention && !p.refundDue && p.refundState !== 'due') return 'needs_attention';
  return null;
}

export function liveReverseEnabled(env = process.env): boolean {
  const v = (env.IMPORT_REFUND_LIVE_REVERSE ?? '').trim().toLowerCase();
  return !(v === '0' || v === 'false' || v === 'no' || v === 'off');
}

export type SettleResult =
  | { action: 'none'; reason: 'no_payment' | 'free' | 'not_paid' | 'already_claimed' }
  | { action: 'refund_due'; paymentId: string }
  | { action: 'refunded'; paymentId: string }
  | { action: 'reverse_failed'; paymentId: string; error: string };

export async function settleFailedImportPayment(
  db: RefundDb,
  atmos: Reverser | null,
  userImportId: string,
  reason: string,
  opts: { liveReverse?: boolean; now?: Date } = {},
): Promise<SettleResult> {
  const now = opts.now ?? new Date();
  const payment = await db.importPayment.findFirst({ where: { userImportId } });
  if (!payment) return { action: 'none', reason: 'no_payment' };
  if (!(payment.amountTiyins > 0)) return { action: 'none', reason: 'free' };
  if (payment.status !== ImportPaymentStatus.paid) return { action: 'none', reason: 'not_paid' };

  const live = Boolean(opts.liveReverse && atmos && payment.providerPaymentId && Number(payment.providerPaymentId) > 0);
  const claim = await db.importPayment.updateMany({
    where: { id: payment.id, status: ImportPaymentStatus.paid, refundState: null },
    data: { refundState: live ? 'processing' : 'due', ...(live ? {} : { needsAttention: true }), refundReason: reason.slice(0, 500), refundRequestedAt: now },
  });
  if (claim.count !== 1) return { action: 'none', reason: 'already_claimed' };
  if (!live) return { action: 'refund_due', paymentId: payment.id };

  try {
    await atmos!.reverseTransaction({ transactionId: Number(payment.providerPaymentId), reason: 'Import failed', idempotencyKey: payment.id });
    await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'processing', status: ImportPaymentStatus.paid },
      data: { status: ImportPaymentStatus.refunded, refundState: 'refunded', refundedAt: new Date(), needsAttention: false },
    });
    return { action: 'refunded', paymentId: payment.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Stays claimed (never auto-retried) so an ambiguous provider error can't cause a 2nd reversal.
    await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'processing' },
      data: { refundState: 'reverse_failed', needsAttention: true, refundReason: `${reason.slice(0, 300)} | reverse error: ${msg.slice(0, 180)}` },
    });
    return { action: 'reverse_failed', paymentId: payment.id, error: msg };
  }
}

/**
 * Before a user retry: the retry never charges again. If a refund was only *marked due* (no money
 * moved yet), cancel that mark so the user isn't both refunded and served. If money was (or may
 * have been) returned, the retry is refused — the user must pay again via a fresh quote.
 */
export async function prepareRetryPayment(
  db: RefundDb,
  userImportId: string,
): Promise<{ ok: true; cancelledRefund: boolean } | { ok: false; reason: 'refunded' | 'refund_in_progress' }> {
  const payment = await db.importPayment.findFirst({ where: { userImportId } });
  if (!payment) return { ok: true, cancelledRefund: false };
  if (payment.status === ImportPaymentStatus.refunded || payment.refundState === 'refunded') return { ok: false, reason: 'refunded' };
  if (payment.refundState == null) return { ok: true, cancelledRefund: false };
  if (payment.refundState === 'due') {
    const r = await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'due' },
      data: { refundState: null, refundReason: null, refundRequestedAt: null, needsAttention: false },
    });
    if (r.count === 1) return { ok: true, cancelledRefund: true };
    return { ok: false, reason: 'refund_in_progress' };
  }
  return { ok: false, reason: 'refund_in_progress' };
}
