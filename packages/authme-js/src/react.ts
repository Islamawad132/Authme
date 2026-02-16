import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthmeClient } from './client.js';
import type { UserInfo } from './types.js';

// Re-export core for convenience
export { AuthmeClient } from './client.js';
export type {
  AuthmeConfig,
  AuthmeEventMap,
  TokenClaims,
  TokenResponse,
  UserInfo,
} from './types.js';

// ── Context ─────────────────────────────────────────────────────

interface AuthmeContextValue {
  client: AuthmeClient;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserInfo | null;
  login: (options?: { scope?: string[] }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthmeContext = createContext<AuthmeContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────

interface AuthmeProviderProps {
  client: AuthmeClient;
  children: ReactNode;
  /** If true, automatically calls handleCallback when URL has ?code= (default: true) */
  autoHandleCallback?: boolean;
  /** Called when initialization is complete */
  onReady?: (authenticated: boolean) => void;
}

export function AuthmeProvider({
  client,
  children,
  autoHandleCallback = true,
  onReady,
}: AuthmeProviderProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    let mounted = true;

    const onAuthenticated = () => {
      if (!mounted) return;
      setIsAuthenticated(true);
      setUser(client.getUserInfo());
    };

    const onLogout = () => {
      if (!mounted) return;
      setIsAuthenticated(false);
      setUser(null);
    };

    const onTokenRefreshed = () => {
      if (!mounted) return;
      setUser(client.getUserInfo());
    };

    client.on('authenticated', onAuthenticated);
    client.on('logout', onLogout);
    client.on('tokenRefreshed', onTokenRefreshed);

    async function initialize() {
      try {
        // Check if URL has authorization code
        const hasCode =
          typeof window !== 'undefined' &&
          new URL(window.location.href).searchParams.has('code');

        if (hasCode && autoHandleCallback) {
          const success = await client.handleCallback();
          if (mounted) {
            setIsAuthenticated(success);
            if (success) setUser(client.getUserInfo());
            setIsLoading(false);
            onReady?.(success);
          }
          return;
        }

        const restored = await client.init();
        if (mounted) {
          setIsAuthenticated(restored);
          if (restored) setUser(client.getUserInfo());
          setIsLoading(false);
          onReady?.(restored);
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
          setIsLoading(false);
          onReady?.(false);
        }
      }
    }

    initialize();

    return () => {
      mounted = false;
      client.off('authenticated', onAuthenticated);
      client.off('logout', onLogout);
      client.off('tokenRefreshed', onTokenRefreshed);
    };
  }, [client, autoHandleCallback, onReady]);

  const login = useCallback(
    (options?: { scope?: string[] }) => client.login(options),
    [client],
  );

  const logout = useCallback(() => client.logout(), [client]);

  const value = useMemo(
    () => ({ client, isAuthenticated, isLoading, user, login, logout }),
    [client, isAuthenticated, isLoading, user, login, logout],
  );

  return createElement(AuthmeContext.Provider, { value }, children);
}

// ── Hooks ───────────────────────────────────────────────────────

function useAuthmeContext(): AuthmeContextValue {
  const ctx = useContext(AuthmeContext);
  if (!ctx) {
    throw new Error('useAuthme must be used within an <AuthmeProvider>');
  }
  return ctx;
}

/**
 * Hook for authentication state and actions.
 *
 * ```tsx
 * const { isAuthenticated, isLoading, login, logout } = useAuthme();
 * ```
 */
export function useAuthme() {
  const { client, isAuthenticated, isLoading, login, logout } = useAuthmeContext();
  const token = isAuthenticated ? client.getAccessToken() : null;
  return { isAuthenticated, isLoading, login, logout, token, client };
}

/**
 * Hook for user information from the ID token or userinfo endpoint.
 *
 * ```tsx
 * const user = useUser();
 * // user?.name, user?.email, etc.
 * ```
 */
export function useUser(): UserInfo | null {
  const { user } = useAuthmeContext();
  return user;
}

/**
 * Hook for role-checking helpers.
 *
 * ```tsx
 * const { hasRealmRole, hasClientRole } = useRoles();
 * if (hasRealmRole('admin')) { ... }
 * ```
 */
export function useRoles() {
  const { client, isAuthenticated } = useAuthmeContext();

  const hasRealmRole = useCallback(
    (role: string) => (isAuthenticated ? client.hasRealmRole(role) : false),
    [client, isAuthenticated],
  );

  const hasClientRole = useCallback(
    (clientId: string, role: string) =>
      isAuthenticated ? client.hasClientRole(clientId, role) : false,
    [client, isAuthenticated],
  );

  const realmRoles = useMemo(
    () => (isAuthenticated ? client.getRealmRoles() : []),
    [client, isAuthenticated],
  );

  const getClientRoles = useCallback(
    (clientId: string) => (isAuthenticated ? client.getClientRoles(clientId) : []),
    [client, isAuthenticated],
  );

  return { hasRealmRole, hasClientRole, realmRoles, getClientRoles };
}
