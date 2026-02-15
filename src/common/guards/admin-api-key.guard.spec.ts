import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AdminApiKeyGuard } from './admin-api-key.guard.js';

function createMockExecutionContext(headers: Record<string, string> = {}) {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ headers }),
    }),
  } as any;
}

describe('AdminApiKeyGuard', () => {
  let guard: AdminApiKeyGuard;
  let configService: { get: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    configService = { get: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    guard = new AdminApiKeyGuard(
      configService as unknown as ConfigService,
      reflector as unknown as Reflector,
    );
  });

  it('should allow requests to public (non-admin) routes', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = createMockExecutionContext();

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow requests when no ADMIN_API_KEY is configured', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue(undefined);
    const ctx = createMockExecutionContext();

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should block admin routes when no API key header is provided', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('super-secret-key');
    const ctx = createMockExecutionContext({});

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should block admin routes when the wrong API key is provided', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('super-secret-key');
    const ctx = createMockExecutionContext({
      'x-admin-api-key': 'wrong-key',
    });

    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should allow admin routes when the correct API key is provided', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('super-secret-key');
    const ctx = createMockExecutionContext({
      'x-admin-api-key': 'super-secret-key',
    });

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should read the API key from the x-admin-api-key header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('my-key');
    const ctx = createMockExecutionContext({ 'x-admin-api-key': 'my-key' });

    guard.canActivate(ctx);

    const request = ctx.switchToHttp().getRequest();
    expect(request.headers).toHaveProperty('x-admin-api-key');
  });

  it('should throw UnauthorizedException with a descriptive message', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    configService.get.mockReturnValue('correct-key');
    const ctx = createMockExecutionContext({
      'x-admin-api-key': 'bad-key',
    });

    expect(() => guard.canActivate(ctx)).toThrow(
      'Invalid or missing admin API key',
    );
  });
});
