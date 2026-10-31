import { ImportPaymentStatus } from '@prisma/client';

/**
 * Import-failure refunds (import-p0).
 *
 * Exactly-once: the refund is *claimed* with a conditional update
 * (`status = paid AND refund_state IS NULL`). Only the caller whose update hits one row may act,
 * so a reaper + worker race, a duplicate retry, or a re-run can never refund twice.
 *
 * Live reversal (Atmos /merchant/pay/reverse) only runs when IMPORT_REFUND_LIVE_REVERSE=true.
 * Default: the payment is marked refund_state = 'due' for an admin/finance run — safer until the
 * reverse path has been exercised against the Atmos sandbox.
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
  reverseTransaction(p: { transactionId: number; reason?: string }): Promise<unknown>;
}

export function liveReverseEnabled(env = process.env): boolean {
  const v = (env.IMPORT_REFUND_LIVE_REVERSE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
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
    data: { refundState: live ? 'processing' : 'due', refundReason: reason.slice(0, 500), refundRequestedAt: now },
  });
  if (claim.count !== 1) return { action: 'none', reason: 'already_claimed' };
  if (!live) return { action: 'refund_due', paymentId: payment.id };

  try {
    await atmos!.reverseTransaction({ transactionId: Number(payment.providerPaymentId), reason: 'Import failed' });
    await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'processing' },
      data: { status: ImportPaymentStatus.refunded, refundState: 'refunded', refundedAt: new Date() },
    });
    return { action: 'refunded', paymentId: payment.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Stays claimed (never auto-retried) so an ambiguous provider error can't cause a 2nd reversal.
    await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'processing' },
      data: { refundState: 'reverse_failed', refundReason: `${reason.slice(0, 300)} | reverse error: ${msg.slice(0, 180)}` },
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
  if (!payment || payment.refundState == null) return { ok: true, cancelledRefund: false };
  if (payment.refundState === 'due') {
    const r = await db.importPayment.updateMany({
      where: { id: payment.id, refundState: 'due' },
      data: { refundState: null, refundReason: null, refundRequestedAt: null },
    });
    if (r.count === 1) return { ok: true, cancelledRefund: true };
    return { ok: false, reason: 'refund_in_progress' };
  }
  if (payment.refundState === 'refunded' || payment.status === ImportPaymentStatus.refunded) return { ok: false, reason: 'refunded' };
  return { ok: false, reason: 'refund_in_progress' };
}
