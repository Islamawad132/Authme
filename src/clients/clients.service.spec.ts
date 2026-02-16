import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import {
  createMockPrismaService,
  MockPrismaService,
} from '../prisma/prisma.mock.js';
import type { Realm } from '@prisma/client';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: MockPrismaService;
  let cryptoService: {
    generateSecret: jest.Mock;
    hashPassword: jest.Mock;
    verifyPassword: jest.Mock;
    sha256: jest.Mock;
  };

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

  const mockClient = {
    id: 'client-uuid-1',
    realmId: 'realm-1',
    clientId: 'my-app',
    clientType: 'CONFIDENTIAL',
    name: 'My App',
    description: null,
    enabled: true,
    redirectUris: ['https://example.com/callback'],
    webOrigins: [],
    grantTypes: ['authorization_code'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = createMockPrismaService();
    cryptoService = {
      generateSecret: jest.fn(),
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
      sha256: jest.fn(),
    };
    service = new ClientsService(prisma as any, cryptoService as any);
  });

  describe('create', () => {
    it('should create a confidential client with a generated secret', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      cryptoService.generateSecret.mockReturnValue('raw-secret-hex');
      cryptoService.hashPassword.mockResolvedValue('hashed-secret');
      prisma.client.create.mockResolvedValue(mockClient);

      const result = await service.create(mockRealm, {
        clientId: 'my-app',
        name: 'My App',
        clientType: 'CONFIDENTIAL',
      });

      expect(result.clientSecret).toBe('raw-secret-hex');
      expect(result.secretWarning).toBeDefined();
      expect(cryptoService.generateSecret).toHaveBeenCalled();
      expect(cryptoService.hashPassword).toHaveBeenCalledWith('raw-secret-hex');
      expect(prisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            realmId: 'realm-1',
            clientId: 'my-app',
            clientSecret: 'hashed-secret',
            clientType: 'CONFIDENTIAL',
          }),
        }),
      );
    });

    it('should create a public client without a secret', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      const publicClient = { ...mockClient, clientType: 'PUBLIC' };
      prisma.client.create.mockResolvedValue(publicClient);

      const result = await service.create(mockRealm, {
        clientId: 'public-app',
        name: 'Public App',
        clientType: 'PUBLIC',
      });

      expect(result.clientSecret).toBeUndefined();
      expect(cryptoService.generateSecret).not.toHaveBeenCalled();
      expect(prisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientSecret: undefined,
            clientType: 'PUBLIC',
          }),
        }),
      );
    });

    it('should default to CONFIDENTIAL when clientType is not specified', async () => {
      prisma.client.findUnique.mockResolvedValue(null);
      cryptoService.generateSecret.mockReturnValue('secret');
      cryptoService.hashPassword.mockResolvedValue('hashed');
      prisma.client.create.mockResolvedValue(mockClient);

      await service.create(mockRealm, {
        clientId: 'my-app',
        name: 'My App',
      });

      expect(prisma.client.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientType: 'CONFIDENTIAL',
          }),
        }),
      );
    });

    it('should throw ConflictException when clientId already exists', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      await expect(
        service.create(mockRealm, { clientId: 'my-app', name: 'Dup' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all clients in the realm', async () => {
      const clients = [mockClient];
      prisma.client.findMany.mockResolvedValue(clients);

      const result = await service.findAll(mockRealm);

      expect(result).toEqual(clients);
      expect(prisma.client.findMany).toHaveBeenCalledWith({
        where: { realmId: 'realm-1' },
        select: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return an empty array when no clients exist', async () => {
      prisma.client.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockRealm);

      expect(result).toEqual([]);
    });
  });

  describe('findByClientId', () => {
    it('should return the client when found', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);

      const result = await service.findByClientId(mockRealm, 'my-app');

      expect(result).toEqual(mockClient);
      expect(prisma.client.findUnique).toHaveBeenCalledWith({
        where: {
          realmId_clientId: { realmId: 'realm-1', clientId: 'my-app' },
        },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.findByClientId(mockRealm, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update and return the client', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      const updatedClient = { ...mockClient, name: 'Updated App' };
      prisma.client.update.mockResolvedValue(updatedClient);

      const result = await service.update(mockRealm, 'my-app', {
        name: 'Updated App',
      });

      expect(result).toEqual(updatedClient);
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: {
          realmId_clientId: { realmId: 'realm-1', clientId: 'my-app' },
        },
        data: {
          name: 'Updated App',
          description: undefined,
          clientType: undefined,
          enabled: undefined,
          redirectUris: undefined,
          webOrigins: undefined,
          grantTypes: undefined,
          requireConsent: undefined,
          backchannelLogoutUri: undefined,
          backchannelLogoutSessionRequired: undefined,
        },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.update(mockRealm, 'nonexistent', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete the client', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      prisma.client.delete.mockResolvedValue(mockClient);

      await service.remove(mockRealm, 'my-app');

      expect(prisma.client.delete).toHaveBeenCalledWith({
        where: {
          realmId_clientId: { realmId: 'realm-1', clientId: 'my-app' },
        },
      });
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.remove(mockRealm, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('regenerateSecret', () => {
    it('should regenerate the secret for a confidential client', async () => {
      prisma.client.findUnique.mockResolvedValue(mockClient);
      cryptoService.generateSecret.mockReturnValue('new-raw-secret');
      cryptoService.hashPassword.mockResolvedValue('new-hashed-secret');
      prisma.client.update.mockResolvedValue({});

      const result = await service.regenerateSecret(mockRealm, 'my-app');

      expect(result.clientId).toBe('my-app');
      expect(result.clientSecret).toBe('new-raw-secret');
      expect(result.secretWarning).toBeDefined();
      expect(cryptoService.generateSecret).toHaveBeenCalled();
      expect(cryptoService.hashPassword).toHaveBeenCalledWith('new-raw-secret');
      expect(prisma.client.update).toHaveBeenCalledWith({
        where: {
          realmId_clientId: { realmId: 'realm-1', clientId: 'my-app' },
        },
        data: { clientSecret: 'new-hashed-secret' },
      });
    });

    it('should throw ConflictException for a public client', async () => {
      prisma.client.findUnique.mockResolvedValue({
        ...mockClient,
        clientType: 'PUBLIC',
      });

      await expect(
        service.regenerateSecret(mockRealm, 'my-app'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException when client does not exist', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(
        service.regenerateSecret(mockRealm, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
