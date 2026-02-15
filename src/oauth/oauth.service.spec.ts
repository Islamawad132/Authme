import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { OAuthService, AuthorizeParams } from './oauth.service.js';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../prisma/prisma.mock.js';
import type { Realm, Client, User } from '@prisma/client';

describe('OAuthService', () => {
  let service: OAuthService;
  let prisma: MockPrismaService;

  const mockRealm: Realm = {
    id: 'realm-1',
    name: 'test-realm',
    displayName: 'Test Realm',
    enabled: true,
    accessTokenLifespan: 300,
    refreshTokenLifespan: 1800,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Realm;

  const mockClient: Client = {
    id: 'client-uuid-1',
    realmId: 'realm-1',
    clientId: 'my-app',
    clientSecret: null,
    clientType: 'CONFIDENTIAL',
    name: 'My App',
    description: null,
    enabled: true,
    redirectUris: ['https://example.com/callback'],
    webOrigins: [],
    grantTypes: ['authorization_code'],
    requireConsent: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Client;

  const mockUser: User = {
    id: 'user-uuid-1',
    realmId: 'realm-1',
    username: 'testuser',
    email: 'test@example.com',
    emailVerified: false,
    firstName: 'Test',
    lastName: 'User',
    enabled: true,
    passwordHash: 'hashed',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  const validParams: AuthorizeParams = {
    response_type: 'code',
    client_id: 'my-app',
    redirect_uri: 'https://example.com/callback',
    scope: 'openid',
    state: 'abc123',
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    service = new OAuthService(prisma as any);
  });

  describe('validateAuthRequest', () => {
    it('should return the client for valid parameters', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await service.validateAuthRequest(mockRealm, validParams);

      expect(result).toBe(mockClient);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: {
          realmId_clientId: { realmId: 'realm-1', clientId: 'my-app' },
        },
      });
    });

    it('should throw BadRequestException for unsupported response_type', async () => {
      const params = { ...validParams, response_type: 'token' };

      await expect(
        service.validateAuthRequest(mockRealm, params),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when client_id is missing', async () => {
      const params = { ...validParams, client_id: '' };

      await expect(
        service.validateAuthRequest(mockRealm, params),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when redirect_uri is missing', async () => {
      const params = { ...validParams, redirect_uri: '' };

      await expect(
        service.validateAuthRequest(mockRealm, params),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.validateAuthRequest(mockRealm, validParams),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when client is disabled', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        enabled: false,
      });

      await expect(
        service.validateAuthRequest(mockRealm, validParams),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when redirect_uri does not match', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      const params = {
        ...validParams,
        redirect_uri: 'https://evil.com/callback',
      };

      await expect(
        service.validateAuthRequest(mockRealm, params),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when client does not support authorization_code grant', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        grantTypes: ['client_credentials'],
      });

      await expect(
        service.validateAuthRequest(mockRealm, validParams),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for unsupported code_challenge_method', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      const params = {
        ...validParams,
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
      };

      await expect(
        service.validateAuthRequest(mockRealm, params),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept S256 code_challenge_method', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      const params = {
        ...validParams,
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
      };

      const result = await service.validateAuthRequest(mockRealm, params);
      expect(result).toBe(mockClient);
    });
  });

  describe('authorizeWithUser', () => {
    it('should generate an authorization code and return a redirect URL', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.authorizationCode.create.mockResolvedValue({});

      const result = await service.authorizeWithUser(
        mockRealm,
        mockUser,
        validParams,
      );

      expect(result.redirectUrl).toBeDefined();
      const url = new URL(result.redirectUrl);
      expect(url.origin + url.pathname).toBe('https://example.com/callback');
      expect(url.searchParams.get('code')).toBeTruthy();
      expect(url.searchParams.get('code')).toHaveLength(64); // 32 bytes hex
      expect(url.searchParams.get('state')).toBe('abc123');
    });

    it('should persist the authorization code with correct data', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.authorizationCode.create.mockResolvedValue({});

      await service.authorizeWithUser(mockRealm, mockUser, validParams);

      expect(prisma.authorizationCode.create).toHaveBeenCalledTimes(1);
      const createCall = prisma.authorizationCode.create.mock.calls[0][0];
      expect(createCall.data.clientId).toBe('client-uuid-1');
      expect(createCall.data.userId).toBe('user-uuid-1');
      expect(createCall.data.redirectUri).toBe('https://example.com/callback');
      expect(createCall.data.scope).toBe('openid');
      expect(createCall.data.code).toHaveLength(64);
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);
    });

    it('should persist the nonce when provided', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.authorizationCode.create.mockResolvedValue({});

      const params = { ...validParams, nonce: 'my-nonce-value' };
      await service.authorizeWithUser(mockRealm, mockUser, params);

      const createCall = prisma.authorizationCode.create.mock.calls[0][0];
      expect(createCall.data.nonce).toBe('my-nonce-value');
    });

    it('should not include state in redirect URL when state is not provided', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.authorizationCode.create.mockResolvedValue({});

      const params = { ...validParams, state: undefined };
      const result = await service.authorizeWithUser(
        mockRealm,
        mockUser,
        params,
      );

      const url = new URL(result.redirectUrl);
      expect(url.searchParams.has('state')).toBe(false);
    });

    it('should persist code_challenge and code_challenge_method', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.authorizationCode.create.mockResolvedValue({});

      const params = {
        ...validParams,
        code_challenge: 'my-challenge',
        code_challenge_method: 'S256',
      };
      await service.authorizeWithUser(mockRealm, mockUser, params);

      const createCall = prisma.authorizationCode.create.mock.calls[0][0];
      expect(createCall.data.codeChallenge).toBe('my-challenge');
      expect(createCall.data.codeChallengeMethod).toBe('S256');
    });
  });
});
