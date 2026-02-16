/** Configuration for creating an AuthmeClient instance. */
export interface AuthmeConfig {
  /** Base URL of the AuthMe server (e.g. "http://localhost:3000") */
  url: string;
  /** Realm name to authenticate against */
  realm: string;
  /** OAuth2 client ID (must be registered in AuthMe as a PUBLIC client) */
  clientId: string;
  /** URL to redirect back to after login */
  redirectUri: string;
  /** OAuth2 scopes to request (default: ["openid", "profile", "email"]) */
  scopes?: string[];
  /** Storage type for tokens (default: "sessionStorage") */
  storage?: 'sessionStorage' | 'localStorage' | 'memory';
  /** Automatically refresh tokens before expiry (default: true) */
  autoRefresh?: boolean;
  /** Seconds before expiry to trigger a refresh (default: 30) */
  refreshBuffer?: number;
  /** URL to redirect to after logout (optional) */
  postLogoutRedirectUri?: string;
}

/** Raw token response from the token endpoint. */
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

/** Parsed JWT claims from an access token. */
export interface TokenClaims {
  /** Subject (user ID) */
  sub: string;
  /** Issuer */
  iss: string;
  /** Audience (client ID) */
  aud: string | string[];
  /** Expiration time (unix seconds) */
  exp: number;
  /** Issued at (unix seconds) */
  iat: number;
  /** Token type */
  typ?: string;
  /** Authorized party (client ID) */
  azp?: string;
  /** Session ID */
  sid?: string;
  /** JWT ID */
  jti?: string;
  /** Granted scopes (space-separated) */
  scope?: string;
  /** Nonce (from authorization request) */
  nonce?: string;
  /** Authentication time (unix seconds) */
  auth_time?: number;
  /** Access token hash (ID tokens only) */
  at_hash?: string;
  /** Authentication Context Class Reference */
  acr?: string;

  // User claims (present based on scopes)
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  updated_at?: number;

  // Role claims
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;

  // Allow additional custom claims
  [key: string]: unknown;
}

/** User information returned by the userinfo endpoint or parsed from the ID token. */
export interface UserInfo {
  sub: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

/** OIDC Discovery document shape. */
export interface OpenIDConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
  introspection_endpoint?: string;
  revocation_endpoint?: string;
  device_authorization_endpoint?: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  subject_types_supported: string[];
  id_token_signing_alg_values_supported: string[];
  scopes_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  claims_supported: string[];
  code_challenge_methods_supported?: string[];
}

/** Events emitted by AuthmeClient. */
export type AuthmeEventMap = {
  authenticated: TokenResponse;
  logout: void;
  tokenRefreshed: TokenResponse;
  error: Error;
  ready: boolean;
};
