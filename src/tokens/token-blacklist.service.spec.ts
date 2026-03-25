import { TokenBlacklistService } from './token-blacklist.service.js';

const createMockRedisService = () => ({
  isAvailable: jest.fn().mockReturnValue(false),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  exists: jest.fn().mockResolvedValue(false),
  del: jest.fn().mockResolvedValue(undefined),
});

const createMockPrismaService = () => ({
  revokedToken: {
    upsert: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
});

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  beforeEach(async () => {
    service = new TokenBlacklistService(
      createMockRedisService() as any,
      createMockPrismaService() as any,
    );
    await service.onModuleInit();
  });

  afterEach(() => {
    // Clean up the interval to prevent leaking timers
    service.onModuleDestroy();
  });

  // ─── blacklistToken ─────────────────────────────────────────

  describe('blacklistToken', () => {
    it('should add token to blacklist and isBlacklisted returns true', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await service.blacklistToken('jti-1', exp);

      expect(await service.isBlacklisted('jti-1')).toBe(true);
    });

    it('should handle multiple tokens', async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.blacklistToken('jti-1', exp);
      await service.blacklistToken('jti-2', exp);

      expect(await service.isBlacklisted('jti-1')).toBe(true);
      expect(await service.isBlacklisted('jti-2')).toBe(true);
    });
  });

  // ─── isBlacklisted ──────────────────────────────────────────

  describe('isBlacklisted', () => {
    it('should return false for an unknown jti', async () => {
      expect(await service.isBlacklisted('unknown-jti')).toBe(false);
    });

    it('should return true for a blacklisted jti even if expired', async () => {
      // Note: isBlacklisted only checks presence in the Map.
      // Expired entries are removed by cleanup(), not by isBlacklisted().
      const expiredExp = Math.floor(Date.now() / 1000) - 100;

      // blacklistToken skips already-expired tokens (ttl <= 0), so we
      // directly populate the internal memory fallback to simulate a token
      // that was added before it expired.
      (service as any).memoryFallback.set('expired-jti', expiredExp);

      expect(await service.isBlacklisted('expired-jti')).toBe(true);
    });
  });

  // ─── cleanup ────────────────────────────────────────────────

  describe('cleanup (private, tested via timer)', () => {
    it('should remove expired entries and keep non-expired ones', async () => {
      jest.useFakeTimers();

      // Create a fresh service so its interval uses fake timers
      const timedService = new TokenBlacklistService(
        createMockRedisService() as any,
        createMockPrismaService() as any,
      );
      await timedService.onModuleInit();

      const expiredExp = Math.floor(Date.now() / 1000) - 100; // already expired
      const validExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Directly populate memory fallback since blacklistToken skips expired tokens
      (timedService as any).memoryFallback.set('expired-jti', expiredExp);
      // Add a valid token through normal path
      (timedService as any).memoryFallback.set('valid-jti', validExp);

      expect(await timedService.isBlacklisted('expired-jti')).toBe(true);
      expect(await timedService.isBlacklisted('valid-jti')).toBe(true);

      // Advance time to trigger the cleanup interval (60 seconds)
      jest.advanceTimersByTime(60_000);

      // Allow the async cleanup to flush
      await Promise.resolve();

      expect(await timedService.isBlacklisted('expired-jti')).toBe(false);
      expect(await timedService.isBlacklisted('valid-jti')).toBe(true);

      timedService.onModuleDestroy();
      jest.useRealTimers();
    });
  });

  // ─── onModuleDestroy ────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should clear the cleanup interval', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      service.onModuleDestroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
