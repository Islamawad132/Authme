import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { JwkService } from '../crypto/jwk.service.js';
import { ScopesService } from '../scopes/scopes.service.js';
import { resolveUserClaims, type UserClaimSource } from '../scopes/claims.resolver.js';
import type { Realm } from '@prisma/client';
import type { JWTPayload } from 'jose';

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwkService: JwkService,
    private readonly scopesService: ScopesService,
  ) {}

  async handleTokenRequest(
    realm: Realm,
    body: Record<string, string>,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenResponse> {
    const grantType = body['grant_type'];

    switch (grantType) {
      case 'password':
        return this.handlePasswordGrant(realm, body, ip, userAgent);
      case 'client_credentials':
        return this.handleClientCredentialsGrant(realm, body);
      case 'refresh_token':
        return this.handleRefreshTokenGrant(realm, body);
      case 'authorization_code':
        return this.handleAuthorizationCodeGrant(realm, body, ip, userAgent);
      default:
        throw new BadRequestException(`Unsupported grant_type: ${grantType}`);
    }
  }

  private async handlePasswordGrant(
    realm: Realm,
    body: Record<string, string>,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenResponse> {
    const { client_id, client_secret, username, password, scope } = body;

    await this.validateClient(realm, client_id, client_secret, 'password');

    if (!username || !password) {
      throw new BadRequestException('username and password are required');
    }

    const user = await this.prisma.user.findUnique({
      where: { realmId_username: { realmId: realm.id, username } },
    });
    if (!user || !user.enabled || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.crypto.verifyPassword(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + realm.refreshTokenLifespan * 1000),
      },
    });

    return this.issueTokens(realm, user, client_id, session.id, scope, undefined, new Date());
  }

  private async handleClientCredentialsGrant(
    realm: Realm,
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    const { client_id, client_secret, scope } = body;
    const client = await this.validateClient(
      realm,
      client_id,
      client_secret,
      'client_credentials',
    );

    const signingKey = await this.getActiveSigningKey(realm.id);

    const accessToken = await this.jwkService.signJwt(
      {
        iss: this.getIssuer(realm),
        sub: client.id,
        aud: client_id,
        scope: scope ?? 'openid',
        typ: 'Bearer',
        azp: client_id,
      },
      signingKey.privateKey,
      signingKey.kid,
      realm.accessTokenLifespan,
    );

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: realm.accessTokenLifespan,
      scope: scope ?? 'openid',
    };
  }

  private async handleRefreshTokenGrant(
    realm: Realm,
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    const { refresh_token, client_id, client_secret, scope } = body;

    if (!refresh_token) {
      throw new BadRequestException('refresh_token is required');
    }

    await this.validateClient(realm, client_id, client_secret, 'refresh_token');

    const tokenHash = this.crypto.sha256(refresh_token);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: {
          include: { user: true },
        },
      },
    });

    if (
      !storedToken ||
      storedToken.revoked ||
      storedToken.expiresAt < new Date()
    ) {
      // If the token was already used (revoked), this could be token theft.
      // Revoke the entire session as a precaution.
      if (storedToken?.revoked && storedToken.session) {
        await this.prisma.refreshToken.updateMany({
          where: { sessionId: storedToken.sessionId },
          data: { revoked: true },
        });
      }
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate: revoke old token
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true },
    });

    const user = storedToken.session.user;
    return this.issueTokens(
      realm,
      user,
      client_id,
      storedToken.sessionId,
      scope,
    );
  }

  private async handleAuthorizationCodeGrant(
    realm: Realm,
    body: Record<string, string>,
    ip?: string,
    userAgent?: string,
  ): Promise<TokenResponse> {
    const { code, client_id, client_secret, redirect_uri, code_verifier } =
      body;

    if (!code) {
      throw new BadRequestException('code is required');
    }

    const client = await this.validateClient(
      realm,
      client_id,
      client_secret,
      'authorization_code',
    );

    const authCode = await this.prisma.authorizationCode.findUnique({
      where: { code },
    });

    if (
      !authCode ||
      authCode.clientId !== client.id ||
      authCode.used ||
      authCode.expiresAt < new Date()
    ) {
      if (authCode && !authCode.used) {
        await this.prisma.authorizationCode.update({
          where: { id: authCode.id },
          data: { used: true },
        });
      }
      throw new UnauthorizedException('Invalid or expired authorization code');
    }

    if (authCode.redirectUri !== redirect_uri) {
      throw new BadRequestException('redirect_uri mismatch');
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!code_verifier) {
        throw new BadRequestException('code_verifier is required for PKCE');
      }
      const computedChallenge = Buffer.from(
        this.crypto.sha256(code_verifier),
        'hex',
      )
        .toString('base64url');

      if (computedChallenge !== authCode.codeChallenge) {
        throw new UnauthorizedException('Invalid code_verifier');
      }
    }

    // Mark code as used
    await this.prisma.authorizationCode.update({
      where: { id: authCode.id },
      data: { used: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: authCode.userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + realm.refreshTokenLifespan * 1000),
      },
    });

    return this.issueTokens(
      realm,
      user,
      client_id,
      session.id,
      authCode.scope ?? undefined,
      authCode.nonce ?? undefined,
      new Date(),
    );
  }

  private async validateClient(
    realm: Realm,
    clientId: string,
    clientSecret?: string,
    grantType?: string,
  ) {
    if (!clientId) {
      throw new BadRequestException('client_id is required');
    }

    const client = await this.prisma.client.findUnique({
      where: { realmId_clientId: { realmId: realm.id, clientId } },
    });

    if (!client || !client.enabled) {
      throw new UnauthorizedException('Invalid client');
    }

    if (grantType && !client.grantTypes.includes(grantType)) {
      throw new BadRequestException(
        `Grant type '${grantType}' not allowed for this client`,
      );
    }

    if (client.clientType === 'CONFIDENTIAL') {
      if (!clientSecret) {
        throw new UnauthorizedException('client_secret is required');
      }
      if (!client.clientSecret) {
        throw new UnauthorizedException('Client has no secret configured');
      }
      const valid = await this.crypto.verifyPassword(
        client.clientSecret,
        clientSecret,
      );
      if (!valid) {
        throw new UnauthorizedException('Invalid client credentials');
      }
    }

    return client;
  }

  private async issueTokens(
    realm: Realm,
    user: UserClaimSource,
    clientId: string,
    sessionId: string,
    scope?: string,
    nonce?: string,
    authTime?: Date,
  ): Promise<TokenResponse> {
    const signingKey = await this.getActiveSigningKey(realm.id);

    // Parse and validate scopes, default to openid
    const scopes = this.scopesService.parseAndValidate(scope);
    const effectiveScopes = scopes.length > 0 ? scopes : ['openid'];
    const validatedScope = this.scopesService.toString(effectiveScopes);

    // Resolve scope-filtered user claims
    const allowedClaims = this.scopesService.getClaimsForScopes(effectiveScopes);
    const userClaims = resolveUserClaims(user, allowedClaims);

    // Build role claims
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: { include: { client: true } } },
    });

    const realmRoles = userRoles
      .filter((ur) => !ur.role.clientId)
      .map((ur) => ur.role.name);

    const resourceAccess: Record<string, { roles: string[] }> = {};
    for (const ur of userRoles) {
      if (ur.role.client) {
        const cId = ur.role.client.clientId;
        if (!resourceAccess[cId]) {
          resourceAccess[cId] = { roles: [] };
        }
        resourceAccess[cId].roles.push(ur.role.name);
      }
    }

    // Include roles by default (backward compat) or when 'roles' scope is granted
    const includeRoles = !scope || allowedClaims.has('realm_access');

    const accessTokenPayload: JWTPayload = {
      iss: this.getIssuer(realm),
      sub: user.id,
      aud: clientId,
      scope: validatedScope,
      typ: 'Bearer',
      azp: clientId,
      sid: sessionId,
      ...userClaims,
      ...(includeRoles
        ? {
            realm_access: { roles: realmRoles },
            resource_access: resourceAccess,
          }
        : {}),
    };

    const accessToken = await this.jwkService.signJwt(
      accessTokenPayload,
      signingKey.privateKey,
      signingKey.kid,
      realm.accessTokenLifespan,
    );

    // Generate opaque refresh token
    const rawRefreshToken = this.crypto.generateSecret(64);
    const refreshTokenHash = this.crypto.sha256(rawRefreshToken);

    await this.prisma.refreshToken.create({
      data: {
        sessionId,
        tokenHash: refreshTokenHash,
        expiresAt: new Date(Date.now() + realm.refreshTokenLifespan * 1000),
      },
    });

    // Build ID token if openid scope is present
    let idToken: string | undefined;
    if (this.scopesService.hasOpenidScope(effectiveScopes)) {
      idToken = await this.buildIdToken({
        realm,
        user,
        clientId,
        sessionId,
        scopes: effectiveScopes,
        accessToken,
        nonce,
        authTime,
        signingKey,
      });
    }

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: realm.accessTokenLifespan,
      refresh_token: rawRefreshToken,
      scope: validatedScope,
      ...(idToken ? { id_token: idToken } : {}),
    };
  }

  private async buildIdToken(params: {
    realm: Realm;
    user: UserClaimSource;
    clientId: string;
    sessionId: string;
    scopes: string[];
    accessToken: string;
    nonce?: string;
    authTime?: Date;
    signingKey: { privateKey: string; kid: string };
  }): Promise<string> {
    const allowedClaims = this.scopesService.getClaimsForScopes(params.scopes);
    const userClaims = resolveUserClaims(params.user, allowedClaims);

    const idTokenPayload: JWTPayload = {
      iss: this.getIssuer(params.realm),
      sub: params.user.id,
      aud: params.clientId,
      azp: params.clientId,
      typ: 'ID',
      sid: params.sessionId,
      at_hash: this.jwkService.computeAtHash(params.accessToken),
      auth_time: params.authTime
        ? Math.floor(params.authTime.getTime() / 1000)
        : Math.floor(Date.now() / 1000),
      acr: '1',
      ...userClaims,
    };

    if (params.nonce) {
      idTokenPayload['nonce'] = params.nonce;
    }

    return this.jwkService.signJwt(
      idTokenPayload,
      params.signingKey.privateKey,
      params.signingKey.kid,
      params.realm.accessTokenLifespan,
    );
  }

  private async getActiveSigningKey(realmId: string) {
    const key = await this.prisma.realmSigningKey.findFirst({
      where: { realmId, active: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!key) {
      throw new Error('No active signing key found for realm');
    }
    return key;
  }

  private getIssuer(realm: Realm): string {
    const baseUrl = process.env['BASE_URL'] ?? 'http://localhost:3000';
    return `${baseUrl}/realms/${realm.name}`;
  }
}
