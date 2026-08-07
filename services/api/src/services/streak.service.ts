import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StreakService {
  constructor(private prisma: PrismaService) {}

  async recordActivity(userId: string, minutesRead = 0) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const last = user.streakLastDate ? new Date(user.streakLastDate) : null;
    if (last) last.setHours(0, 0, 0, 0);

    let streakCount = user.streakCount;
    if (!last) {
      streakCount = 1;
    } else {
      const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000);
      if (diffDays === 0) {
        // same day — keep streak
      } else if (diffDays === 1) {
        streakCount += 1;
      } else {
        streakCount = 1;
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        streakCount,
        streakLastDate: today,
      },
    });

    return { streakCount, minutesRead };
  }
}
