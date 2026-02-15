import { CryptoService } from './crypto.service.js';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService();
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify a password correctly', async () => {
      const hash = await service.hashPassword('password123');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('password123');

      const valid = await service.verifyPassword(hash, 'password123');
      expect(valid).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hash = await service.hashPassword('password123');
      const valid = await service.verifyPassword(hash, 'wrongpassword');
      expect(valid).toBe(false);
    });

    it('should produce different hashes for the same password', async () => {
      const hash1 = await service.hashPassword('password123');
      const hash2 = await service.hashPassword('password123');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateSecret', () => {
    it('should generate a hex string of the expected length', () => {
      const secret = service.generateSecret(16);
      expect(secret).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should default to 32 bytes', () => {
      const secret = service.generateSecret();
      expect(secret).toHaveLength(64); // 32 bytes = 64 hex chars
    });

    it('should generate unique values', () => {
      const a = service.generateSecret();
      const b = service.generateSecret();
      expect(a).not.toBe(b);
    });
  });

  describe('sha256', () => {
    it('should return consistent hash for the same input', () => {
      const hash1 = service.sha256('test');
      const hash2 = service.sha256('test');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = service.sha256('test1');
      const hash2 = service.sha256('test2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string', () => {
      const hash = service.sha256('test');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });
});
