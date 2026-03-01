/**
 * Server-side utilities for AuthMe token validation.
 *
 * Provides middleware for Express and guard for NestJS
 * that validate JWT access tokens using JWKS.
 *
 * @example
 * ```typescript
 * import { createAuthmeMiddleware } from 'authme-sdk/server';
 *
 * app.use('/api', createAuthmeMiddleware({
 *   issuerUrl: 'http://localhost:3000',
 *   realm: 'my-realm',
 * }));
 * ```
 */

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface AuthmeServerConfig {
  /** AuthMe server base URL (e.g., 'http://localhost:3000') */
  issuerUrl: string;
  /** Realm name */
  realm: string;
  /** Optional: required roles to access (realm roles) */
  requiredRoles?: string[];
  /** Optional: custom claim to extract roles from (default: 'realm_access.roles') */
  rolesClaimPath?: string;
}

export interface AuthmeTokenPayload extends JWTPayload {
  preferred_username?: string;
  email?: string;
  name?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

// Cache JWKS instances per issuer with a TTL to support key rotation
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const jwksCache = new Map<string, { jwks: ReturnType<typeof createRemoteJWKSet>; cachedAt: number }>();

function getJWKS(issuerUrl: string, realm: string) {
  const url = `${issuerUrl}/realms/${realm}/protocol/openid-connect/certs`;
  const cached = jwksCache.get(url);
  if (!cached || Date.now() - cached.cachedAt > JWKS_CACHE_TTL_MS) {
    jwksCache.set(url, { jwks: createRemoteJWKSet(new URL(url)), cachedAt: Date.now() });
  }
  return jwksCache.get(url)!.jwks;
}

/**
 * Verify an AuthMe JWT access token and return the decoded payload.
 */
export async function verifyToken(
  token: string,
  config: AuthmeServerConfig,
): Promise<AuthmeTokenPayload> {
  const JWKS = getJWKS(config.issuerUrl, config.realm);
  const issuer = `${config.issuerUrl}/realms/${config.realm}`;

  const { payload } = await jwtVerify(token, JWKS, { issuer });
  return payload as AuthmeTokenPayload;
}

/**
 * Check if a token payload has the required realm roles.
 */
export function hasRealmRoles(
  payload: AuthmeTokenPayload,
  requiredRoles: string[],
): boolean {
  const userRoles = payload.realm_access?.roles ?? [];
  return requiredRoles.every((role) => userRoles.includes(role));
}

/**
 * Check if a token payload has the required client roles.
 */
export function hasClientRoles(
  payload: AuthmeTokenPayload,
  clientId: string,
  requiredRoles: string[],
): boolean {
  const userRoles = payload.resource_access?.[clientId]?.roles ?? [];
  return requiredRoles.every((role) => userRoles.includes(role));
}

// ─── Express Middleware ────────────────────────────────────

export interface AuthmeRequest {
  user?: AuthmeTokenPayload;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Create an Express middleware that validates AuthMe JWT access tokens.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAuthmeMiddleware } from 'authme-sdk/server';
 *
 * const app = express();
 * const authme = createAuthmeMiddleware({
 *   issuerUrl: 'http://localhost:3000',
 *   realm: 'my-realm',
 * });
 *
 * app.get('/api/profile', authme, (req, res) => {
 *   res.json(req.user);
 * });
 * ```
 */
export function createAuthmeMiddleware(config: AuthmeServerConfig) {
  return async (
    req: AuthmeRequest,
    res: { status: (code: number) => { json: (body: unknown) => void } },
    next: () => void,
  ) => {
    const authHeader = req.headers['authorization'] ?? req.headers['Authorization'];
    const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing Bearer token' });
    }

    const token = header.slice(7);

    try {
      const payload = await verifyToken(token, config);

      if (config.requiredRoles?.length) {
        if (!hasRealmRoles(payload, config.requiredRoles)) {
          return res.status(403).json({ error: 'forbidden', message: 'Insufficient roles' });
        }
      }

      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  };
}

// ─── NestJS Guard ─────────────────────────────────────────

/**
 * Lightweight HttpException-compatible error that NestJS exception filters
 * recognize without requiring @nestjs/common as a dependency.
 */
class HttpError extends Error {
  constructor(
    private readonly response: string | object,
    private readonly statusCode: number,
  ) {
    super(typeof response === 'string' ? response : JSON.stringify(response));
  }
  getStatus() {
    return this.statusCode;
  }
  getResponse() {
    return this.response;
  }
}

/**
 * NestJS-compatible guard factory for AuthMe token validation.
 *
 * @example
 * ```typescript
 * import { createAuthmeGuard } from 'authme-sdk/server';
 *
 * const AuthmeGuard = createAuthmeGuard({
 *   issuerUrl: 'http://localhost:3000',
 *   realm: 'my-realm',
 * });
 *
 * @Controller('api')
 * export class AppController {
 *   @Get('profile')
 *   @UseGuards(AuthmeGuard)
 *   getProfile(@Req() req) {
 *     return req.user;
 *   }
 * }
 * ```
 */
export function createAuthmeGuard(config: AuthmeServerConfig) {
  return class AuthmeGuard {
    async canActivate(context: {
      switchToHttp: () => { getRequest: () => AuthmeRequest };
    }): Promise<boolean> {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers['authorization'] ?? request.headers['Authorization'];
      const header = Array.isArray(authHeader) ? authHeader[0] : authHeader;

      if (!header?.startsWith('Bearer ')) {
        throw new HttpError({ statusCode: 401, message: 'Missing Bearer token', error: 'Unauthorized' }, 401);
      }

      try {
        const token = header.slice(7);
        const payload = await verifyToken(token, config);

        if (config.requiredRoles?.length) {
          if (!hasRealmRoles(payload, config.requiredRoles)) {
            throw new HttpError({ statusCode: 403, message: 'Insufficient roles', error: 'Forbidden' }, 403);
          }
        }

        request.user = payload;
        return true;
      } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError({ statusCode: 401, message: 'Invalid or expired token', error: 'Unauthorized' }, 401);
      }
    }
  };
}

/**
 * Helper to extract roles from an AuthMe token payload.
 */
export function getRolesFromToken(
  payload: AuthmeTokenPayload,
  clientId?: string,
): string[] {
  if (clientId) {
    return payload.resource_access?.[clientId]?.roles ?? [];
  }
  return payload.realm_access?.roles ?? [];
}
