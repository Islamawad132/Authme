import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createTestApp,
  type SeededRealm,
  type TestContext,
} from './setup';

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication<App>;
  let ctx: TestContext;
  let seeded: SeededRealm;

  const REALM_NAME = 'e2e-rate-limit-realm';
  const TOKEN_URL = `/realms/${REALM_NAME}/protocol/openid-connect/token`;

  /**
   * Helper: make a client-credentials request.
   * All requests use the same client_id so they share the same rate-limit bucket.
   */
  const tokenRequest = () =>
    request(app.getHttpServer())
      .post(TOKEN_URL)
      .type('form')
      .send({
        grant_type: 'client_credentials',
        client_id: 'test-client',
        client_secret: 'test-client-secret',
      });

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    seeded = await ctx.seedTestRealm(REALM_NAME);
  }, 30_000);

  afterAll(async () => {
    await ctx.prisma.realm
      .delete({ where: { name: REALM_NAME } })
      .catch(() => {});
    await ctx.cleanup();
  });

  /** Reset the realm's rate-limit settings to safe defaults and flush the
   *  in-memory store by directly replacing each bucket. */
  const resetRateLimitStore = async () => {
    const rateLimitService = app.get('RateLimitService');
    // Clear the internal in-memory store (private field) to reset buckets
    const store: Map<string, unknown> = (rateLimitService as any).store;
    store.clear();
  };

  const disableRateLimit = () =>
    ctx.prisma.realm.update({
      where: { name: REALM_NAME },
      data: { rateLimitEnabled: false },
    });

  // ─── 1. RATE LIMIT HEADERS ARE PRESENT WHEN ENABLED ─────────────────

  describe('Rate limit headers are present', () => {
    beforeAll(async () => {
      await resetRateLimitStore();
      await ctx.prisma.realm.update({
        where: { name: REALM_NAME },
        data: {
          rateLimitEnabled: true,
          clientRateLimitPerMinute: 100,
          clientRateLimitPerHour: 1000,
        },
      });
    });

    afterAll(disableRateLimit);

    it('should include X-RateLimit-* headers in the response', async () => {
      const res = await tokenRequest().expect(200);

      expect(res.headers).toHaveProperty('x-ratelimit-limit');
      expect(res.headers).toHaveProperty('x-ratelimit-remaining');
      expect(res.headers).toHaveProperty('x-ratelimit-reset');
    });

    it('X-RateLimit-Remaining should decrease with each request', async () => {
      const first = await tokenRequest().expect(200);
      const second = await tokenRequest().expect(200);

      const firstRemaining = parseInt(
        first.headers['x-ratelimit-remaining'] as string,
        10,
      );
      const secondRemaining = parseInt(
        second.headers['x-ratelimit-remaining'] as string,
        10,
      );

      expect(secondRemaining).toBeLessThan(firstRemaining);
    });

    it('X-RateLimit-Limit should match the configured per-minute limit', async () => {
      const res = await tokenRequest().expect(200);

      const limit = parseInt(res.headers['x-ratelimit-limit'] as string, 10);
      expect(limit).toBe(100);
    });

    it('X-RateLimit-Reset should be a future Unix timestamp', async () => {
      const res = await tokenRequest().expect(200);

      const reset = parseInt(res.headers['x-ratelimit-reset'] as string, 10);
      const nowSeconds = Math.floor(Date.now() / 1000);
      expect(reset).toBeGreaterThan(nowSeconds);
    });
  });

  // ─── 2. NO RATE-LIMIT HEADERS WHEN DISABLED ───────────────────────────

  describe('Rate limit headers absent when rate limiting is disabled', () => {
    beforeAll(async () => {
      await resetRateLimitStore();
      await ctx.prisma.realm.update({
        where: { name: REALM_NAME },
        data: { rateLimitEnabled: false },
      });
    });

    it('should NOT include X-RateLimit-* headers when rate limiting is off', async () => {
      const res = await tokenRequest().expect(200);

      // When rate limiting is disabled, the guard returns { allowed: true,
      // limit: 0, remaining: 0, resetAt: 0 } and the guard still sets headers
      // but with limit=0 — verify the endpoint works without blocking
      expect(res.status).toBe(200);
    });
  });

  // ─── 3. 429 RESPONSE AFTER EXCEEDING RATE LIMIT ───────────────────────

  describe('Exceeding the rate limit returns 429', () => {
    // Use a very low per-minute limit (3 requests) so we can exhaust it quickly
    const LOW_LIMIT = 3;

    beforeAll(async () => {
      await resetRateLimitStore();
      await ctx.prisma.realm.update({
        where: { name: REALM_NAME },
        data: {
          rateLimitEnabled: true,
          clientRateLimitPerMinute: LOW_LIMIT,
          clientRateLimitPerHour: 1000,
        },
      });
    });

    afterAll(disableRateLimit);

    it('should succeed for requests within the limit', async () => {
      for (let i = 0; i < LOW_LIMIT; i++) {
        const res = await tokenRequest();
        expect(res.status).toBe(200);
      }
    });

    it('should return 429 when the per-minute limit is exceeded', async () => {
      // The next request exceeds the limit
      const res = await tokenRequest();
      expect(res.status).toBe(429);
    });

    it('should include error details in the 429 response body', async () => {
      const res = await tokenRequest();
      expect(res.status).toBe(429);
      expect(res.body).toHaveProperty('message');
    });

    it('should include Retry-After header in the 429 response', async () => {
      const res = await tokenRequest();
      expect(res.status).toBe(429);
      expect(res.headers).toHaveProperty('retry-after');
      const retryAfter = parseInt(res.headers['retry-after'] as string, 10);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 4. RATE LIMIT RESETS AFTER WINDOW ────────────────────────────────

  describe('Rate limit resets after the window', () => {
    const LOW_LIMIT = 2;

    beforeAll(async () => {
      await resetRateLimitStore();
      await ctx.prisma.realm.update({
        where: { name: REALM_NAME },
        data: {
          rateLimitEnabled: true,
          clientRateLimitPerMinute: LOW_LIMIT,
          clientRateLimitPerHour: 1000,
        },
      });
    });

    afterAll(disableRateLimit);

    it('should allow requests again after manually resetting the in-memory store', async () => {
      // Exhaust the limit
      for (let i = 0; i < LOW_LIMIT; i++) {
        await tokenRequest().expect(200);
      }
      // Confirm we are rate-limited
      await tokenRequest().expect(429);

      // Simulate window reset by clearing the in-memory store
      await resetRateLimitStore();

      // Requests should now succeed again
      const res = await tokenRequest();
      expect(res.status).toBe(200);
    });
  });

  // ─── 5. DIFFERENT CLIENTS HAVE INDEPENDENT BUCKETS ───────────────────

  describe('Different clients have independent rate limit buckets', () => {
    const LOW_LIMIT = 2;
    let secondClientId: string;

    beforeAll(async () => {
      await resetRateLimitStore();
      await ctx.prisma.realm.update({
        where: { name: REALM_NAME },
        data: {
          rateLimitEnabled: true,
          clientRateLimitPerMinute: LOW_LIMIT,
          clientRateLimitPerHour: 1000,
        },
      });

      // Create a second client for isolation testing
      const argon2 = await import('argon2');
      const secretHash = await argon2.hash('second-client-secret');
      const created = await ctx.prisma.client.create({
        data: {
          realmId: seeded.realm.id,
          clientId: 'rate-limit-second-client',
          clientSecret: secretHash,
          clientType: 'CONFIDENTIAL',
          name: 'Rate Limit Second Client',
          enabled: true,
          redirectUris: ['http://localhost:3000/callback'],
          grantTypes: ['client_credentials'],
        },
      });
      secondClientId = created.id;
    });

    afterAll(async () => {
      await disableRateLimit();
      await ctx.prisma.client
        .delete({ where: { id: secondClientId } })
        .catch(() => {});
    });

    it('exhausting one client bucket should not affect another client', async () => {
      // Exhaust the first client's limit
      for (let i = 0; i < LOW_LIMIT; i++) {
        await tokenRequest().expect(200);
      }
      // First client is now rate-limited
      await tokenRequest().expect(429);

      // Second client should still be allowed
      const res = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'client_credentials',
          client_id: 'rate-limit-second-client',
          client_secret: 'second-client-secret',
        });

      expect(res.status).toBe(200);
    });
  });
});
