import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { OIDC_SCOPES, SUPPORTED_SCOPES } from './scopes.constants.js';

@Injectable()
export class ScopesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse a space-delimited scope string, filter to only recognized scopes,
   * and return the validated set.
   */
  parseAndValidate(scopeString?: string): string[] {
    if (!scopeString) return [];
    const requested = scopeString.split(' ').filter(Boolean);
    return requested.filter((s) => SUPPORTED_SCOPES.includes(s));
  }

  /**
   * Given a set of granted scopes, return the flat set of claim names
   * the user is entitled to receive.
   */
  getClaimsForScopes(scopes: string[]): Set<string> {
    const claims = new Set<string>();
    for (const scope of scopes) {
      const scopeClaims = OIDC_SCOPES[scope];
      if (scopeClaims) {
        for (const c of scopeClaims) claims.add(c);
      }
    }
    return claims;
  }

  /**
   * Check whether the requested scopes include 'openid',
   * which triggers ID token issuance.
   */
  hasOpenidScope(scopes: string[]): boolean {
    return scopes.includes('openid');
  }

  /**
   * Convert scopes array back to a space-delimited string.
   */
  toString(scopes: string[]): string {
    return scopes.join(' ');
  }

  /**
   * Get all effective scopes for a client (default + requested optional).
   * Returns the scope names that the client is allowed to use.
   */
  async getClientEffectiveScopes(
    clientDbId: string,
    realmId: string,
    requestedScopes: string[],
  ): Promise<string[]> {
    // Get default scopes (always included)
    const defaultScopes = await this.prisma.clientDefaultScope.findMany({
      where: { clientId: clientDbId },
      include: { clientScope: true },
    });
    const defaultNames = defaultScopes.map((ds) => ds.clientScope.name);

    // Get optional scopes (only if requested)
    const optionalScopes = await this.prisma.clientOptionalScope.findMany({
      where: { clientId: clientDbId },
      include: { clientScope: true },
    });
    const optionalNames = optionalScopes.map((os) => os.clientScope.name);

    // Combine: all defaults + any requested scopes that are in optional
    const effective = new Set(defaultNames);
    for (const s of requestedScopes) {
      if (optionalNames.includes(s)) {
        effective.add(s);
      }
    }

    return [...effective];
  }

  /**
   * Fetch protocol mappers for a set of scope names in a realm.
   */
  async getScopeMappers(scopeNames: string[], realmId: string) {
    if (scopeNames.length === 0) return [];

    const scopes = await this.prisma.clientScope.findMany({
      where: {
        realmId,
        name: { in: scopeNames },
      },
      include: { protocolMappers: true },
    });

    return scopes.flatMap((s) => s.protocolMappers);
  }
}
