export interface UserClaimSource {
  id: string;
  username: string;
  email: string | null;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Build the full claims object for a user, then filter to only
 * those claims allowed by the granted scopes.
 */
export function resolveUserClaims(
  user: UserClaimSource,
  allowedClaims: Set<string>,
): Record<string, unknown> {
  const allClaims: Record<string, unknown> = {
    sub: user.id,
    preferred_username: user.username,
    given_name: user.firstName ?? undefined,
    family_name: user.lastName ?? undefined,
    name:
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : (user.firstName ?? user.lastName ?? undefined),
    email: user.email ?? undefined,
    email_verified: user.emailVerified,
  };

  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(allClaims)) {
    if (allowedClaims.has(key) && value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}
