import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwkService } from '../crypto/jwk.service.js';
import { RealmGuard } from '../common/guards/realm.guard.js';
import { CurrentRealm } from '../common/decorators/current-realm.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('OIDC Discovery')
@Controller('realms/:realmName')
@UseGuards(RealmGuard)
@Public()
export class WellKnownController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwkService: JwkService,
  ) {}

  @Get('.well-known/openid-configuration')
  @ApiOperation({ summary: 'OpenID Connect discovery document' })
  discovery(@CurrentRealm() realm: Realm) {
    const baseUrl = process.env['BASE_URL'] ?? 'http://localhost:3000';
    const realmUrl = `${baseUrl}/realms/${realm.name}`;
    const protocolUrl = `${realmUrl}/protocol/openid-connect`;

    return {
      issuer: realmUrl,
      authorization_endpoint: `${protocolUrl}/auth`,
      token_endpoint: `${protocolUrl}/token`,
      userinfo_endpoint: `${protocolUrl}/userinfo`,
      jwks_uri: `${protocolUrl}/certs`,
      introspection_endpoint: `${protocolUrl}/token/introspect`,
      revocation_endpoint: `${protocolUrl}/revoke`,
      end_session_endpoint: `${protocolUrl}/logout`,
      response_types_supported: ['code'],
      device_authorization_endpoint: `${protocolUrl}/auth/device`,
      grant_types_supported: [
        'authorization_code',
        'client_credentials',
        'password',
        'refresh_token',
        'urn:ietf:params:oauth:grant-type:device_code',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      scopes_supported: ['openid', 'profile', 'email', 'roles', 'offline_access'],
      token_endpoint_auth_methods_supported: [
        'client_secret_post',
        'client_secret_basic',
      ],
      claims_supported: [
        'sub',
        'iss',
        'aud',
        'exp',
        'iat',
        'auth_time',
        'nonce',
        'at_hash',
        'acr',
        'azp',
        'name',
        'email',
        'email_verified',
        'preferred_username',
        'given_name',
        'family_name',
        'realm_access',
        'resource_access',
      ],
      code_challenge_methods_supported: ['S256'],
      backchannel_logout_supported: true,
      backchannel_logout_session_supported: true,
    };
  }

  @Get('protocol/openid-connect/certs')
  @ApiOperation({ summary: 'JSON Web Key Set (JWKS)' })
  async certs(@CurrentRealm() realm: Realm) {
    const keys = await this.prisma.realmSigningKey.findMany({
      where: { realmId: realm.id, active: true },
    });

    const jwks = await Promise.all(
      keys.map((key) => this.jwkService.publicKeyToJwk(key.publicKey, key.kid)),
    );

    return { keys: jwks };
  }
}
