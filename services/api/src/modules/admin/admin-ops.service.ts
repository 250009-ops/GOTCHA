import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
          currency: true, provider: true, account: true, providerPaymentId: true, createdAt: true, paidAt: true,
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

  /** Atmos runs in test mode until go-live; refunds are only allowed there (and are a local status change). */
  private isSandbox() {
    if (process.env.ATMOS_SANDBOX !== undefined) return envFlagTrue(process.env.ATMOS_SANDBOX);
    return true; // safe default until the production merchant contract is signed
  }

  /**
   * Admin-only refund (BUG-06). Atmos test mode: reverses via Atmos when a transaction id exists, otherwise records
   * the refund locally. Live mode requires a transaction to reverse. Revokes catalog access and writes AuditLog.
   * Partial refunds are not supported by Atmos reverse, so only the full amount is accepted.
   */
  async refundPayment(actorId: string, id: string, body: { reason?: string; amountUzs?: number }) {
    const reason = String(body.reason ?? '').trim();
    if (reason.length < 3) throw new BadRequestException('A refund reason is required.');
    const p = await this.prisma.importPayment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    const full = Math.round(p.amountTiyins / 100);
    if (body.amountUzs != null && Math.round(Number(body.amountUzs)) !== full) {
      throw new BadRequestException(`Only full refunds are supported (${full} UZS).`);
    }
    const sandbox = this.isSandbox();
    const res = await this.commerce.refundPaidPayment(id, { reason, sandbox });
    await this.audit(actorId, 'payment.refund', 'import_payment', id, {
      reason, amountUzs: full, sandbox, reversedAtAtmos: res.reversedAtAtmos, accessRevoked: res.accessRevoked, userId: p.userId,
    });
    return {
      ...res,
      amountUzs: full,
      sandbox,
      note: res.reversedAtAtmos ? 'Refunded via Atmos.' : 'Test-mode refund recorded locally; no money moved.',
    };
  }
}
