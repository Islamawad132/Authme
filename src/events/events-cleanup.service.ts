import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

const SECONDS_PER_DAY = 86_400;

@Injectable()
export class EventsCleanupService {
  private readonly logger = new Logger(EventsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Interval(3600_000) // every hour
  async cleanupExpiredEvents(): Promise<void> {
    const realms = await this.prisma.realm.findMany({
      where: { eventsEnabled: true },
      select: {
        id: true,
        eventsExpiration: true,
        loginEventRetentionDays: true,
        adminEventRetentionDays: true,
      },
    });

    for (const realm of realms) {
      // loginEventRetentionDays takes priority over the legacy eventsExpiration when set > 0
      const loginRetentionSeconds =
        realm.loginEventRetentionDays > 0
          ? realm.loginEventRetentionDays * SECONDS_PER_DAY
          : realm.eventsExpiration;

      const adminRetentionSeconds =
        realm.adminEventRetentionDays > 0
          ? realm.adminEventRetentionDays * SECONDS_PER_DAY
          : realm.eventsExpiration;

      const loginCutoff = new Date(Date.now() - loginRetentionSeconds * 1000);
      const adminCutoff = new Date(Date.now() - adminRetentionSeconds * 1000);

      const loginResult = await this.prisma.loginEvent.deleteMany({
        where: { realmId: realm.id, createdAt: { lt: loginCutoff } },
      });

      const adminResult = await this.prisma.adminEvent.deleteMany({
        where: { realmId: realm.id, createdAt: { lt: adminCutoff } },
      });

      if (loginResult.count > 0 || adminResult.count > 0) {
        this.logger.debug(
          `Cleaned up ${loginResult.count} login events and ${adminResult.count} admin events for realm ${realm.id}`,
        );
      }
    }
  }
}
