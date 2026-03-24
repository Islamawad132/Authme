import { resolveClientIp, resetTrustedProxyConfig } from './proxy-ip.util.js';
import type { Request } from 'express';

/**
 * Build a minimal Express-like Request mock.
 */
function makeRequest(
  opts: {
    socketIp?: string;
    xForwardedFor?: string;
  } = {},
): Request {
  return {
    socket: { remoteAddress: opts.socketIp ?? '127.0.0.1' },
    headers: opts.xForwardedFor
      ? { 'x-forwarded-for': opts.xForwardedFor }
      : {},
  } as unknown as Request;
}

describe('resolveClientIp', () => {
  beforeEach(() => {
    resetTrustedProxyConfig();
    delete process.env['TRUSTED_PROXIES'];
  });

  afterEach(() => {
    resetTrustedProxyConfig();
    delete process.env['TRUSTED_PROXIES'];
  });

  // ─── TRUSTED_PROXIES not set ────────────────────────────────────────────

  describe('when TRUSTED_PROXIES is not set', () => {
    it('returns the socket address when no X-Forwarded-For header is present', () => {
      const req = makeRequest({ socketIp: '10.0.0.5' });
      expect(resolveClientIp(req)).toBe('10.0.0.5');
    });

    it('ignores X-Forwarded-For and returns the socket address (prevents spoofing)', () => {
      const req = makeRequest({
        socketIp: '10.0.0.5',
        xForwardedFor: '1.2.3.4',
      });
      expect(resolveClientIp(req)).toBe('10.0.0.5');
    });

    it('returns "unknown" when socket address is not available', () => {
      const req = { socket: {}, headers: {} } as unknown as Request;
      expect(resolveClientIp(req)).toBe('unknown');
    });
  });

  // ─── TRUSTED_PROXIES=* ──────────────────────────────────────────────────

  describe('when TRUSTED_PROXIES=* (trust all proxies)', () => {
    beforeEach(() => {
      process.env['TRUSTED_PROXIES'] = '*';
      resetTrustedProxyConfig();
    });

    it('uses the first IP from X-Forwarded-For', () => {
      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '203.0.113.5, 10.0.0.1',
      });
      expect(resolveClientIp(req)).toBe('203.0.113.5');
    });

    it('falls back to socket address when X-Forwarded-For is absent', () => {
      const req = makeRequest({ socketIp: '10.0.0.1' });
      expect(resolveClientIp(req)).toBe('10.0.0.1');
    });
  });

  // ─── TRUSTED_PROXIES with specific IP list ───────────────────────────────

  describe('when TRUSTED_PROXIES is a comma-separated list of IPs', () => {
    beforeEach(() => {
      process.env['TRUSTED_PROXIES'] = '10.0.0.1,10.0.0.2';
      resetTrustedProxyConfig();
    });

    it('uses X-Forwarded-For when the peer is a trusted proxy', () => {
      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '203.0.113.5',
      });
      expect(resolveClientIp(req)).toBe('203.0.113.5');
    });

    it('ignores X-Forwarded-For when the peer is NOT a trusted proxy', () => {
      const req = makeRequest({
        socketIp: '192.168.99.1',
        xForwardedFor: '1.2.3.4',
      });
      expect(resolveClientIp(req)).toBe('192.168.99.1');
    });

    it('uses X-Forwarded-For for the second trusted proxy as well', () => {
      const req = makeRequest({
        socketIp: '10.0.0.2',
        xForwardedFor: '203.0.113.99',
      });
      expect(resolveClientIp(req)).toBe('203.0.113.99');
    });
  });

  // ─── TRUSTED_PROXIES with CIDR block ────────────────────────────────────

  describe('when TRUSTED_PROXIES contains a CIDR block', () => {
    beforeEach(() => {
      process.env['TRUSTED_PROXIES'] = '10.0.0.0/24';
      resetTrustedProxyConfig();
    });

    it('uses X-Forwarded-For when the peer is within the CIDR range', () => {
      const req = makeRequest({
        socketIp: '10.0.0.200',
        xForwardedFor: '203.0.113.7',
      });
      expect(resolveClientIp(req)).toBe('203.0.113.7');
    });

    it('ignores X-Forwarded-For when the peer is outside the CIDR range', () => {
      const req = makeRequest({
        socketIp: '10.0.1.1',
        xForwardedFor: '1.2.3.4',
      });
      expect(resolveClientIp(req)).toBe('10.0.1.1');
    });
  });

  // ─── Edge cases ─────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles an empty TRUSTED_PROXIES string as "none" (no trust)', () => {
      process.env['TRUSTED_PROXIES'] = '';
      resetTrustedProxyConfig();

      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '1.2.3.4',
      });
      expect(resolveClientIp(req)).toBe('10.0.0.1');
    });

    it('handles whitespace-only TRUSTED_PROXIES as "none"', () => {
      process.env['TRUSTED_PROXIES'] = '   ';
      resetTrustedProxyConfig();

      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '1.2.3.4',
      });
      expect(resolveClientIp(req)).toBe('10.0.0.1');
    });

    it('uses only the first IP when X-Forwarded-For contains multiple entries', () => {
      process.env['TRUSTED_PROXIES'] = '*';
      resetTrustedProxyConfig();

      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '5.5.5.5, 6.6.6.6, 7.7.7.7',
      });
      expect(resolveClientIp(req)).toBe('5.5.5.5');
    });

    it('trims spaces around IPs in TRUSTED_PROXIES', () => {
      process.env['TRUSTED_PROXIES'] = ' 10.0.0.1 , 10.0.0.2 ';
      resetTrustedProxyConfig();

      const req = makeRequest({
        socketIp: '10.0.0.1',
        xForwardedFor: '203.0.113.5',
      });
      expect(resolveClientIp(req)).toBe('203.0.113.5');
    });
  });
});
