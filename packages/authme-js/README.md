<p align="center">
  <img src="https://authme.dev/logo.svg" alt="AuthMe" width="60" />
</p>

<h2 align="center">authme-sdk</h2>

<p align="center">
  <strong>Official client SDK for <a href="https://authme.dev">AuthMe</a></strong><br />
  <sub>Zero-dependency TypeScript SDK with OAuth 2.0 PKCE, token management, and React bindings.</sub>
</p>

---

## Install

```bash
npm install authme-sdk
```

## Quick Start

### Vanilla JavaScript / TypeScript

```typescript
import { AuthmeClient } from 'authme-sdk';

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
import { AuthmeClient } from 'authme-sdk';
import { AuthmeProvider, useAuthme, useUser, useRoles } from 'authme-sdk/react';

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

---

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
| `scopes` | `string[]` | `['openid', 'profile', 'email']` | OAuth2 scopes to request |
| `storage` | `'sessionStorage' \| 'localStorage' \| 'memory'` | `'sessionStorage'` | Where to persist tokens |
| `autoRefresh` | `boolean` | `true` | Automatically refresh tokens before expiry |
| `refreshBuffer` | `number` | `30` | Seconds before expiry to trigger refresh |
| `postLogoutRedirectUri` | `string` | — | URL to redirect after logout |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `init()` | `Promise<boolean>` | Initialize client, restore session. Returns `true` if authenticated |
| `login(options?)` | `Promise<void>` | Redirect to AuthMe login page |
| `handleCallback(url?)` | `Promise<boolean>` | Exchange authorization code for tokens |
| `logout()` | `Promise<void>` | Clear tokens and call server logout endpoint |
| `getAccessToken()` | `string \| null` | Current access token (null if expired) |
| `getTokenClaims()` | `TokenClaims \| null` | Parsed access token JWT payload |
| `getIdTokenClaims()` | `TokenClaims \| null` | Parsed ID token JWT payload |
| `isAuthenticated()` | `boolean` | Whether user has a valid, non-expired access token |
| `fetchUserInfo()` | `Promise<UserInfo \| null>` | Fetch user info from the server UserInfo endpoint |
| `getUserInfo()` | `UserInfo \| null` | Cached user info (from ID token or last fetch) |
| `hasRealmRole(role)` | `boolean` | Check if user has a realm-level role |
| `hasClientRole(clientId, role)` | `boolean` | Check if user has a client-level role |
| `getRealmRoles()` | `string[]` | All realm roles for the current user |
| `getClientRoles(clientId)` | `string[]` | All client roles for a specific client |
| `refreshTokens()` | `Promise<TokenResponse>` | Manually trigger a token refresh |
| `on(event, handler)` | `void` | Subscribe to SDK events |
| `off(event, handler)` | `void` | Unsubscribe from SDK events |

#### Events

| Event | Payload | Fires When |
|-------|---------|------------|
| `authenticated` | `TokenResponse` | After successful login or callback |
| `logout` | — | After logout completes |
| `tokenRefreshed` | `TokenResponse` | After a silent token refresh |
| `error` | `Error` | On any authentication error |
| `ready` | `boolean` | After `init()` completes (`true` if authenticated) |

---

### React Hooks

#### `useAuthme()`

```typescript
const { isAuthenticated, isLoading, login, logout, token, client } = useAuthme();
```

| Property | Type | Description |
|----------|------|-------------|
| `isAuthenticated` | `boolean` | Whether the user is logged in |
| `isLoading` | `boolean` | `true` during initialization |
| `login` | `(options?) => Promise<void>` | Trigger login redirect |
| `logout` | `() => Promise<void>` | Trigger logout |
| `token` | `string \| null` | Current access token |
| `client` | `AuthmeClient` | Underlying SDK client instance |

#### `useUser()`

```typescript
const user = useUser();
// user?.sub, user?.name, user?.email, user?.preferred_username, etc.
```

Returns the current user's profile information parsed from the ID token, or `null` if not authenticated.

#### `useRoles()`

```typescript
const { hasRealmRole, hasClientRole, realmRoles, getClientRoles } = useRoles();

hasRealmRole('admin');           // boolean
hasClientRole('my-app', 'edit'); // boolean
realmRoles;                      // string[]
getClientRoles('my-app');        // string[]
```

---

## Backend Integration

The SDK handles frontend authentication. To **protect your backend API routes**, you need to validate the access tokens issued by AuthMe.

### NestJS Guard

```typescript
// auth/authme.guard.ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const AUTHME_URL = 'http://localhost:3000';
const REALM = 'my-realm';

const JWKS = createRemoteJWKSet(
  new URL(`${AUTHME_URL}/realms/${REALM}/protocol/openid-connect/certs`),
);

@Injectable()
export class AuthmeGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('Missing token');

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${AUTHME_URL}/realms/${REALM}`,
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

Usage:

```typescript
@Controller('api')
export class AppController {
  @Get('profile')
  @UseGuards(AuthmeGuard)
  getProfile(@Req() req) {
    return req.user; // JWT payload: { sub, preferred_username, realm_access, ... }
  }
}
```

> **Note:** Install `jose` with `npm install jose`

### Express Middleware

```typescript
// middleware/authme.ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { Request, Response, NextFunction } from 'express';

const AUTHME_URL = 'http://localhost:3000';
const REALM = 'my-realm';

const JWKS = createRemoteJWKSet(
  new URL(`${AUTHME_URL}/realms/${REALM}/protocol/openid-connect/certs`),
);

export async function authmeMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${AUTHME_URL}/realms/${REALM}`,
    });
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

Usage:

```typescript
import express from 'express';
import { authmeMiddleware } from './middleware/authme';

const app = express();

app.get('/api/profile', authmeMiddleware, (req, res) => {
  res.json((req as any).user);
});
```

---

## Attaching Tokens to API Requests

When calling your backend from the frontend, attach the access token as a `Bearer` header:

### With `fetch`

```typescript
const res = await fetch('/api/profile', {
  headers: {
    Authorization: `Bearer ${authme.getAccessToken()}`,
  },
});
const data = await res.json();
```

### With Axios

```typescript
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = authme.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const { data } = await api.get('/profile');
```

---

## Full SPA Callback Flow

### React Router

```tsx
// main.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthmeClient } from 'authme-sdk';
import { AuthmeProvider } from 'authme-sdk/react';
import App from './App';
import Callback from './Callback';

const authme = new AuthmeClient({
  url: 'http://localhost:3000',
  realm: 'my-realm',
  clientId: 'my-app',
  redirectUri: 'http://localhost:5173/callback',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthmeProvider client={authme}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </BrowserRouter>
  </AuthmeProvider>,
);
```

```tsx
// Callback.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthme } from 'authme-sdk/react';

export default function Callback() {
  const { client } = useAuthme();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.handleCallback()
      .then((success) => {
        if (success) navigate('/', { replace: true });
        else setError('Authentication failed');
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div>Error: {error}</div>;
  return <div>Signing in...</div>;
}
```

---

## Error Handling

Subscribe to the `error` event to handle authentication errors:

```typescript
authme.on('error', (error) => {
  console.error('Auth error:', error.message);

  // Common errors:
  // - "Token refresh failed" — refresh token expired, user needs to re-login
  // - "OIDC discovery failed" — AuthMe server unreachable
  // - "Token exchange failed" — authorization code invalid or expired
});
```

### Handling Token Expiry

When auto-refresh fails (e.g., refresh token expired), the user needs to re-login:

```typescript
authme.on('error', (error) => {
  if (error.message.includes('refresh')) {
    // Redirect to login
    authme.login();
  }
});
```

### React Error Boundary

```tsx
function AuthWrapper({ children }) {
  const { client, isAuthenticated } = useAuthme();
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const handler = () => setAuthError(true);
    client.on('error', handler);
    return () => client.off('error', handler);
  }, [client]);

  if (authError) {
    return (
      <div>
        <p>Session expired. Please sign in again.</p>
        <button onClick={() => client.login()}>Sign In</button>
      </div>
    );
  }

  return children;
}
```

---

## AuthMe Client Setup

For the SDK to work, you need a **PUBLIC** client registered in AuthMe:

1. Open the AuthMe Admin Console at `/console`
2. Navigate to your realm > **Clients** > **Create**
3. Set **Client Type** to `PUBLIC`
4. Add your app's URL to **Redirect URIs** (e.g., `http://localhost:5173/callback`)
5. Add your app's origin to **Web Origins** (e.g., `http://localhost:5173`)
6. Enable the `authorization_code` and `refresh_token` grant types

---

## Works with Any OIDC Library

AuthMe implements standard OpenID Connect, so it works out of the box with any compliant client library.

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

---

## License

MIT

---

<p align="center">
  Part of <a href="https://authme.dev">AuthMe</a> — Open-source Identity & Access Management
</p>
