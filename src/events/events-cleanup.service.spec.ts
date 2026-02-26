import { EventsCleanupService } from './events-cleanup.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../prisma/prisma.mock.js';

describe('EventsCleanupService', () => {
  let service: EventsCleanupService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new EventsCleanupService(prisma as any);
  });

  describe('cleanupExpiredEvents', () => {
    it('should delete expired login and admin events for each realm', async () => {
      const realms = [
        { id: 'realm-1', eventsExpiration: 604800 }, // 7 days
        { id: 'realm-2', eventsExpiration: 86400 },  // 1 day
      ];

      prisma.realm.findMany.mockResolvedValue(realms);
      prisma.loginEvent.deleteMany.mockResolvedValue({ count: 5 });
      prisma.adminEvent.deleteMany.mockResolvedValue({ count: 3 });

      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await service.cleanupExpiredEvents();

      expect(prisma.realm.findMany).toHaveBeenCalledWith({
        where: { eventsEnabled: true },
        select: { id: true, eventsExpiration: true },
      });

      expect(prisma.loginEvent.deleteMany).toHaveBeenCalledTimes(2);
      expect(prisma.adminEvent.deleteMany).toHaveBeenCalledTimes(2);

      // Verify cutoff calculation for first realm (7 days)
      const expectedCutoff1 = new Date(now - 604800 * 1000);
      expect(prisma.loginEvent.deleteMany).toHaveBeenCalledWith({
        where: { realmId: 'realm-1', createdAt: { lt: expectedCutoff1 } },
      });

      jest.restoreAllMocks();
    });

    it('should handle no realms with events enabled', async () => {
      prisma.realm.findMany.mockResolvedValue([]);

      await service.cleanupExpiredEvents();

      expect(prisma.loginEvent.deleteMany).not.toHaveBeenCalled();
      expect(prisma.adminEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle zero deleted events silently', async () => {
      prisma.realm.findMany.mockResolvedValue([
        { id: 'realm-1', eventsExpiration: 86400 },
      ]);
      prisma.loginEvent.deleteMany.mockResolvedValue({ count: 0 });
      prisma.adminEvent.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.cleanupExpiredEvents()).resolves.toBeUndefined();
    });
  });
});
