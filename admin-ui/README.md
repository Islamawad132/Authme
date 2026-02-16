# AuthMe Admin Console

The web-based administration dashboard for AuthMe. Built with React 19, Vite 7, Tailwind CSS 4, and React Query.

## Overview

The Admin Console is a single-page application served at `/console` that provides full management of all AuthMe resources. It communicates with the backend via REST API using either an admin API key or credential-based JWT authentication.

### Pages

| Area | Capabilities |
|------|-------------|
| **Dashboard** | Overview of realms, users, clients, and recent activity |
| **Realms** | Create, configure, theme, import/export realms. Tabs: General, Tokens, Login, Email, Brute Force, Theme |
| **Users** | CRUD, password reset, MFA management, role/group assignments, session viewer |
| **Clients** | OAuth2 client management with settings, credentials, scope assignments, service account config |
| **Roles** | Realm and client-level role management |
| **Groups** | Hierarchical groups with member and role management |
| **Client Scopes** | Scope definitions with protocol mapper configuration |
| **Sessions** | View and revoke active user sessions |
| **Events** | Login event log and admin action audit trail |
| **Identity Providers** | Configure OIDC and SAML social login providers |
| **User Federation** | LDAP directory sync configuration with test connection and sync triggers |
| **SAML Providers** | SAML Service Provider registration for IdP mode |

## Development

```bash
# Install dependencies
npm install

# Start dev server (proxies API to http://localhost:3000)
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
```

The dev server runs on `http://localhost:5173` and proxies `/admin`, `/auth`, `/realms`, `/health`, and `/metrics` to the backend at `http://localhost:3000`.

## Tech Stack

| Library | Purpose |
|---------|---------|
| **React 19** | UI framework |
| **React Router 7** | Client-side routing |
| **React Query (TanStack)** | Server state management, caching, mutations |
| **Axios** | HTTP client with interceptors for auth headers |
| **Tailwind CSS 4** | Utility-first styling |
| **Vite 7** | Build tool and dev server |
| **TypeScript 5.9** | Type safety |

## Project Structure

```
admin-ui/src/
├── api/                    # API client functions (one file per resource)
│   ├── clients.ts
│   ├── groups.ts
│   ├── identityProviders.ts
│   ├── realmImportExport.ts
│   ├── realms.ts
│   ├── roles.ts
│   ├── samlServiceProviders.ts
│   ├── sessions.ts
│   ├── userFederation.ts
│   └── users.ts
├── components/             # Reusable components
│   ├── ConfirmDialog.tsx   # Confirmation modal
│   ├── Layout.tsx          # App shell with sidebar navigation
│   └── PasswordInput.tsx   # Password input with visibility toggle
├── hooks/
│   └── useAuth.ts          # Authentication hook (API key + credential login)
├── pages/                  # Route page components
│   ├── DashboardPage.tsx
│   ├── LoginPage.tsx
│   ├── clients/            # ClientList, ClientCreate, ClientDetail
│   ├── client-scopes/      # ClientScopeList, ClientScopeCreate, ClientScopeDetail
│   ├── events/             # LoginEvents, AdminEvents
│   ├── groups/             # GroupList, GroupCreate, GroupDetail
│   ├── identity-providers/ # IdpList, IdpCreate, IdpDetail
│   ├── realms/             # RealmList, RealmCreate, RealmDetail
│   ├── roles/              # RoleList
│   ├── saml/               # SamlSpList, SamlSpCreate, SamlSpDetail
│   ├── sessions/           # SessionList
│   ├── user-federation/    # FederationList, FederationCreate, FederationDetail
│   └── users/              # UserList, UserCreate, UserDetail
├── types/
│   └── index.ts            # Shared TypeScript interfaces
├── utils/
│   └── getErrorMessage.ts  # API error extraction helper
├── App.tsx                 # Route definitions
├── main.tsx                # React entry point
└── index.css               # Tailwind imports
```

## Authentication

The console supports two login methods:

1. **Admin API Key** — Stored in `sessionStorage` as `adminApiKey`, sent via `x-admin-api-key` header
2. **Credentials** — Posts to `/auth/login` on the master realm, stores JWT in `sessionStorage` as `adminToken`, sent via `Authorization: Bearer` header

Both are configured in [useAuth.ts](src/hooks/useAuth.ts) and applied to all requests via Axios interceptors in the API client files.

## Build Output

Running `npm run build` outputs to `dist/`, which is copied to the backend's `dist/admin-ui/` directory during the full project build. The NestJS server then serves it as a static SPA at `/console`.
