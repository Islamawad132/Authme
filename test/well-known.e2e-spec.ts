import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createTestApp, type SeededRealm, type TestContext } from './setup';

describe('Well-Known / OIDC Discovery (e2e)', () => {
  let app: INestApplication<App>;
  let ctx: TestContext;
  let seeded: SeededRealm;

  beforeAll(async () => {
    ctx = await createTestApp();
    app = ctx.app;
    seeded = await ctx.seedTestRealm('well-known-realm');
  });

  afterAll(async () => {
    // Clean up the seeded realm
    await ctx.prisma.realm
      .delete({ where: { name: 'well-known-realm' } })
      .catch(() => {});
    await ctx.cleanup();
  });

  describe('GET /realms/:name/.well-known/openid-configuration', () => {
    it('should return a valid OIDC discovery document', async () => {
      const res = await request(app.getHttpServer())
        .get(`/realms/${seeded.realm.name}/.well-known/openid-configuration`)
        .expect(200);

      const body = res.body;

      // Required OIDC discovery fields
      expect(body).toHaveProperty('issuer');
      expect(body).toHaveProperty('authorization_endpoint');
      expect(body).toHaveProperty('token_endpoint');
      expect(body).toHaveProperty('userinfo_endpoint');
      expect(body).toHaveProperty('jwks_uri');
      expect(body).toHaveProperty('response_types_supported');
      expect(body).toHaveProperty('grant_types_supported');
      expect(body).toHaveProperty('subject_types_supported');
      expect(body).toHaveProperty('id_token_signing_alg_values_supported');
      expect(body).toHaveProperty('scopes_supported');
      expect(body).toHaveProperty('token_endpoint_auth_methods_supported');
      expect(body).toHaveProperty('claims_supported');

      // Verify the issuer contains the realm name
      expect(body.issuer).toContain(seeded.realm.name);

      // Verify endpoints contain the realm name
      expect(body.authorization_endpoint).toContain(seeded.realm.name);
      expect(body.token_endpoint).toContain(seeded.realm.name);
      expect(body.jwks_uri).toContain(seeded.realm.name);
      expect(body.userinfo_endpoint).toContain(seeded.realm.name);

      // Verify supported values
      expect(body.response_types_supported).toContain('code');
      expect(body.grant_types_supported).toContain('authorization_code');
      expect(body.grant_types_supported).toContain('client_credentials');
      expect(body.grant_types_supported).toContain('refresh_token');
      expect(body.id_token_signing_alg_values_supported).toContain('RS256');
      expect(body.scopes_supported).toContain('openid');
      expect(body.code_challenge_methods_supported).toContain('S256');
    });

    it('should include introspection and revocation endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get(`/realms/${seeded.realm.name}/.well-known/openid-configuration`)
        .expect(200);

      expect(res.body).toHaveProperty('introspection_endpoint');
      expect(res.body).toHaveProperty('revocation_endpoint');
      expect(res.body).toHaveProperty('end_session_endpoint');
    });

    it('should return 404 for a non-existent realm', async () => {
      await request(app.getHttpServer())
        .get('/realms/nonexistent-realm/.well-known/openid-configuration')
        .expect(404);
    });
  });

  describe('GET /realms/:name/protocol/openid-connect/certs', () => {
    it('should return a valid JWKS with RSA keys', async () => {
      const res = await request(app.getHttpServer())
        .get(`/realms/${seeded.realm.name}/protocol/openid-connect/certs`)
        .expect(200);

      const body = res.body;

      expect(body).toHaveProperty('keys');
      expect(Array.isArray(body.keys)).toBe(true);
      expect(body.keys.length).toBeGreaterThanOrEqual(1);

      const key = body.keys[0];
      expect(key).toHaveProperty('kty', 'RSA');
      expect(key).toHaveProperty('kid');
      expect(key).toHaveProperty('alg', 'RS256');
      expect(key).toHaveProperty('use', 'sig');
      expect(key).toHaveProperty('n'); // RSA modulus
      expect(key).toHaveProperty('e'); // RSA exponent

      // Verify the kid matches the seeded signing key
      expect(key.kid).toBe(seeded.signingKey.kid);
    });

    it('should return 404 for a non-existent realm', async () => {
      await request(app.getHttpServer())
        .get('/realms/nonexistent-realm/protocol/openid-connect/certs')
        .expect(404);
    });
  });
});
