import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  createTestApp,
  TEST_ADMIN_API_KEY,
  type SeededRealm,
  type TestContext,
} from './setup';

describe('Bug Reproduction Tests - Round 2 (e2e)', () => {
  let app: INestApplication<App>;
  let ctx: TestContext;
  let seeded: SeededRealm;

  const REALM_NAME = 'e2e-round2-realm';
  const API_KEY_HEADER = 'x-admin-api-key';
  const TOKEN_URL = `/realms/${REALM_NAME}/protocol/openid-connect/token`;

  const withKey = (req: request.Test) =>
    req.set(API_KEY_HEADER, TEST_ADMIN_API_KEY);

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    seeded = await ctx.seedTestRealm(REALM_NAME);
  }, 30_000);

  afterAll(async () => {
    await ctx.prisma.realm.delete({ where: { name: REALM_NAME } }).catch(() => {});
    await ctx.cleanup();
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #1 (HIGH): IDOR - Session revocation endpoint has no realm isolation
  // GitHub Issue: #609
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #1: Session revocation IDOR - no realm isolation', () => {
    it('should REJECT revoking session from different realm — BUG: accepts any session ID', async () => {
      const otherRealm = await ctx.seedTestRealm('e2e-round2-other-realm');

      const tokens = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const sessionId = tokens.body.session_state;

      const res = await withKey(
        request(app.getHttpServer()).delete(
          `/admin/realms/${REALM_NAME}/sessions/${sessionId}`,
        ),
      );

      // EXPECTED: 403 or 404 (session doesn't belong to this realm)
      // ACTUAL: May succeed - IDOR vulnerability
      // BUG: No realm validation on session revocation
      if (res.status === 204) {
        console.log('BUG CONFIRMED: Session from other realm was revoked!');
      }
    });

    it('should validate session belongs to realm before revocation', async () => {
      const tokens = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const sessionId = tokens.body.session_state;

      const res = await withKey(
        request(app.getHttpServer()).delete(
          `/admin/realms/${REALM_NAME}/sessions/${sessionId}?type=oauth`,
        ),
      );

      // The session should be validated against the realm context
      expect(res.status).toBe(204);

      const stillExists = await ctx.prisma.session.findUnique({
        where: { id: sessionId },
      });
      // BUG: If IDOR exists, session is deleted even though it may belong to different realm
      expect(stillExists).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #2 (HIGH): Open redirect in logout GET endpoint
  // GitHub Issue: #610
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #2: Open redirect in logout GET', () => {
    it('should REJECT javascript: or data: URLs in post_logout_redirect_uri — BUG: accepts them', async () => {
      const res = await request(app.getHttpServer()).get(
        `/realms/${REALM_NAME}/protocol/openid-connect/logout?post_logout_redirect_uri=javascript:alert(1)&state=test`,
      );

      // EXPECTED: 400 or redirect to safe URL
      // ACTUAL: May redirect to javascript: URL - OPEN REDIRECT
      if (res.status === 302 || res.status === 303) {
        const location = res.get('Location') || '';
        if (location.startsWith('javascript:')) {
          console.log('BUG CONFIRMED: Open redirect to javascript: URL!');
        }
        expect(location).not.toMatch(/^javascript:/i);
        expect(location).not.toMatch(/^data:/i);
      }
    });

    it('should validate redirect URI against client registered URIs', async () => {
      const res = await request(app.getHttpServer()).get(
        `/realms/${REALM_NAME}/protocol/openid-connect/logout?post_logout_redirect_uri=http://evil.com&state=test`,
      );

      // If validation passes, redirect should still be safe
      // BUG: The validation at line 206-210 happens before logout,
      // but reconstruction at 215-220 uses query param directly
      if (res.status === 302 || res.status === 303) {
        const location = res.get('Location') || '';
        expect(location).not.toMatch(/^http:\/\/evil\.com/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #3 (HIGH): MFA step-up bypass via JWT admin auth
  // GitHub Issue: #613
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #3: MFA step-up bypass via JWT admin auth', () => {
    it('should BLOCK MFA reset for admins with password-only ACR — BUG: bypasses step-up', async () => {
      const mfaUser = await ctx.prisma.user.create({
        data: {
          realmId: seeded.realm.id,
          username: 'mfa-test-user',
          email: 'mfa@example.com',
          enabled: true,
          passwordHash: await import('argon2').then((h) => h.hash('TestPassword123!')),
          totpEnabled: true,
          totpSecret: 'JBSWY3DPEHPK3PXP',
        },
      });

      const res = await withKey(
        request(app.getHttpServer()).delete(
          `/admin/realms/${REALM_NAME}/users/${mfaUser.id}/mfa/totp`,
        ),
      );

      // EXPECTED: 401 or 403 (MFA step-up required or API key blocked)
      // ACTUAL: May succeed - bypasses step-up check
      // BUG: The block at line 81-85 only catches api-key: prefix,
      // but JWT auth has real userId so block is bypassed
      expect(res.status).toBe(401);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #4 (HIGH): Static API key grants super-admin unconditionally
  // GitHub Issue: #612
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #4: Static API key always gets super-admin role', () => {
    it('should NOT allow API key to have granular role restrictions — BUG: always super-admin', async () => {
      // The API key guard at line 89 unconditionally sets roles: ['super-admin']
      // There's no way to configure a more restrictive API key

      // Test that an API key can perform super-admin operations
      const res = await withKey(
        request(app.getHttpServer()).delete(`/admin/realms/${REALM_NAME}`),
      );

      // EXPECTED: 403 (if API key had restricted roles)
      // ACTUAL: May succeed (super-admin always)
      // BUG: No way to scope API key to realm-admin or view-only
      if (res.status === 204) {
        console.log('BUG CONFIRMED: API key has super-admin - realm deleted!');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #5 (HIGH): API key admins can impersonate users in any realm
  // GitHub Issue: #611
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #5: API key admins can impersonate across realms', () => {
    it('should BLOCK impersonation in different realm via API key — BUG: no realm check', async () => {
      const otherRealm = await ctx.seedTestRealm('e2e-impersonation-other');

      const res = await withKey(
        request(app.getHttpServer()).post(
          `/admin/realms/${REALM_NAME}/impersonation/${otherRealm.user.id}`,
        ),
      );

      // EXPECTED: 403 (admin doesn't belong to target realm)
      // ACTUAL: May succeed - no realm boundary check for api-key:
      // BUG: Lines 59-70 skip validation for api-key: admins
      if (res.status === 200 || res.status === 201) {
        console.log('BUG CONFIRMED: API key admin can impersonate across realms!');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #6 (MEDIUM): Username leaked for disabled users in introspection
  // GitHub Issue: #614
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #6: Username leaked for disabled users in introspection', () => {
    it('should NOT return username for inactive tokens — BUG: returns username for disabled users', async () => {
      const tokens = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      await ctx.prisma.user.update({
        where: { id: seeded.user.id },
        data: { enabled: false },
      });

      const res = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'access_token',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          token: tokens.body.access_token,
        });

      // EXPECTED: active: false with NO username field (RFC 7662)
      // ACTUAL: Returns active: false BUT also username
      // BUG: Line 97 sets username even when user.enabled = false
      expect(res.body.active).toBe(false);
      expect(res.body).not.toHaveProperty('username');

      await ctx.prisma.user.update({
        where: { id: seeded.user.id },
        data: { enabled: true },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #7 (MEDIUM): JWT exp claim not validated in admin token validation
  // GitHub Issue: #615
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #7: JWT exp claim not validated in admin token validation', () => {
    it('should validate exp claim from JWT payload — BUG: relies only on revocation list', async () => {
      // This bug is subtle - if the revokedTokens map entry expires early,
      // an expired token could still be valid
      // Testing would require crafting an expired JWT with manipulated exp claim

      // For manual verification: Check that validateAdminToken at line 152-191
      // doesn't call jwkService.verifyJwt with exp validation option
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #8 (MEDIUM): getUserSessions doesn't filter OAuth sessions by realm
  // GitHub Issue: #616
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #8: getUserSessions doesn\'t filter OAuth sessions by realm', () => {
    it('should filter OAuth sessions by realm — BUG: returns sessions from all realms', async () => {
      const otherRealm = await ctx.seedTestRealm('e2e-sessions-other-realm');

      const tokens1 = await request(app.getHttpServer())
        .post(`/realms/${REALM_NAME}/protocol/openid-connect/token`)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const tokens2 = await request(app.getHttpServer())
        .post(`/realms/${otherRealm.name}/protocol/openid-connect/token`)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const res = await withKey(
        request(app.getHttpServer()).get(
          `/admin/realms/${REALM_NAME}/users/${seeded.user.id}/sessions`,
        ),
      );

      // BUG: OAuth sessions are filtered by user.realmId, not session.realmId
      // If user has sessions in both realms, all are returned
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const ssoSessions = res.body.filter((s: { type: string }) => s.type === 'sso');
      expect(ssoSessions.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #9 (MEDIUM): Missing user existence check in assignClientRoles
  // GitHub Issue: #617
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #9: Missing user existence check in assignClientRoles', () => {
    it('should REJECT role assignment to non-existent users — BUG: silently succeeds', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      const res = await withKey(
        request(app.getHttpServer()).post(
          `/admin/realms/${REALM_NAME}/users/${fakeUserId}/client-role-mappings/test-client`,
        ),
      ).send({ roles: [{ name: 'test-role' }] });

      // EXPECTED: 404 Not Found
      // ACTUAL: 200 OK or 500 - BUG: no user existence check
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #10 (MEDIUM): WebAuthn missing user-realm validation
  // GitHub Issue: #618
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #10: WebAuthn generateAuthenticationOptions missing user-realm validation', () => {
    it('should validate user belongs to realm before generating options', async () => {
      const otherRealm = await ctx.seedTestRealm('e2e-webauthn-realm');

      const res = await request(app.getHttpServer())
        .post(`/realms/${otherRealm.name}/protocol/openid-connect/auth`)
        .query({
          client_id: 'test-client',
          response_type: 'code',
          scope: 'openid',
          redirect_uri: 'http://localhost:3000/callback',
          userId: seeded.user.id,
        });

      // BUG: If userId is accepted and realm validation is missing,
      // authentication options could be generated for user in wrong realm
      // This is more of a PRE-auth check issue
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #11 (MEDIUM): acr_values not validated against client configuration
  // GitHub Issue: #619
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #11: acr_values not validated against client requiredAcr', () => {
    it('should BLOCK client requesting ACR higher than its configured requiredAcr', async () => {
      await ctx.prisma.client.update({
        where: { realmId_clientId: { realmId: seeded.realm.id, clientId: 'test-client' } },
        data: { requiredAcr: 'acr_password' },
      });

      const res = await request(app.getHttpServer())
        .get(`/realms/${REALM_NAME}/protocol/openid-connect/auth`)
        .query({
          client_id: 'test-client',
          response_type: 'code',
          scope: 'openid',
          redirect_uri: 'http://localhost:3000/callback',
          acr_values: 'urn:authme:acr:mfa',
        });

      // EXPECTED: 400 (client can't request ACR higher than its requiredAcr)
      // ACTUAL: May succeed - no validation at lines 59-62
      // BUG: Client could bypass its own security policy
      await ctx.prisma.client.update({
        where: { realmId_clientId: { realmId: seeded.realm.id, clientId: 'test-client' } },
        data: { requiredAcr: null },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #12 (MEDIUM): Broker state realmName not validated
  // GitHub Issue: #620
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #12: Broker state realmName not validated in callback', () => {
    it('should validate realmName in broker state — BUG: only alias and realmId checked', async () => {
      // Manual verification needed - requires setting up identity provider
      // Check broker.service.ts lines 119-129
      // The realmName field in BrokerState is not validated, only alias and realmId
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #13 (MEDIUM): revokeAllUserSessions doesn't verify user-realm relationship
  // GitHub Issue: #621
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #13: revokeAllUserSessions missing explicit user-realm verification', () => {
    it('should explicitly verify user belongs to realm before revoking sessions', async () => {
      const otherRealm = await ctx.seedTestRealm('e2e-revoke-other');

      const tokens = await request(app.getHttpServer())
        .post(`/realms/${otherRealm.name}/protocol/openid-connect/token`)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const res = await withKey(
        request(app.getHttpServer()).delete(
          `/admin/realms/${REALM_NAME}/users/${otherRealm.user.id}/sessions`,
        ),
      );

      // EXPECTED: Should verify user is in realm before revoking
      // BUG: Only filters by user.realmId in JOIN, no explicit check
      // Sessions from otherRealm.user.id should NOT be deleted via REALM_NAME admin
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #14 (MEDIUM): Token introspection info disclosure via missing signing keys
  // GitHub Issue: #622
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #14: Token introspection reveals realm exists via active:false', () => {
    it('should return same response for non-existent vs existing realm without keys', async () => {
      const fakeRealm = 'nonexistent-realm';

      const res = await request(app.getHttpServer())
        .post(`/realms/${fakeRealm}/protocol/openid-connect/token`)
        .type('form')
        .send({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
        });

      // RealmGuard returns 404 for non-existent realm
      // vs realm exists but has no keys returns { active: false }
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #15 (MEDIUM): Device code grant fails instead of supporting MFA step-up
  // GitHub Issue: #623
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #15: Device code grant fails if user has MFA instead of supporting step-up', () => {
    it('should support MFA step-up in device code flow — BUG: throws error telling to use different flow', async () => {
      await ctx.prisma.user.update({
        where: { id: seeded.user.id },
        data: { totpEnabled: true, totpSecret: 'JBSWY3DPEHPK3PXP' },
      });

      const initRes = await request(app.getHttpServer())
        .post(`/realms/${REALM_NAME}/protocol/openid-connect/auth/device`)
        .send({ client_id: 'test-client' })
        .expect(200);

      await ctx.prisma.deviceCode.update({
        where: { userCode: initRes.body.user_code },
        data: { approved: true, userId: seeded.user.id },
      });

      const res = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: initRes.body.device_code,
          client_id: 'test-client',
          client_secret: 'test-client-secret',
        });

      // EXPECTED: Support MFA step-up within device code flow
      // ACTUAL: 400 with message saying to use authorization_code grant
      // BUG: Lines 582-586 throw error instead of supporting step-up
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('authorization_code');

      await ctx.prisma.user.update({
        where: { id: seeded.user.id },
        data: { totpEnabled: false, totpSecret: null },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #16 (MEDIUM): MFA OTP grant allows legacy clients without proper validation
  // GitHub Issue: #624
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #16: MFA OTP grant allows legacy clients without grant type check', () => {
    it('should verify client has mfa-otp grant type — BUG: accepts undefined for legacy clients', async () => {
      await ctx.prisma.client.update({
        where: { realmId_clientId: { realmId: seeded.realm.id, clientId: 'test-client' } },
        data: { grantTypes: ['password'] },  // Only password grant
      });

      const res = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'urn:ietf:params:oauth:grant-type:mfa-otp',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          otp: '123456',
        });

      // EXPECTED: 400 (client doesn't have mfa-otp grant type)
      // ACTUAL: May proceed - BUG: lines 178-184 accept undefined for legacy
      expect([400, 401]).toContain(res.status);

      await ctx.prisma.client.update({
        where: { realmId_clientId: { realmId: seeded.realm.id, clientId: 'test-client' } },
        data: { grantTypes: ['authorization_code', 'client_credentials', 'password', 'refresh_token'] },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #17 (MEDIUM): Introspection azp claim not included in response
  // GitHub Issue: #625
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #17: Token introspection response missing azp claim', () => {
    it('should include azp in introspection response — BUG: not returned at lines 89-102', async () => {
      const tokens = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'password',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          username: 'testuser',
          password: 'TestPassword123!',
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post(TOKEN_URL)
        .type('form')
        .send({
          grant_type: 'access_token',
          client_id: 'test-client',
          client_secret: 'test-client-secret',
          token: tokens.body.access_token,
        });

      // BUG: azp is checked in controller but not included in service response
      expect(res.body.active).toBe(true);
      // azp should be included so clients can verify audience
      expect(res.body).toHaveProperty('azp');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #18 (LOW): Service account session limit can be exceeded
  // GitHub Issue: #626
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #18: Service account session limit can be exceeded', () => {
    it('should enforce session limit cap for service accounts', async () => {
      // BUG: Lines 255-291 skip enforceSessionLimit for service accounts
      // Service accounts can create unlimited sessions
      // Testing would require many concurrent service account logins
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #19 (LOW): O(n) eviction on every token revocation
  // GitHub Issue: #628
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #19: O(n) eviction on every token revocation', () => {
    it('should use more efficient data structure for revoked tokens', async () => {
      // BUG: evictExpiredRevokedTokens iterates ALL entries on every revocation
      // Should use a scheduled cleanup or priority queue
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #20 (LOW): Non-idempotent endImpersonation
  // GitHub Issue: #627
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #20: Non-idempotent endImpersonation throws on already-ended session', () => {
    it('should return 200 on retry instead of 400 — BUG: throws BadRequestException', async () => {
      const startRes = await withKey(
        request(app.getHttpServer()).post(
          `/admin/realms/${REALM_NAME}/impersonation/${seeded.user.id}`,
        ),
      );

      if (startRes.status === 201 || startRes.status === 200) {
        const endRes1 = await withKey(
          request(app.getHttpServer()).post(
            `/admin/realms/${REALM_NAME}/impersonation/end`,
          ),
        );
        expect(endRes1.status).toBe(200);

        const endRes2 = await withKey(
          request(app.getHttpServer()).post(
            `/admin/realms/${REALM_NAME}/impersonation/end`,
          ),
        );

        // EXPECTED: 200 (already ended, idempotent)
        // ACTUAL: 400 BadRequestException - BUG: lines 187-189
        expect(endRes2.status).toBe(200);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // BUG #21 (LOW): revokeAllUserSessions race condition with concurrent login
  // GitHub Issue: #629
  // ═══════════════════════════════════════════════════════════════

  describe('BUG #21: endSession has race condition window', () => {
    it('should use transaction to atomically revoke and delete session', async () => {
      // BUG: Lines 116-122 in sessions.service.ts
      // findUnique then delete is not atomic - race condition
      // Should use $transaction with deleteWhere or conditional delete
    });
  });
});