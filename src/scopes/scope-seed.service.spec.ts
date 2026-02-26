import { ScopeSeedService } from './scope-seed.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../prisma/prisma.mock.js';

describe('ScopeSeedService', () => {
  let service: ScopeSeedService;
  let prisma: MockPrismaService;

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new ScopeSeedService(prisma as any);
  });

  describe('seedDefaultScopes', () => {
    it('should create all default and optional scopes', async () => {
      prisma.clientScope.findUnique.mockResolvedValue(null);
      prisma.clientScope.create.mockResolvedValue({});

      await service.seedDefaultScopes('realm-1');

      // 4 default + 2 optional = 6 scopes
      expect(prisma.clientScope.create).toHaveBeenCalledTimes(6);
    });

    it('should skip existing scopes', async () => {
      // First two scopes exist, rest don't
      prisma.clientScope.findUnique
        .mockResolvedValueOnce({ id: 'existing-1' }) // openid exists
        .mockResolvedValueOnce({ id: 'existing-2' }) // profile exists
        .mockResolvedValue(null); // rest don't exist

      prisma.clientScope.create.mockResolvedValue({});

      await service.seedDefaultScopes('realm-1');

      // 6 total - 2 existing = 4 created
      expect(prisma.clientScope.create).toHaveBeenCalledTimes(4);
    });

    it('should create scopes with protocol mappers', async () => {
      prisma.clientScope.findUnique.mockResolvedValue(null);
      prisma.clientScope.create.mockResolvedValue({});

      await service.seedDefaultScopes('realm-1');

      // Check that openid scope includes 'sub' mapper
      expect(prisma.clientScope.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'openid',
            builtIn: true,
            protocolMappers: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ name: 'sub' }),
              ]),
            }),
          }),
        }),
      );

      // Profile scope should have multiple mappers
      expect(prisma.clientScope.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'profile',
            protocolMappers: expect.objectContaining({
              create: expect.arrayContaining([
                expect.objectContaining({ name: 'username' }),
                expect.objectContaining({ name: 'full name' }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should check for existing scopes by realmId and name', async () => {
      prisma.clientScope.findUnique.mockResolvedValue(null);
      prisma.clientScope.create.mockResolvedValue({});

      await service.seedDefaultScopes('realm-1');

      expect(prisma.clientScope.findUnique).toHaveBeenCalledWith({
        where: { realmId_name: { realmId: 'realm-1', name: 'openid' } },
      });
    });

    it('should skip all scopes when they already exist', async () => {
      prisma.clientScope.findUnique.mockResolvedValue({ id: 'existing' });

      await service.seedDefaultScopes('realm-1');

      expect(prisma.clientScope.create).not.toHaveBeenCalled();
    });
  });

  describe('getDefaultScopeNames', () => {
    it('should return default scope names', () => {
      const names = service.getDefaultScopeNames();

      expect(names).toContain('openid');
      expect(names).toContain('profile');
      expect(names).toContain('email');
      expect(names).toContain('roles');
      expect(names).toHaveLength(4);
    });
  });

  describe('getOptionalScopeNames', () => {
    it('should return optional scope names', () => {
      const names = service.getOptionalScopeNames();

      expect(names).toContain('web-origins');
      expect(names).toContain('offline_access');
      expect(names).toHaveLength(2);
    });
  });
});
