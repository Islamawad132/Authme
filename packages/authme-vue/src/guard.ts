/**
 * Vue Router navigation guard for AuthMe.
 *
 * @example
 * ```typescript
 * // router/index.ts
 * import { createRouter, createWebHistory } from 'vue-router';
 * import { createAuthGuard } from '@authme/vue';
 *
 * const router = createRouter({ history: createWebHistory(), routes });
 *
 * router.beforeEach(createAuthGuard({
 *   loginRoute: '/login',
 *   roles: ['admin'],  // optional — require roles on all guarded routes
 * }));
 *
 * export default router;
 * ```
 *
 * Or use the guard selectively via route meta:
 * ```typescript
 * const routes = [
 *   {
 *     path: '/dashboard',
 *     component: Dashboard,
 *     meta: { requiresAuth: true, roles: ['admin'] },
 *   },
 * ];
 * ```
 */

import type { NavigationGuard, RouteLocationNormalized } from 'vue-router';
import { inject } from 'vue';
import type { AuthmeClient } from 'authme-sdk';
import { AUTHME_KEY } from './plugin.js';

export interface AuthGuardOptions {
  /**
   * Route name or path to redirect unauthenticated users to.
   * Default: '/login'
   */
  loginRoute?: string;
  /**
   * Global required roles — the user must have ALL of them to proceed.
   * Per-route roles in `route.meta.roles` override this.
   */
  roles?: string[];
}

/** Extended route meta fields recognised by createAuthGuard. */
export interface AuthRouteMeta {
  /** If true (or roles are set), the route is protected. */
  requiresAuth?: boolean;
  /** Roles required to access this specific route. */
  roles?: string[];
}

/**
 * Create a Vue Router `NavigationGuard` that enforces authentication and
 * optional role requirements.
 *
 * The guard reads the `AuthmeClient` from the Vue provide/inject system, so
 * it must be used inside a component tree that has had `AuthmePlugin` installed.
 *
 * For use outside a component (e.g. in router/index.ts before `app.use`),
 * pass a pre-built `client` directly:
 *
 * ```typescript
 * import { createAuthGuard } from '@authme/vue';
 * import { AuthmeClient } from 'authme-sdk';
 *
 * const client = new AuthmeClient({ ... });
 * router.beforeEach(createAuthGuard({ loginRoute: '/login' }, client));
 * ```
 */
export function createAuthGuard(
  options: AuthGuardOptions = {},
  clientOverride?: AuthmeClient,
): NavigationGuard {
  const { loginRoute = '/login', roles: globalRoles = [] } = options;

  return async (
    to: RouteLocationNormalized,
    _from: RouteLocationNormalized,
  ) => {
    // Resolve the client — prefer the explicit override, then injected.
    let client: AuthmeClient | undefined = clientOverride;
    if (!client) {
      // inject() only works inside component setup context; fall back gracefully.
      try {
        client = inject<AuthmeClient>(AUTHME_KEY);
      } catch {
        // Outside component context — client must be passed explicitly.
      }
    }

    if (!client) {
      console.warn(
        '[authme-vue] createAuthGuard: no AuthmeClient available. ' +
          'Pass the client as the second argument or install AuthmePlugin.',
      );
      return true; // fail-open so navigation is not permanently blocked
    }

    const meta = to.meta as AuthRouteMeta | undefined;
    const routeRequiresAuth =
      meta?.requiresAuth === true ||
      (meta?.roles && meta.roles.length > 0) ||
      globalRoles.length > 0;

    if (!routeRequiresAuth) return true;

    // Ensure the client is initialized before checking auth state
    if (!client.isAuthenticated()) {
      try {
        await client.init();
      } catch {
        // init failed — treat as unauthenticated
      }
    }

    if (!client.isAuthenticated()) {
      return { path: loginRoute, query: { next: to.fullPath } };
    }

    // Role check — per-route roles take precedence over global
    const requiredRoles = (meta?.roles ?? globalRoles);
    if (requiredRoles.length > 0) {
      const hasAll = requiredRoles.every((role) => client!.hasRealmRole(role));
      if (!hasAll) {
        // Redirect to login (or a dedicated forbidden page if you want)
        return { path: loginRoute, query: { error: 'forbidden' } };
      }
    }

    return true;
  };
}
