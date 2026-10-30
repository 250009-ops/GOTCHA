/**
 * One-off (REVIEW-p2b n-3): encrypt play_purchases.purchase_token rows still stored in plaintext.
 * Run once after PLAY_TOKEN_KEY is set:  PLAY_TOKEN_KEY=... npx ts-node --transpile-only scripts/backfill-play-tokens.ts
 * Idempotent: rows already sealed ("enc:v1:") are skipped.
 */
import { PrismaClient } from '@prisma/client';
import { sealToken } from '../src/modules/billing/google-play.client';

async function main() {
  const prisma = new PrismaClient();
  let n = 0;
  try {
    for (;;) {
      const rows = await prisma.playPurchase.findMany({ where: { NOT: { purchaseToken: { startsWith: 'enc:v1:' } } }, take: 500, select: { tokenHash: true, purchaseToken: true } });
      if (!rows.length) break;
      for (const r of rows) {
        await prisma.playPurchase.updateMany({ where: { tokenHash: r.tokenHash, purchaseToken: r.purchaseToken }, data: { purchaseToken: sealToken(r.purchaseToken) } });
        n++;
      }
    }
    console.log(`sealed ${n} purchase tokens`);
  } finally {
    await prisma.$disconnect();
  }
}
void main().catch((e) => { console.error(e); process.exit(1); });
