import type { PrismaService } from '../../prisma/prisma.service';

/** Append a completed reading slice so Statistics charts can bucket minutes by day. */
export async function recordReadingActivity(
  prisma: PrismaService,
  userId: string,
  contentId: string,
  segmentId: string | undefined,
  readSeconds: number | undefined,
) {
  if (!readSeconds || readSeconds <= 0) return;

  const now = new Date();
  await prisma.readingSession.create({
    data: {
      userId,
      contentId,
      segmentId: segmentId ?? null,
      startedAt: now,
      endedAt: now,
      durationSeconds: readSeconds,
    },
  });
}
