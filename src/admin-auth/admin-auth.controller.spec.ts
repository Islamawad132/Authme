import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthController } from './admin-auth.controller.js';

describe('AdminAuthController', () => {
  let controller: AdminAuthController;
  let adminAuthService: {
    login: jest.Mock;
  };

  beforeEach(() => {
    adminAuthService = {
      login: jest.fn(),
    };
    controller = new AdminAuthController(adminAuthService as any);
  });

  describe('login', () => {
    it('should call adminAuthService.login and return token', async () => {
      const tokenResponse = {
        access_token: 'jwt-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };
      adminAuthService.login.mockResolvedValue(tokenResponse);

      const result = await controller.login({
        username: 'admin',
        password: 'password',
      });

      expect(result).toEqual(tokenResponse);
      expect(adminAuthService.login).toHaveBeenCalledWith('admin', 'password');
    });

    it('should propagate errors from service', async () => {
      adminAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid credentials'),
      );

      await expect(
        controller.login({ username: 'admin', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return admin user from request', async () => {
      const adminUser = { userId: 'user-1', roles: ['super-admin'] };
      const req = { adminUser } as any;

      const result = await controller.getMe(req);
      expect(result).toEqual(adminUser);
    });

    it('should throw UnauthorizedException if no admin user on request', async () => {
      const req = {} as any;

      await expect(controller.getMe(req)).rejects.toThrow(UnauthorizedException);
      await expect(controller.getMe(req)).rejects.toThrow('Not authenticated');
    });
  });
});
