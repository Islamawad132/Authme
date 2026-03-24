/**
 * Next.js middleware factory for AuthMe authentication.
 *
 * Use `createAuthMiddleware` in your `middleware.ts` file to protect routes
 * by checking for a valid auth cookie or Bearer token.
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { NextResponse } from 'next/server';
 * import { createAuthMiddleware } from '@authme/nextjs/middleware';
 *
 * const authMiddleware = createAuthMiddleware({
 *   serverUrl: 'http://localhost:3000',
 *   realm: 'my-realm',
 *   clientId: 'my-app',
 *   protectedPaths: ['/dashboard', '/api/protected'],
 *   loginPath: '/login',
 * });
 *
 * export default function middleware(request: NextRequest) {
 *   return authMiddleware(request, NextResponse);
 * }
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 */

export interface AuthMiddlewareConfig {
  /** AuthMe server base URL (e.g. "http://localhost:3000") */
  serverUrl: string;
  /** Realm name */
  realm: string;
  /** OAuth2 client ID */
  clientId: string;
  /** Path prefixes that require authentication (default: []) */
  protectedPaths?: string[];
  /** Path to redirect unauthenticated users to (default: "/login") */
  loginPath?: string;
  /** Cookie name that holds the access token (default: "authme_access_token") */
  cookieName?: string;
}

/**
 * Minimal shape of the Next.js NextRequest we depend on.
 * Using a structural type so we don't require `next` at compile time
 * when this module is tested in isolation.
 */
interface IncomingRequest {
  nextUrl: { pathname: string; searchParams: URLSearchParams };
  url: string;
  headers: { get(name: string): string | null };
  cookies: { get(name: string): { value: string } | undefined };
}

/**
 * Minimal shape of NextResponse that we return from the factory.
 * The actual `NextResponse` is injected at call time so this package
 * stays free of a hard `next` dependency at import time.
 */
interface NextResponseStatic {
  redirect(url: URL | string, init?: { status?: number }): Response;
  next(): Response;
}

/**
 * Decode a JWT payload without verification (verification happens server-side
 * via JWKS when using `getServerAuth`).  Here we just need the `exp` claim to
 * decide whether to redirect without an extra round-trip.
 */
function isTokenExpiredLocally(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return true;
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 > payload.exp;
  } catch {
    return true;
  }
}

/**
 * Create a Next.js Edge-compatible middleware function that checks for a valid
 * auth cookie or Bearer token on protected paths, redirecting to `loginPath`
 * when the user is not authenticated.
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const {
    protectedPaths = [],
    loginPath = '/login',
    cookieName = 'authme_access_token',
  } = config;

  return async function authMiddleware(
    request: IncomingRequest,
    NextResponse: NextResponseStatic,
  ): Promise<Response> {
    const pathname = request.nextUrl.pathname;

    // Skip non-protected paths
    const isProtected = protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(path + '/'),
    );
    if (!isProtected) return NextResponse.next();

    // Don't redirect if we're already on the login path
    if (pathname.startsWith(loginPath)) return NextResponse.next();

    // 1. Try Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (bearerToken && !isTokenExpiredLocally(bearerToken)) {
      return NextResponse.next();
    }

    // 2. Try auth cookie
    const cookieToken = request.cookies.get(cookieName)?.value;
    if (cookieToken && !isTokenExpiredLocally(cookieToken)) {
      return NextResponse.next();
    }

    // Not authenticated — redirect to login with the original URL as a `next` param
    const loginUrl = new URL(loginPath, request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  };
}
