import { Injectable } from '@nestjs/common';
import { OIDC_SCOPES, SUPPORTED_SCOPES } from './scopes.constants.js';

@Injectable()
export class ScopesService {
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
}
