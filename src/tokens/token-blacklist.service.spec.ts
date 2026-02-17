import { TokenBlacklistService } from './token-blacklist.service.js';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  beforeEach(() => {
    service = new TokenBlacklistService();
  });

  afterEach(() => {
    // Clean up the interval to prevent leaking timers
    service.onModuleDestroy();
  });

  // ─── blacklistToken ─────────────────────────────────────────

  describe('blacklistToken', () => {
    it('should add token to blacklist and isBlacklisted returns true', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      service.blacklistToken('jti-1', exp);

      expect(service.isBlacklisted('jti-1')).toBe(true);
    });

    it('should handle multiple tokens', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;

      service.blacklistToken('jti-1', exp);
      service.blacklistToken('jti-2', exp);

      expect(service.isBlacklisted('jti-1')).toBe(true);
      expect(service.isBlacklisted('jti-2')).toBe(true);
    });
  });

  // ─── isBlacklisted ──────────────────────────────────────────

  describe('isBlacklisted', () => {
    it('should return false for an unknown jti', () => {
      expect(service.isBlacklisted('unknown-jti')).toBe(false);
    });

    it('should return true for a blacklisted jti even if expired', () => {
      // Note: isBlacklisted only checks presence in the Map.
      // Expired entries are removed by cleanup(), not by isBlacklisted().
      const expiredExp = Math.floor(Date.now() / 1000) - 100;

      service.blacklistToken('expired-jti', expiredExp);

      expect(service.isBlacklisted('expired-jti')).toBe(true);
    });
  });

  // ─── cleanup ────────────────────────────────────────────────

  describe('cleanup (private, tested via timer)', () => {
    it('should remove expired entries and keep non-expired ones', () => {
      jest.useFakeTimers();

      // Create a fresh service so its interval uses fake timers
      const timedService = new TokenBlacklistService();

      const expiredExp = Math.floor(Date.now() / 1000) - 100; // already expired
      const validExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      timedService.blacklistToken('expired-jti', expiredExp);
      timedService.blacklistToken('valid-jti', validExp);

      expect(timedService.isBlacklisted('expired-jti')).toBe(true);
      expect(timedService.isBlacklisted('valid-jti')).toBe(true);

      // Advance time to trigger the cleanup interval (60 seconds)
      jest.advanceTimersByTime(60_000);

      expect(timedService.isBlacklisted('expired-jti')).toBe(false);
      expect(timedService.isBlacklisted('valid-jti')).toBe(true);

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
