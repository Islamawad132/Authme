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

  describe('encrypt / decrypt', () => {
    it('should round-trip a plaintext value', () => {
      const plaintext = 'my-webhook-secret';
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });

    it('should not store the plaintext in the ciphertext', () => {
      const plaintext = 'my-webhook-secret';
      const ciphertext = service.encrypt(plaintext);
      expect(ciphertext).not.toContain(plaintext);
    });

    it('should produce different ciphertext on each call (random IV)', () => {
      const plaintext = 'same-value';
      const c1 = service.encrypt(plaintext);
      const c2 = service.encrypt(plaintext);
      expect(c1).not.toBe(c2);
    });

    it('should throw when ciphertext is tampered with', () => {
      const ciphertext = service.encrypt('secret');
      // Flip a byte in the ciphertext (after the IV+tag header)
      const buf = Buffer.from(ciphertext, 'base64');
      buf[buf.length - 1] ^= 0xff;
      const tampered = buf.toString('base64');
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('should handle unicode and long secrets', () => {
      const plaintext = 'unicode-🔑-secret-' + 'x'.repeat(256);
      const ciphertext = service.encrypt(plaintext);
      expect(service.decrypt(ciphertext)).toBe(plaintext);
    });
  });
});
