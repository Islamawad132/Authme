// Mock JwkService module to avoid importing jose (ESM-only)
jest.mock('../crypto/jwk.service.js', () => ({
  JwkService: jest.fn(),
}));

import { EventsService } from './events.service.js';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../prisma/prisma.mock.js';
import { LoginEventType, OperationType, ResourceType } from './event-types.js';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new EventsService(prisma as any);
  });

  // ─── recordLoginEvent ─────────────────────────────────────

  describe('recordLoginEvent', () => {
    const loginParams = {
      realmId: 'realm-1',
      userId: 'user-1',
      sessionId: 'session-1',
      type: LoginEventType.LOGIN,
      clientId: 'my-app',
      ipAddress: '127.0.0.1',
    };

    it('should create event when realm.eventsEnabled is true', async () => {
      prisma.realm.findUnique.mockResolvedValue({ eventsEnabled: true });
      prisma.loginEvent.create.mockResolvedValue({});

      await service.recordLoginEvent(loginParams);

      expect(prisma.realm.findUnique).toHaveBeenCalledWith({
        where: { id: 'realm-1' },
        select: { eventsEnabled: true },
      });
      expect(prisma.loginEvent.create).toHaveBeenCalledWith({
        data: {
          realmId: 'realm-1',
          userId: 'user-1',
          sessionId: 'session-1',
          type: 'LOGIN',
          clientId: 'my-app',
          ipAddress: '127.0.0.1',
          error: undefined,
          details: undefined,
        },
      });
    });

    it('should NOT create event when realm.eventsEnabled is false', async () => {
      prisma.realm.findUnique.mockResolvedValue({ eventsEnabled: false });

      await service.recordLoginEvent(loginParams);

      expect(prisma.loginEvent.create).not.toHaveBeenCalled();
    });

    it('should not throw when prisma.create fails (fire-and-forget)', async () => {
      prisma.realm.findUnique.mockResolvedValue({ eventsEnabled: true });
      prisma.loginEvent.create.mockRejectedValue(new Error('DB write failed'));

      await expect(
        service.recordLoginEvent(loginParams),
      ).resolves.toBeUndefined();
    });
  });

  // ─── recordAdminEvent ─────────────────────────────────────

  describe('recordAdminEvent', () => {
    const adminParams = {
      realmId: 'realm-1',
      adminUserId: 'admin-1',
      operationType: OperationType.CREATE,
      resourceType: ResourceType.USER,
      resourcePath: '/users/user-1',
      ipAddress: '10.0.0.1',
    };

    it('should create event when realm.adminEventsEnabled is true', async () => {
      prisma.realm.findUnique.mockResolvedValue({ adminEventsEnabled: true });
      prisma.adminEvent.create.mockResolvedValue({});

      await service.recordAdminEvent(adminParams);

      expect(prisma.realm.findUnique).toHaveBeenCalledWith({
        where: { id: 'realm-1' },
        select: { adminEventsEnabled: true },
      });
      expect(prisma.adminEvent.create).toHaveBeenCalledWith({
        data: {
          realmId: 'realm-1',
          adminUserId: 'admin-1',
          operationType: 'CREATE',
          resourceType: 'USER',
          resourcePath: '/users/user-1',
          representation: undefined,
          ipAddress: '10.0.0.1',
        },
      });
    });

    it('should NOT create event when realm.adminEventsEnabled is false', async () => {
      prisma.realm.findUnique.mockResolvedValue({ adminEventsEnabled: false });

      await service.recordAdminEvent(adminParams);

      expect(prisma.adminEvent.create).not.toHaveBeenCalled();
    });
  });

  // ─── queryLoginEvents ─────────────────────────────────────

  describe('queryLoginEvents', () => {
    it('should query with correct filters', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-12-31');
      const mockEvents = [{ id: 'evt-1', type: 'LOGIN' }];
      prisma.loginEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.queryLoginEvents({
        realmId: 'realm-1',
        type: 'LOGIN',
        userId: 'user-1',
        clientId: 'my-app',
        dateFrom,
        dateTo,
        first: 10,
        max: 50,
      });

      expect(result).toEqual(mockEvents);
      expect(prisma.loginEvent.findMany).toHaveBeenCalledWith({
        where: {
          realmId: 'realm-1',
          type: 'LOGIN',
          userId: 'user-1',
          clientId: 'my-app',
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 50,
      });
    });
  });

  // ─── clearLoginEvents ─────────────────────────────────────

  describe('clearLoginEvents', () => {
    it('should delete events for the given realm', async () => {
      prisma.loginEvent.deleteMany.mockResolvedValue({ count: 5 });

      await service.clearLoginEvents('realm-1');

      expect(prisma.loginEvent.deleteMany).toHaveBeenCalledWith({
        where: { realmId: 'realm-1' },
      });
    });
  });

  // ─── queryAdminEvents ─────────────────────────────────────

  describe('queryAdminEvents', () => {
    it('should query with correct filters', async () => {
      const dateFrom = new Date('2025-01-01');
      const dateTo = new Date('2025-12-31');
      const mockEvents = [{ id: 'aevt-1', operationType: 'CREATE' }];
      prisma.adminEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.queryAdminEvents({
        realmId: 'realm-1',
        operationType: 'CREATE',
        resourceType: 'USER',
        dateFrom,
        dateTo,
        first: 0,
        max: 25,
      });

      expect(result).toEqual(mockEvents);
      expect(prisma.adminEvent.findMany).toHaveBeenCalledWith({
        where: {
          realmId: 'realm-1',
          operationType: 'CREATE',
          resourceType: 'USER',
          createdAt: {
            gte: dateFrom,
            lte: dateTo,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 25,
      });
    });
  });
});
