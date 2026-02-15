import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Realm } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CryptoService } from '../crypto/crypto.service.js';
import { JwkService } from '../crypto/jwk.service.js';
import { ScopesService } from '../scopes/scopes.service.js';
import { resolveUserClaims } from '../scopes/claims.resolver.js';

@Injectable()
export class TokensService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly jwkService: JwkService,
    private readonly scopesService: ScopesService,
  ) {}

  async introspect(realm: Realm, token: string) {
    try {
      const signingKey = await this.prisma.realmSigningKey.findFirst({
        where: { realmId: realm.id, active: true },
        orderBy: { createdAt: 'desc' },
      });

      if (!signingKey) {
        return { active: false };
      }

      const payload = await this.jwkService.verifyJwt(token, signingKey.publicKey);

      return {
        active: true,
        sub: payload.sub,
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
        iat: payload.iat,
        scope: payload['scope'],
        preferred_username: payload['preferred_username'],
        email: payload['email'],
        realm_access: payload['realm_access'],
        resource_access: payload['resource_access'],
      };
    } catch {
      return { active: false };
    }
  }

  async revoke(realm: Realm, token: string, tokenTypeHint?: string) {
    if (tokenTypeHint === 'refresh_token' || !tokenTypeHint) {
      const tokenHash = this.crypto.sha256(token);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (storedToken) {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revoked: true },
        });
        return;
      }
    }

    // For access tokens (JWTs), we can't truly revoke them since they're stateless.
    // In production you'd use a blacklist. For MVP, this is a no-op.
  }

  async logout(realm: Realm, refreshToken: string) {
    const tokenHash = this.crypto.sha256(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke all refresh tokens in this session
    await this.prisma.refreshToken.updateMany({
      where: { sessionId: storedToken.sessionId },
      data: { revoked: true },
    });

    // Delete the session
    await this.prisma.session.delete({
      where: { id: storedToken.sessionId },
    });
  }

  async userinfo(realm: Realm, accessToken: string) {
    const signingKey = await this.prisma.realmSigningKey.findFirst({
      where: { realmId: realm.id, active: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!signingKey) {
      throw new UnauthorizedException('No signing key');
    }

    let payload;
    try {
      payload = await this.jwkService.verifyJwt(accessToken, signingKey.publicKey);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const scopeString = payload['scope'] as string | undefined;
    const scopes = this.scopesService.parseAndValidate(scopeString);
    const effectiveScopes = scopes.length > 0 ? scopes : ['openid'];
    const allowedClaims = this.scopesService.getClaimsForScopes(effectiveScopes);

    return resolveUserClaims(user, allowedClaims);
  }
}
