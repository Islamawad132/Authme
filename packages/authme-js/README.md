# authme-js

Client SDK for [AuthMe](https://github.com/Islamawad132/Authme) — an open-source Identity and Access Management server.

Handles OAuth 2.0 Authorization Code + PKCE flow, token management, auto-refresh, and provides React bindings. Zero runtime dependencies.

## Install

```bash
npm install authme-js
```

## Quick Start

### Vanilla JavaScript / TypeScript

```typescript
import { AuthmeClient } from 'authme-js';

const authme = new AuthmeClient({
  url: 'http://localhost:3000',
  realm: 'my-realm',
  clientId: 'my-app',
  redirectUri: 'http://localhost:5173/callback',
});

// Initialize (restores existing session if any)
await authme.init();

if (!authme.isAuthenticated()) {
  // Redirects to AuthMe login page
  await authme.login();
}
```

On your callback page:

```typescript
const authme = new AuthmeClient({ /* same config */ });
const success = await authme.handleCallback();
if (success) {
  const user = authme.getUserInfo();
  console.log(`Welcome, ${user?.name}!`);
}
```

### React

```tsx
import { AuthmeClient } from 'authme-js';
import { AuthmeProvider, useAuthme, useUser, useRoles } from 'authme-js/react';

const authme = new AuthmeClient({
  url: 'http://localhost:3000',
  realm: 'my-realm',
  clientId: 'my-app',
  redirectUri: 'http://localhost:5173/callback',
});

function App() {
  return (
    <AuthmeProvider client={authme}>
      <Main />
    </AuthmeProvider>
  );
}

function Main() {
  const { isAuthenticated, isLoading, login, logout } = useAuthme();
  const user = useUser();
  const { hasRealmRole } = useRoles();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={() => login()}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      {hasRealmRole('admin') && <p>You are an admin.</p>}
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```

## API Reference

### `AuthmeClient`

#### Constructor

```typescript
new AuthmeClient(config: AuthmeConfig)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | *required* | AuthMe server URL |
| `realm` | `string` | *required* | Realm name |
| `clientId` | `string` | *required* | OAuth2 client ID (PUBLIC client) |
| `redirectUri` | `string` | *required* | Callback URL after login |
| `scopes` | `string[]` | `['openid', 'profile', 'email']` | OAuth2 scopes |
| `storage` | `'sessionStorage' \| 'localStorage' \| 'memory'` | `'sessionStorage'` | Token storage |
| `autoRefresh` | `boolean` | `true` | Auto-refresh tokens before expiry |
| `refreshBuffer` | `number` | `30` | Seconds before expiry to refresh |
| `postLogoutRedirectUri` | `string` | — | URL to redirect after logout |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | `Promise<boolean>` | Initialize client, restore session. Returns `true` if authenticated. |
| `login(options?)` | `Promise<void>` | Redirect to AuthMe login page |
| `handleCallback(url?)` | `Promise<boolean>` | Exchange authorization code for tokens |
| `logout()` | `Promise<void>` | Clear tokens and call server logout |
| `getAccessToken()` | `string \| null` | Current access token (null if expired) |
| `getTokenClaims()` | `TokenClaims \| null` | Parsed access token JWT payload |
| `getIdTokenClaims()` | `TokenClaims \| null` | Parsed ID token JWT payload |
| `isAuthenticated()` | `boolean` | Whether user has a valid access token |
| `fetchUserInfo()` | `Promise<UserInfo \| null>` | Fetch user info from server |
| `getUserInfo()` | `UserInfo \| null` | Cached user info (from ID token or last fetch) |
| `hasRealmRole(role)` | `boolean` | Check realm role |
| `hasClientRole(clientId, role)` | `boolean` | Check client role |
| `getRealmRoles()` | `string[]` | All realm roles |
| `getClientRoles(clientId)` | `string[]` | All client roles |
| `refreshTokens()` | `Promise<TokenResponse>` | Manually refresh tokens |
| `on(event, handler)` | `void` | Subscribe to events |
| `off(event, handler)` | `void` | Unsubscribe from events |

#### Events

| Event | Payload | When |
|-------|---------|------|
| `authenticated` | `TokenResponse` | After successful login or callback |
| `logout` | — | After logout |
| `tokenRefreshed` | `TokenResponse` | After silent token refresh |
| `error` | `Error` | On any auth error |
| `ready` | `boolean` | After `init()` completes (true if authenticated) |

### React Hooks

#### `useAuthme()`

```typescript
const { isAuthenticated, isLoading, login, logout, token, client } = useAuthme();
```

#### `useUser()`

```typescript
const user = useUser();
// user?.sub, user?.name, user?.email, user?.preferred_username, etc.
```

#### `useRoles()`

```typescript
const { hasRealmRole, hasClientRole, realmRoles, getClientRoles } = useRoles();

hasRealmRole('admin');           // boolean
hasClientRole('my-app', 'edit'); // boolean
realmRoles;                      // string[]
getClientRoles('my-app');        // string[]
```

## AuthMe Client Setup

For the SDK to work, you need a **PUBLIC** client registered in AuthMe:

1. Open the AuthMe Admin Console
2. Go to your realm > Clients > Create
3. Set **Client Type** to `PUBLIC`
4. Add your app's URL to **Redirect URIs** (e.g. `http://localhost:5173/callback`)
5. Add your app's origin to **Web Origins** (e.g. `http://localhost:5173`)
6. Enable the `authorization_code` and `refresh_token` grant types

## Using Generic OIDC Libraries

Since AuthMe implements standard OpenID Connect, you can also use generic OIDC client libraries:

### With `oidc-client-ts` + `react-oidc-context`

```bash
npm install oidc-client-ts react-oidc-context
```

```tsx
import { AuthProvider, useAuth } from 'react-oidc-context';

const oidcConfig = {
  authority: 'http://localhost:3000/realms/my-realm',
  client_id: 'my-app',
  redirect_uri: 'http://localhost:5173/callback',
};

function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <Main />
    </AuthProvider>
  );
}

function Main() {
  const auth = useAuth();

  if (auth.isLoading) return <div>Loading...</div>;
  if (!auth.isAuthenticated) {
    return <button onClick={() => auth.signinRedirect()}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {auth.user?.profile.name}!</p>
      <button onClick={() => auth.signoutRedirect()}>Sign Out</button>
    </div>
  );
}
```

### With `next-auth` (Next.js)

AuthMe works as a standard OIDC provider with `next-auth`:

```typescript
import NextAuth from 'next-auth';

export const { handlers, auth } = NextAuth({
  providers: [{
    id: 'authme',
    name: 'AuthMe',
    type: 'oidc',
    issuer: 'http://localhost:3000/realms/my-realm',
    clientId: 'my-nextjs-app',
    clientSecret: 'your-client-secret',
  }],
});
```

## License

MIT
