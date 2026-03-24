/**
 * Server Component helpers for Next.js App Router.
 *
 * Use these in React Server Components (or `generateMetadata`, route handlers)
 * to read the current auth session from cookies without a client-side round-trip.
 *
 * @example
 * ```typescript
 * // app/dashboard/page.tsx
 * import { cookies } from 'next/headers';
 * import { getServerAuth, getServerUser } from '@authme/nextjs/server';
 * import { redirect } from 'next/navigation';
 *
 * export default async function DashboardPage() {
 *   const cookieStore = cookies();
 *   const user = await getServerUser(cookieStore, {
 *     serverUrl: 'http://localhost:3000',
 *     realm: 'my-realm',
 *   });
 *
 *   if (!user) redirect('/login');
 *   return <div>Hello, {user.name}</div>;
 * }
 * ```
 */

// ── Shared types ─────────────────────────────────────────────────

export interface ServerAuthConfig {
  /** AuthMe server base URL */
  serverUrl: string;
  /** Realm name */
  realm: string;
  /** Cookie name holding the access token (default: "authme_access_token") */
  cookieName?: string;
}

export interface AuthSession {
  /** Raw access token string */
  accessToken: string;
  /** Decoded JWT payload */
  payload: TokenPayload;
  /** Whether the session is authenticated */
  isAuthenticated: true;
}

export interface User {
  sub: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
  [key: string]: unknown;
}

export interface TokenPayload extends User {
  iss: string;
  aud: string | string[];
  exp: number;
  iat: number;
  azp?: string;
  sid?: string;
  scope?: string;
}

/**
 * Minimal ReadonlyRequestCookies interface — matches the shape returned by
 * `cookies()` from `next/headers` without a hard import.
 */
export interface ReadonlyRequestCookies {
  get(name: string): { name: string; value: string } | undefined;
}

// ── JWT decode (no verification — use verifyToken from authme-sdk/server for full JWKS validation) ──

/**
 * Decode a JWT payload.  For server components, this avoids an extra network
 * call when the token was already verified upstream (e.g. in middleware).
 * For full cryptographic verification use `verifyToken` from `authme-sdk/server`.
 */
function decodeJwtPayload(token: string): TokenPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const json = Buffer.from(
      payloadB64.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8');
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

function isExpired(payload: TokenPayload): boolean {
  return Date.now() / 1000 > payload.exp;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Read and decode the auth session from request cookies (Next.js Server Components).
 *
 * Returns `AuthSession | null`.  The token is decoded locally (no JWKS call).
 * Call `verifyToken` from `authme-sdk/server` if you need cryptographic validation.
 */
export async function getServerAuth(
  cookies: ReadonlyRequestCookies,
  config?: ServerAuthConfig,
): Promise<AuthSession | null> {
  const cookieName = config?.cookieName ?? 'authme_access_token';
  const accessToken = cookies.get(cookieName)?.value;

  if (!accessToken) return null;

  const payload = decodeJwtPayload(accessToken);
  if (!payload || isExpired(payload)) return null;

  return { accessToken, payload, isAuthenticated: true };
}

/**
 * Convenience wrapper that returns just the `User` object from the session,
 * or `null` if the user is not authenticated.
 */
export async function getServerUser(
  cookies: ReadonlyRequestCookies,
  config?: ServerAuthConfig,
): Promise<User | null> {
  const session = await getServerAuth(cookies, config);
  if (!session) return null;

  const { payload } = session;
  return {
    sub: payload.sub!,
    preferred_username: payload.preferred_username,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    email: payload.email,
    email_verified: payload.email_verified,
    realm_access: payload.realm_access,
    resource_access: payload.resource_access,
  };
}
