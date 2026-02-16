import { ScopesService } from './scopes.service.js';

describe('ScopesService', () => {
  let service: ScopesService;

  beforeEach(() => {
    const mockPrisma = {} as any;
    service = new ScopesService(mockPrisma);
  });

  describe('parseAndValidate', () => {
    it('should parse a space-delimited scope string', () => {
      expect(service.parseAndValidate('openid profile email')).toEqual([
        'openid',
        'profile',
        'email',
      ]);
    });

    it('should filter out unrecognized scopes', () => {
      expect(service.parseAndValidate('openid foo bar email')).toEqual([
        'openid',
        'email',
      ]);
    });

    it('should return empty array for undefined', () => {
      expect(service.parseAndValidate(undefined)).toEqual([]);
    });

    it('should return empty array for empty string', () => {
      expect(service.parseAndValidate('')).toEqual([]);
    });
  });

  describe('getClaimsForScopes', () => {
    it('should return sub for openid scope', () => {
      const claims = service.getClaimsForScopes(['openid']);
      expect(claims.has('sub')).toBe(true);
    });

    it('should return email claims for email scope', () => {
      const claims = service.getClaimsForScopes(['email']);
      expect(claims.has('email')).toBe(true);
      expect(claims.has('email_verified')).toBe(true);
    });

    it('should return profile claims for profile scope', () => {
      const claims = service.getClaimsForScopes(['profile']);
      expect(claims.has('preferred_username')).toBe(true);
      expect(claims.has('given_name')).toBe(true);
      expect(claims.has('family_name')).toBe(true);
      expect(claims.has('name')).toBe(true);
    });

    it('should return role claims for roles scope', () => {
      const claims = service.getClaimsForScopes(['roles']);
      expect(claims.has('realm_access')).toBe(true);
      expect(claims.has('resource_access')).toBe(true);
    });

    it('should merge claims from multiple scopes', () => {
      const claims = service.getClaimsForScopes(['openid', 'email']);
      expect(claims.has('sub')).toBe(true);
      expect(claims.has('email')).toBe(true);
    });
  });

  describe('hasOpenidScope', () => {
    it('should return true when openid is present', () => {
      expect(service.hasOpenidScope(['openid', 'profile'])).toBe(true);
    });

    it('should return false when openid is absent', () => {
      expect(service.hasOpenidScope(['profile', 'email'])).toBe(false);
    });
  });

  describe('toString', () => {
    it('should join scopes with spaces', () => {
      expect(service.toString(['openid', 'profile'])).toBe('openid profile');
    });
  });
});
