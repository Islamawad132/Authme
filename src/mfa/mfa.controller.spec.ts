jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { MfaController } from './mfa.controller.js';

describe('MfaController', () => {
  let controller: MfaController;
  let mockMfaService: {
    isMfaEnabled: jest.Mock;
    disableTotp: jest.Mock;
  };

  beforeEach(() => {
    mockMfaService = {
      isMfaEnabled: jest.fn(),
      disableTotp: jest.fn(),
    };

    controller = new MfaController(mockMfaService as any);
  });

  describe('getMfaStatus', () => {
    it('should call mfaService.isMfaEnabled with the userId', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(true);

      await controller.getMfaStatus('user-1');

      expect(mockMfaService.isMfaEnabled).toHaveBeenCalledWith('user-1');
    });

    it('should return { enabled: true } when MFA is enabled', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(true);

      const result = await controller.getMfaStatus('user-1');

      expect(result).toEqual({ enabled: true });
    });

    it('should return { enabled: false } when MFA is disabled', async () => {
      mockMfaService.isMfaEnabled.mockResolvedValue(false);

      const result = await controller.getMfaStatus('user-2');

      expect(result).toEqual({ enabled: false });
    });
  });

  describe('resetMfa', () => {
    it('should call mfaService.disableTotp with the userId', async () => {
      mockMfaService.disableTotp.mockResolvedValue(undefined);

      await controller.resetMfa('user-1');

      expect(mockMfaService.disableTotp).toHaveBeenCalledWith('user-1');
    });
  });
});
