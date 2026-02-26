import { UnauthorizedException } from '@nestjs/common';

jest.mock('../crypto/jwk.service.js', () => ({
  JwkService: jest.fn(),
}));

import { AdminAuthService } from './admin-auth.service.js';
import {
  createMockPrismaService,
  type MockPrismaService,
} from '../prisma/prisma.mock.js';

const masterRealm = {
  id: 'master-id',
  name: 'master',
  enabled: true,
};

const signingKey = {
  id: 'key-1',
  realmId: 'master-id',
  kid: 'kid-1',
  algorithm: 'RS256',
  publicKey: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
  privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
  active: true,
  createdAt: new Date(),
};

const adminUser = {
  id: 'user-1',
  realmId: 'master-id',
  username: 'admin',
  enabled: true,
  passwordHash: 'hashed-password',
};

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let prisma: MockPrismaService;
  let crypto: { hashPassword: jest.Mock; verifyPassword: jest.Mock };
  let jwkService: { signJwt: jest.Mock; verifyJwt: jest.Mock };

  beforeEach(() => {
    prisma = createMockPrismaService();
    crypto = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };
    jwkService = {
      signJwt: jest.fn(),
      verifyJwt: jest.fn(),
    };

    service = new AdminAuthService(prisma as any, crypto as any, jwkService as any);
  });

  // ─── login ─────────────────────────────────────────────

  describe('login', () => {
    it('should return access token on valid credentials', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(true);
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'super-admin' } },
      ]);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.signJwt.mockResolvedValue('jwt-token');

      const result = await service.login('admin', 'password');

      expect(result).toEqual({
        access_token: 'jwt-token',
        token_type: 'Bearer',
        expires_in: 3600,
      });
      expect(prisma.realm.findUnique).toHaveBeenCalledWith({ where: { name: 'master' } });
      expect(crypto.verifyPassword).toHaveBeenCalledWith('hashed-password', 'password');
    });

    it('should throw if master realm does not exist', async () => {
      prisma.realm.findUnique.mockResolvedValue(null);

      await expect(service.login('admin', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login('admin', 'password')).rejects.toThrow(
        'Admin system not initialized',
      );
    });

    it('should throw if user not found', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('unknown', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if user is disabled', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue({ ...adminUser, enabled: false });

      await expect(service.login('admin', 'password')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw if user has no password hash', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue({ ...adminUser, passwordHash: null });

      await expect(service.login('admin', 'password')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw if password is invalid', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(false);

      await expect(service.login('admin', 'wrong')).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('should throw if user has no admin role', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(true);
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'regular-user' } },
      ]);

      await expect(service.login('admin', 'password')).rejects.toThrow(
        'User does not have admin access',
      );
    });

    it('should throw if no signing key found', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(true);
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'realm-admin' } },
      ]);
      prisma.realmSigningKey.findFirst.mockResolvedValue(null);

      await expect(service.login('admin', 'password')).rejects.toThrow(
        'No signing key found for master realm',
      );
    });

    it('should accept realm-admin role', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(true);
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'realm-admin' } },
      ]);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.signJwt.mockResolvedValue('jwt-token');

      const result = await service.login('admin', 'password');
      expect(result.access_token).toBe('jwt-token');
    });

    it('should accept view-only role', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.user.findUnique.mockResolvedValue(adminUser);
      crypto.verifyPassword.mockResolvedValue(true);
      prisma.userRole.findMany.mockResolvedValue([
        { role: { name: 'view-only' } },
      ]);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.signJwt.mockResolvedValue('jwt-token');

      const result = await service.login('admin', 'password');
      expect(result.access_token).toBe('jwt-token');
    });
  });

  // ─── validateAdminToken ───────────────────────────────

  describe('validateAdminToken', () => {
    it('should return userId and roles for a valid admin token', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.verifyJwt.mockResolvedValue({
        typ: 'admin',
        sub: 'user-1',
        realm_access: { roles: ['super-admin'] },
      });

      const result = await service.validateAdminToken('valid-token');

      expect(result).toEqual({
        userId: 'user-1',
        roles: ['super-admin'],
      });
    });

    it('should throw if master realm does not exist', async () => {
      prisma.realm.findUnique.mockResolvedValue(null);

      await expect(service.validateAdminToken('token')).rejects.toThrow(
        'Admin system not initialized',
      );
    });

    it('should throw if no signing key found', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.realmSigningKey.findFirst.mockResolvedValue(null);

      await expect(service.validateAdminToken('token')).rejects.toThrow(
        'No signing key found',
      );
    });

    it('should throw if token type is not admin', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.verifyJwt.mockResolvedValue({
        typ: 'Bearer',
        sub: 'user-1',
      });

      await expect(service.validateAdminToken('token')).rejects.toThrow(
        'Invalid admin token',
      );
    });

    it('should throw if JWT verification fails', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.verifyJwt.mockRejectedValue(new Error('Invalid JWT'));

      await expect(service.validateAdminToken('invalid')).rejects.toThrow(
        'Invalid admin token',
      );
    });

    it('should return empty roles when realm_access is missing', async () => {
      prisma.realm.findUnique.mockResolvedValue(masterRealm);
      prisma.realmSigningKey.findFirst.mockResolvedValue(signingKey);
      jwkService.verifyJwt.mockResolvedValue({
        typ: 'admin',
        sub: 'user-1',
      });

      const result = await service.validateAdminToken('token');
      expect(result.roles).toEqual([]);
    });
  });

  // ─── hasRole ──────────────────────────────────────────

  describe('hasRole', () => {
    it('should return true for super-admin regardless of required role', () => {
      expect(service.hasRole(['super-admin'], 'realm-admin')).toBe(true);
      expect(service.hasRole(['super-admin'], 'view-only')).toBe(true);
      expect(service.hasRole(['super-admin'], 'any-role')).toBe(true);
    });

    it('should return true when required role is present', () => {
      expect(service.hasRole(['realm-admin', 'view-only'], 'realm-admin')).toBe(true);
    });

    it('should return false when required role is not present', () => {
      expect(service.hasRole(['view-only'], 'realm-admin')).toBe(false);
    });

    it('should return false for empty roles', () => {
      expect(service.hasRole([], 'super-admin')).toBe(false);
    });
  });
});
