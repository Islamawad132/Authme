import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EventsCleanupService {
  private readonly logger = new Logger(EventsCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Interval(3600_000) // every hour
  async cleanupExpiredEvents(): Promise<void> {
    const realms = await this.prisma.realm.findMany({
      where: { eventsEnabled: true },
      select: { id: true, eventsExpiration: true },
    });

    for (const realm of realms) {
      const cutoff = new Date(Date.now() - realm.eventsExpiration * 1000);

      const loginResult = await this.prisma.loginEvent.deleteMany({
        where: { realmId: realm.id, createdAt: { lt: cutoff } },
      });

      const adminResult = await this.prisma.adminEvent.deleteMany({
        where: { realmId: realm.id, createdAt: { lt: cutoff } },
      });

      if (loginResult.count > 0 || adminResult.count > 0) {
        this.logger.debug(
          `Cleaned up ${loginResult.count} login events and ${adminResult.count} admin events for realm ${realm.id}`,
        );
      }
    }
  }
}
