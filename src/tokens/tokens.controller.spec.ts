jest.mock('../crypto/jwk.service.js', () => ({ JwkService: jest.fn() }));

import { TokensController } from './tokens.controller.js';
import type { Realm } from '@prisma/client';

describe('TokensController', () => {
  let controller: TokensController;
  let mockTokensService: {
    introspect: jest.Mock;
    revoke: jest.Mock;
    logout: jest.Mock;
    userinfo: jest.Mock;
  };

  const realm = {
    id: 'realm-1',
    name: 'test-realm',
    enabled: true,
  } as Realm;

  beforeEach(() => {
    mockTokensService = {
      introspect: jest.fn(),
      revoke: jest.fn(),
      logout: jest.fn(),
      userinfo: jest.fn(),
    };

    controller = new TokensController(mockTokensService as any);
  });

  describe('introspect', () => {
    it('should call tokensService.introspect with realm and body.token', () => {
      const body = { token: 'some-token' };
      controller.introspect(realm, body);

      expect(mockTokensService.introspect).toHaveBeenCalledWith(realm, 'some-token');
    });

    it('should return the result from tokensService.introspect', async () => {
      const expected = { active: true, sub: 'user-1' };
      mockTokensService.introspect.mockResolvedValue(expected);

      const result = await controller.introspect(realm, { token: 'tok' });

      expect(result).toEqual(expected);
    });
  });

  describe('revoke', () => {
    it('should call tokensService.revoke with realm, token, and token_type_hint', () => {
      const body = { token: 'some-token', token_type_hint: 'refresh_token' };
      controller.revoke(realm, body);

      expect(mockTokensService.revoke).toHaveBeenCalledWith(
        realm,
        'some-token',
        'refresh_token',
      );
    });

    it('should pass undefined for token_type_hint when not provided', () => {
      const body = { token: 'some-token' };
      controller.revoke(realm, body);

      expect(mockTokensService.revoke).toHaveBeenCalledWith(
        realm,
        'some-token',
        undefined,
      );
    });
  });

  describe('logout', () => {
    it('should call tokensService.logout with realm, refresh_token, and req.ip', () => {
      const body = { refresh_token: 'rt-123' };
      const req = { ip: '127.0.0.1', headers: {} };

      controller.logout(realm, body, req as any);

      expect(mockTokensService.logout).toHaveBeenCalledWith(
        realm,
        'rt-123',
        '127.0.0.1',
      );
    });
  });

  describe('userinfo', () => {
    it('should extract Bearer token and call tokensService.userinfo', async () => {
      const req = { headers: { authorization: 'Bearer abc-123' } };
      const expected = { sub: 'user-1', email: 'user@test.com' };
      mockTokensService.userinfo.mockResolvedValue(expected);

      const result = await controller.userinfo(realm, req as any);

      expect(mockTokensService.userinfo).toHaveBeenCalledWith(realm, 'abc-123');
      expect(result).toEqual(expected);
    });

    it('should return an error object when Authorization header is missing', () => {
      const req = { headers: {} };

      const result = controller.userinfo(realm, req as any);

      expect(result).toEqual({
        error: 'invalid_token',
        error_description: 'Missing Bearer token',
      });
      expect(mockTokensService.userinfo).not.toHaveBeenCalled();
    });

    it('should return an error object when Authorization header does not start with Bearer', () => {
      const req = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };

      const result = controller.userinfo(realm, req as any);

      expect(result).toEqual({
        error: 'invalid_token',
        error_description: 'Missing Bearer token',
      });
      expect(mockTokensService.userinfo).not.toHaveBeenCalled();
    });
  });
});
