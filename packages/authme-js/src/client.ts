import type {
  AuthmeConfig,
  AuthmeEventMap,
  OpenIDConfiguration,
  TokenClaims,
  TokenResponse,
  UserInfo,
} from './types.js';
import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce.js';
import { getTokenExpiresIn, isTokenExpired, parseJwt } from './token.js';
import { createStorage, type TokenStorage } from './storage.js';
import { EventEmitter } from './events.js';

const DEFAULT_SCOPES = ['openid', 'profile', 'email'];
const DEFAULT_REFRESH_BUFFER = 30; // seconds before expiry to trigger refresh

export class AuthmeClient {
  private config: Required<
    Pick<AuthmeConfig, 'url' | 'realm' | 'clientId' | 'redirectUri'>
  > & {
    scopes: string[];
    autoRefresh: boolean;
    refreshBuffer: number;
    postLogoutRedirectUri?: string;
  };

  private storage: TokenStorage;
  private events = new EventEmitter<AuthmeEventMap>();
  private oidcConfig: OpenIDConfiguration | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private cachedUserInfo: UserInfo | null = null;
  private initialized = false;
  private callbackPromise: Promise<boolean> | null = null;

  constructor(config: AuthmeConfig) {
    this.config = {
      url: config.url.replace(/\/$/, ''),
      realm: config.realm,
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes ?? DEFAULT_SCOPES,
      autoRefresh: config.autoRefresh ?? true,
      refreshBuffer: config.refreshBuffer ?? DEFAULT_REFRESH_BUFFER,
      postLogoutRedirectUri: config.postLogoutRedirectUri,
    };
    this.storage = createStorage(config.storage ?? 'sessionStorage');
  }

  // ── Initialization ──────────────────────────────────────────────

  /**
   * Initialize the client: fetch OIDC discovery document and restore any
   * existing session from storage. Must be called before other methods.
   */
  async init(): Promise<boolean> {
    await this.fetchDiscovery();

    const accessToken = this.storage.get('access_token');
    if (accessToken) {
      try {
        const claims = parseJwt(accessToken);
        if (!isTokenExpired(claims)) {
          this.scheduleRefresh();
          this.initialized = true;
          this.events.emit('ready', true);
          return true;
        }
      } catch {
        // Token is malformed, try refresh
      }

      // Try to refresh if we have a refresh token
      const refreshToken = this.storage.get('refresh_token');
      if (refreshToken) {
        try {
          await this.refreshTokens();
          this.initialized = true;
          this.events.emit('ready', true);
          return true;
        } catch {
          this.clearTokens();
        }
      } else {
        this.clearTokens();
      }
    }

    this.initialized = true;
    this.events.emit('ready', false);
    return false;
  }

  // ── Auth Flow ───────────────────────────────────────────────────

  /**
   * Redirect the user to the AuthMe login page.
   * Generates PKCE challenge and state parameter automatically.
   */
  async login(options?: { scope?: string[]; state?: string }): Promise<void> {
    const config = await this.getOidcConfig();
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = options?.state ?? generateState();
    const scopes = options?.scope ?? this.config.scopes;

    this.storage.set('pkce_verifier', verifier);
    this.storage.set('auth_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${config.authorization_endpoint}?${params.toString()}`;
  }

  /**
   * Handle the callback after login redirect. Exchanges the authorization
   * code for tokens. Call this on your redirect URI page.
   * Returns true if tokens were obtained successfully.
   */
  async handleCallback(url?: string): Promise<boolean> {
    // Deduplicate concurrent calls (e.g. React StrictMode double-mount)
    if (this.callbackPromise) return this.callbackPromise;
    this.callbackPromise = this._handleCallback(url);
    try {
      return await this.callbackPromise;
    } finally {
      this.callbackPromise = null;
    }
  }

  private async _handleCallback(url?: string): Promise<boolean> {
    const currentUrl = url ?? window.location.href;
    const params = new URL(currentUrl).searchParams;
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      const description = params.get('error_description') ?? error;
      this.events.emit('error', new Error(description));
      return false;
    }

    if (!code) {
      return false;
    }

    // Verify state
    const storedState = this.storage.get('auth_state');
    if (storedState && state !== storedState) {
      this.events.emit('error', new Error('State mismatch — possible CSRF attack'));
      return false;
    }

    const verifier = this.storage.get('pkce_verifier');
    if (!verifier) {
      this.events.emit('error', new Error('Missing PKCE verifier'));
      return false;
    }

    const config = await this.getOidcConfig();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: verifier,
    });

    const response = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'token_exchange_failed' }));
      this.events.emit('error', new Error(err.error_description ?? err.error));
      return false;
    }

    const tokens: TokenResponse = await response.json();
    this.storeTokens(tokens);
    this.scheduleRefresh();

    // Clean up PKCE state
    this.storage.remove('pkce_verifier');
    this.storage.remove('auth_state');

    // Clean authorization code from URL
    if (typeof window !== 'undefined') {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('code');
      cleanUrl.searchParams.delete('state');
      cleanUrl.searchParams.delete('session_state');
      window.history.replaceState({}, '', cleanUrl.toString());
    }

    this.events.emit('authenticated', tokens);
    return true;
  }

  /**
   * Log the user out. Clears local tokens and calls the server logout endpoint.
   */
  async logout(): Promise<void> {
    const refreshToken = this.storage.get('refresh_token');

    if (refreshToken) {
      try {
        const config = await this.getOidcConfig();
        if (config.end_session_endpoint) {
          await fetch(config.end_session_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
        }
      } catch {
        // Best-effort server logout
      }
    }

    this.clearTokens();
    this.events.emit('logout');

    if (this.config.postLogoutRedirectUri) {
      window.location.href = this.config.postLogoutRedirectUri;
    }
  }

  // ── Token Access ────────────────────────────────────────────────

  /**
   * Get the current access token string.
   * Returns null if not authenticated or the token is expired.
   */
  getAccessToken(): string | null {
    const token = this.storage.get('access_token');
    if (!token) return null;

    try {
      const claims = parseJwt(token);
      if (isTokenExpired(claims)) return null;
      return token;
    } catch {
      return null;
    }
  }

  /** Get the parsed claims from the current access token. */
  getTokenClaims(): TokenClaims | null {
    const token = this.storage.get('access_token');
    if (!token) return null;

    try {
      return parseJwt(token);
    } catch {
      return null;
    }
  }

  /** Get the parsed claims from the current ID token. */
  getIdTokenClaims(): TokenClaims | null {
    const token = this.storage.get('id_token');
    if (!token) return null;

    try {
      return parseJwt(token);
    } catch {
      return null;
    }
  }

  /** Check if the user is currently authenticated with a valid access token. */
  isAuthenticated(): boolean {
    return this.getAccessToken() !== null;
  }

  // ── User Info ───────────────────────────────────────────────────

  /**
   * Fetch fresh user info from the userinfo endpoint.
   * Caches the result — use getUserInfo() to retrieve cached data.
   */
  async fetchUserInfo(): Promise<UserInfo | null> {
    const token = this.getAccessToken();
    if (!token) return null;

    const config = await this.getOidcConfig();
    const response = await fetch(config.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;

    this.cachedUserInfo = await response.json();
    return this.cachedUserInfo;
  }

  /**
   * Get user info from cached data or ID token claims.
   * Call fetchUserInfo() first for fresh server data.
   */
  getUserInfo(): UserInfo | null {
    if (this.cachedUserInfo) return this.cachedUserInfo;

    const idClaims = this.getIdTokenClaims();
    if (idClaims) {
      return {
        sub: idClaims.sub,
        preferred_username: idClaims.preferred_username,
        name: idClaims.name,
        given_name: idClaims.given_name,
        family_name: idClaims.family_name,
        email: idClaims.email,
        email_verified: idClaims.email_verified,
      };
    }

    return null;
  }

  // ── Role Helpers ────────────────────────────────────────────────

  /** Check if the user has a specific realm role. */
  hasRealmRole(role: string): boolean {
    const claims = this.getTokenClaims();
    return claims?.realm_access?.roles?.includes(role) ?? false;
  }

  /** Check if the user has a specific client role. */
  hasClientRole(clientId: string, role: string): boolean {
    const claims = this.getTokenClaims();
    return claims?.resource_access?.[clientId]?.roles?.includes(role) ?? false;
  }

  /** Get all realm roles for the current user. */
  getRealmRoles(): string[] {
    const claims = this.getTokenClaims();
    return claims?.realm_access?.roles ?? [];
  }

  /** Get all client roles for a specific client. */
  getClientRoles(clientId: string): string[] {
    const claims = this.getTokenClaims();
    return claims?.resource_access?.[clientId]?.roles ?? [];
  }

  // ── Token Refresh ───────────────────────────────────────────────

  /**
   * Manually refresh the access token using the refresh token.
   * This is called automatically when autoRefresh is enabled.
   */
  async refreshTokens(): Promise<TokenResponse> {
    const refreshToken = this.storage.get('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const config = await this.getOidcConfig();
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: this.config.clientId,
    });

    const response = await fetch(config.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      this.clearTokens();
      const err = await response.json().catch(() => ({ error: 'refresh_failed' }));
      throw new Error(err.error_description ?? err.error);
    }

    const tokens: TokenResponse = await response.json();
    this.storeTokens(tokens);
    this.scheduleRefresh();
    this.events.emit('tokenRefreshed', tokens);
    return tokens;
  }

  // ── Events ──────────────────────────────────────────────────────

  /** Subscribe to an event. */
  on<K extends keyof AuthmeEventMap>(
    event: K,
    handler: AuthmeEventMap[K] extends void ? () => void : (data: AuthmeEventMap[K]) => void,
  ): void {
    this.events.on(event, handler);
  }

  /** Unsubscribe from an event. */
  off<K extends keyof AuthmeEventMap>(
    event: K,
    handler: AuthmeEventMap[K] extends void ? () => void : (data: AuthmeEventMap[K]) => void,
  ): void {
    this.events.off(event, handler);
  }

  // ── Internal ────────────────────────────────────────────────────

  private async fetchDiscovery(): Promise<void> {
    const url = `${this.config.url}/realms/${this.config.realm}/.well-known/openid-configuration`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch OIDC discovery document from ${url}`);
    }
    this.oidcConfig = await response.json();
  }

  private async getOidcConfig(): Promise<OpenIDConfiguration> {
    if (!this.oidcConfig) {
      await this.fetchDiscovery();
    }
    return this.oidcConfig!;
  }

  private storeTokens(tokens: TokenResponse): void {
    this.storage.set('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      this.storage.set('refresh_token', tokens.refresh_token);
    }
    if (tokens.id_token) {
      this.storage.set('id_token', tokens.id_token);
    }
    // Clear cached user info so it's re-fetched with new token
    this.cachedUserInfo = null;
  }

  private clearTokens(): void {
    this.cancelRefreshTimer();
    this.storage.clear();
    this.cachedUserInfo = null;
  }

  private scheduleRefresh(): void {
    if (!this.config.autoRefresh) return;
    this.cancelRefreshTimer();

    const token = this.storage.get('access_token');
    if (!token) return;

    try {
      const claims = parseJwt(token);
      const expiresIn = getTokenExpiresIn(claims);
      const refreshIn = Math.max(0, expiresIn - this.config.refreshBuffer) * 1000;

      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshTokens();
        } catch (err) {
          this.events.emit('error', err instanceof Error ? err : new Error(String(err)));
        }
      }, refreshIn);
    } catch {
      // Token parse failure — don't schedule
    }
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
