jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { MfaController } from './mfa.controller.js';
import type { Realm } from '@prisma/client';

describe('MfaController', () => {
  let controller: MfaController;
  let mockMfaService: {
    isMfaEnabled: jest.Mock;
    disableTotp: jest.Mock;
  };
  let mockPrisma: {
    user: { findUnique: jest.Mock };
  };

  const realm = { id: 'realm-1', name: 'test' } as Realm;
  const mockUser = { id: 'user-1', realmId: 'realm-1', email: 'test@test.com' };

  beforeEach(() => {
    mockMfaService = {
      isMfaEnabled: jest.fn(),
      disableTotp: jest.fn(),
    };

    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    controller = new MfaController(mockMfaService as any, mockPrisma as any);
  });

  describe('getMfaStatus', () => {
    it('should call mfaService.isMfaEnabled with the userId', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(true);

      await controller.getMfaStatus(realm, 'user-1');

      expect(mockMfaService.isMfaEnabled).toHaveBeenCalledWith('user-1');
    });

    it('should return { enabled: true } when MFA is enabled', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(true);

      const result = await controller.getMfaStatus(realm, 'user-1');

      expect(result).toEqual({ enabled: true });
    });

    it('should return { enabled: false } when MFA is disabled', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(false);

      const result = await controller.getMfaStatus(realm, 'user-2');

      expect(result).toEqual({ enabled: false });
    });

    it('should throw NotFoundException for user in different realm', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, realmId: 'other-realm' });

      await expect(controller.getMfaStatus(realm, 'user-1')).rejects.toThrow('not found in realm');
    });
  });

  describe('resetMfa', () => {
    it('should call mfaService.disableTotp with the userId', async () => {
      mockMfaService.disableTotp.mockResolvedValue(undefined);

      await controller.resetMfa(realm, 'user-1');

      expect(mockMfaService.disableTotp).toHaveBeenCalledWith('user-1');
    });
  });
});
