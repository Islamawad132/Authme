/**
 * Check if a redirect URI matches any of the registered patterns.
 * Supports wildcard patterns: a URI ending with `/*` matches any path
 * under that base (e.g., `http://localhost:4000/*` matches
 * `http://localhost:4000/callback`).
 */
export function matchesRedirectUri(
  redirectUri: string,
  registeredUris: string[],
): boolean {
  return registeredUris.some((pattern) => {
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -1); // remove trailing '*', keep '/'
      return redirectUri === base.slice(0, -1) || redirectUri.startsWith(base);
    }
    return pattern === redirectUri;
  });
}
