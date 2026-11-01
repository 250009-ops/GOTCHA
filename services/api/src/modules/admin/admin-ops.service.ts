import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ImportPaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportCommerceService } from '../billing/import-commerce.service';

const envFlagTrue = (v?: string) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());

/**
 * Lean-admin operations (DESIGN-practice §9): payments + refunds, learner export, and the AuditLog writes that
 * every destructive/finance action needs.
 */
@Injectable()
export class AdminOpsService {
  constructor(
    private prisma: PrismaService,
    private commerce: ImportCommerceService,
  ) {}

  audit(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog
      .create({ data: { actorId, action, entityType, entityId, metadata } })
      .catch(() => undefined); // auditing must never break the action itself
  }

  /** Finance/pricing changes: the audit row must exist, so errors propagate (REVIEW B2 spirit). */
  auditStrict(actorId: string | null, action: string, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
  }

  /** Everything we hold about a learner, as one JSON document (data-subject access / export request). */
  async exportUser(actorId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        preferences: true,
        targetLanguages: true,
        subscriptions: true,
        vocabulary: { include: { reviews: true } },
        readingProgress: true,
        practiceSessions: true,
        imports: true,
        importPayments: { omit: { rawCreateJson: true, rawCallbackJson: true, providerInvoiceToken: true } },
        notifications: true,
      },
      omit: { passwordHash: true },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.audit(actorId, 'user.export', 'user', id);
    return { exportedAt: new Date().toISOString(), format: 'gotcha-user-export/v1', user };
  }

  async listPayments(q: { status?: string; q?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(q.page) || 1);
    const pageSize = Math.min(100, Math.max(5, Number(q.pageSize) || 25));
    const where: Prisma.ImportPaymentWhereInput = {};
    if (q.status && (Object.values(ImportPaymentStatus) as string[]).includes(q.status)) where.status = q.status as ImportPaymentStatus;
    const term = (q.q ?? '').trim();
    if (term) {
      where.OR = [
        { account: { contains: term, mode: 'insensitive' } },
        { providerPaymentId: { contains: term, mode: 'insensitive' } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [total, rows, sums] = await Promise.all([
      this.prisma.importPayment.count({ where }),
      this.prisma.importPayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, status: true, importType: true, contentFormat: true, estimatedPages: true, amountTiyins: true,
          currency: true, provider: true, account: true, providerPaymentId: true, needsAttention: true, createdAt: true, paidAt: true,
          user: { select: { id: true, email: true, displayName: true } },
        },
      }),
      this.prisma.importPayment.groupBy({ by: ['status'], _sum: { amountTiyins: true }, _count: { _all: true } }),
    ]);
    const summary = Object.fromEntries(sums.map((s) => [s.status, { count: s._count._all, amountUzs: Math.round((s._sum.amountTiyins ?? 0) / 100) }]));
    return {
      page, pageSize, total,
      gatewayEnabled: envFlagTrue(process.env.PAYMENT_GATEWAY_ENABLED),
      sandbox: this.isSandbox(),
      summary,
      items: rows.map((r) => ({ ...r, amountUzs: Math.round(r.amountTiyins / 100) })),
    };
  }

  /** M1: explicit only; unset ⇒ not test mode. */
  private isSandbox() {
    return envFlagTrue(process.env.ATMOS_SANDBOX);
  }


  /**
   * Admin-only refund (BUG-06). Atmos test mode: reverses via Atmos when a transaction id exists, otherwise records
   * the refund locally. Live mode requires a transaction to reverse. Revokes catalog access and writes AuditLog.
   * Partial refunds are not supported by Atmos reverse, so only the full amount is accepted.
   */
  async refundPayment(actorId: string, id: string, body: { reason?: string; amountUzs?: number }, idempotencyKey?: string) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('A refund reason is required.');
    const p = await this.prisma.importPayment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    const full = Math.round(p.amountTiyins / 100);
    if (body.amountUzs != null && Math.round(Number(body.amountUzs)) !== full) {
      throw new BadRequestException(`Only full refunds are supported (${full} UZS).`);
    }
    // Claim → reverse → finalize + AuditLog in one transaction (REVIEW B2) lives in the commerce service.
    const res = await this.commerce.refundPaidPayment(id, { reason, actorId, idempotencyKey });
    return {
      ...res,
      amountUzs: full,
      sandbox: this.isSandbox(),
      note: res.alreadyRefunded ? 'Already refunded.' : res.reversedAtAtmos ? 'Refunded via Atmos.' : 'Test-mode refund recorded locally; no money moved.',
    };
  }

  reconcileRefunds() {
    return this.commerce.reconcileStaleRefunds(0);
  }

  /** Close a refund that Atmos already accepted, or that an admin confirms by typing a reason. Paid rows are refused. */
  async finalizeRefund(actorId: string, id: string, body: { reason?: string }) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('A refund reason is required.');
    const payment = await this.prisma.importPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
      throw new BadRequestException('A paid payment is not waiting to be closed. Refund it first.');
    }
    if (payment.status === ImportPaymentStatus.refunded) return { id, status: 'refunded', already: true };
    if (payment.status !== ImportPaymentStatus.refunding) {
      throw new BadRequestException('Only a refund that is still processing can be marked completed.');
    }
    const moved = await this.prisma.importPayment.updateMany({
      where: { id, status: ImportPaymentStatus.refunding },
      data: {
        status: ImportPaymentStatus.refunded,
        refundState: 'refunded',
        refundedAt: new Date(),
        refundReason: reason,
        needsAttention: false,
      },
    });
    if (!moved.count) throw new ConflictException('This refund was already closed.');
    await this.auditStrict(actorId, 'payment.refund.finalize', 'import_payment', id, { reason });
    return { id, status: 'refunded', note: 'Refund closed as completed.' };
  }
}
