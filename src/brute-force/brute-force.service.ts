import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Realm, User } from '@prisma/client';

@Injectable()
export class BruteForceService {
  private readonly logger = new Logger(BruteForceService.name);

  constructor(private readonly prisma: PrismaService) {}

  checkLocked(realm: Realm, user: User): { locked: boolean; lockedUntil?: Date } {
    if (!realm.bruteForceEnabled) return { locked: false };
    if (!user.lockedUntil) return { locked: false };

    if (user.lockedUntil > new Date()) {
      return { locked: true, lockedUntil: user.lockedUntil };
    }

    return { locked: false };
  }

  async recordFailure(realm: Realm, userId: string, ipAddress?: string | null): Promise<void> {
    if (!realm.bruteForceEnabled) return;

    await this.prisma.loginFailure.create({
      data: { realmId: realm.id, userId, ipAddress: ipAddress ?? null },
    });

    // Count recent failures within the reset window
    const windowStart = new Date(Date.now() - realm.failureResetTime * 1000);
    const failureCount = await this.prisma.loginFailure.count({
      where: {
        realmId: realm.id,
        userId,
        failedAt: { gte: windowStart },
      },
    });

    if (failureCount >= realm.maxLoginFailures) {
      // Check if permanent lockout is configured
      if (realm.permanentLockoutAfter > 0) {
        // Count total lockouts (approximate by counting failure bursts)
        const totalFailures = await this.prisma.loginFailure.count({
          where: { realmId: realm.id, userId },
        });
        const lockoutCount = Math.floor(totalFailures / realm.maxLoginFailures);

        if (lockoutCount >= realm.permanentLockoutAfter) {
          // Permanent lock — set far future date
          await this.prisma.user.update({
            where: { id: userId },
            data: { lockedUntil: new Date('2099-12-31T23:59:59Z'), enabled: false },
          });
          return;
        }
      }

      const lockedUntil = new Date(Date.now() + realm.lockoutDuration * 1000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil },
      });
    }
  }

  async resetFailures(realmId: string, userId: string): Promise<void> {
    await this.prisma.loginFailure.deleteMany({
      where: { realmId, userId },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null },
    });
  }

  async unlockUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lockedUntil: null },
    });
  }

  async getLockedUsers(realmId: string) {
    return this.prisma.user.findMany({
      where: {
        realmId,
        lockedUntil: { gt: new Date() },
      },
      select: {
        id: true,
        username: true,
        email: true,
        lockedUntil: true,
      },
    });
  }

  @Interval(300_000) // every 5 minutes
  async cleanupOldFailures(): Promise<void> {
    // Delete login failures older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.loginFailure.deleteMany({
      where: { failedAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.debug(`Cleaned up ${count} old login failure records`);
    }
  }
}
