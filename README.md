<p align="center">
  <img src="https://authme.dev/logo.svg" alt="AuthMe" width="80" />
</p>

<h1 align="center">AuthMe</h1>

<p align="center">
  <strong>Open-source Identity & Access Management</strong><br />
  <sub>Self-hosted authentication server with OAuth 2.0, OpenID Connect, SAML 2.0, and MFA.</sub>
</p>

<p align="center">
  <a href="https://authme.dev">Website</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#client-sdk">SDK</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#api-documentation">API Docs</a>
</p>

<p align="center">
  <a href="https://github.com/Islamawad132/Authme/actions"><img src="https://github.com/Islamawad132/Authme/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/Islamawad132/Authme/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-proprietary-blue" alt="License" /></a>
  <a href="https://authme.dev"><img src="https://img.shields.io/badge/docs-authme.dev-blue" alt="Docs" /></a>
</p>

---

## Why AuthMe?

Most identity solutions are either too complex to self-host (Keycloak — 1GB+ RAM, Java) or too limited for production (simple JWT libraries). AuthMe fills that gap:

- **Deploy in 30 seconds** — single `docker compose up` gets you a full IAM server
- **Modern stack** — TypeScript, NestJS, React, PostgreSQL. No Java, no XML
- **Lightweight** — runs in ~150MB RAM vs. Keycloak's 1GB+
- **Complete** — OAuth 2.0, OIDC, SAML 2.0, MFA, LDAP, SSO — all built-in
- **Admin Console** — full-featured React dashboard at `/console`

---

## Features

### Authentication & Protocols

| Feature | Description |
|---------|-------------|
| **OAuth 2.0 / OpenID Connect** | Authorization Code (with PKCE), Client Credentials, Password, Refresh Token, and Device Authorization grants |
| **SAML 2.0** | Identity Provider (issue assertions) and Service Provider (broker external SAML IdPs) |
| **Multi-Factor Authentication** | TOTP-based 2FA with QR provisioning, recovery codes, brute-force protection (max 5 attempts) |
| **Social Login** | Broker external OIDC and SAML identity providers (Google, GitHub, Azure AD, etc.) |
| **LDAP User Federation** | Sync users from LDAP/Active Directory with on-demand or scheduled sync |
| **Single Sign-On** | Browser-based SSO across all clients in a realm |

### Identity Management

| Feature | Description |
|---------|-------------|
| **Multi-Tenancy (Realms)** | Isolated tenants with independent users, clients, roles, and configurations |
| **Role-Based Access Control** | Realm-level and client-level roles with user and group assignments |
| **Groups** | Hierarchical groups with role inheritance |
| **Password Policies** | Minimum length, complexity requirements, history tracking, expiry |
| **Brute Force Protection** | Automatic account lockout with configurable thresholds |
| **Email Verification & Password Reset** | Configurable email flows via SMTP with themed templates |

### Admin Console

| Feature | Description |
|---------|-------------|
| **Modern React Dashboard** | Full-featured admin UI at `/console` with real-time data |
| **Complete Entity Management** | CRUD for realms, users, clients, roles, groups, scopes, and more |
| **Session Management** | View and revoke active user sessions |
| **Event Audit Logs** | Login events and admin action history with filtering |
| **Identity Provider Config** | Configure OIDC, SAML, and LDAP providers from the UI |
| **Realm Import/Export** | Migrate configurations between environments |

### Operations & DevOps

| Feature | Description |
|---------|-------------|
| **Prometheus Metrics** | `/metrics` endpoint for Grafana dashboards |
| **Health Checks** | `/health` endpoint for load balancers and orchestrators |
| **Structured Logging** | JSON logging with Pino for log aggregation |
| **Rate Limiting** | Configurable request throttling per endpoint |
| **Horizontal Scaling** | Stateless design — run multiple instances behind a load balancer |
| **Realm Theming** | Custom logos, colors, and CSS per realm (login, consent, account pages) |

---

## Quick Start

### Docker Hub (Recommended)

```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/Islamawad132/Authme/main/docker-compose.yml
docker compose up -d
```

That's it. AuthMe is now running:

| URL | Description |
|-----|-------------|
| http://localhost:3000/console | Admin Console |
| http://localhost:3000/api | Swagger API Docs |
| http://localhost:3000/health | Health Check |
| http://localhost:3000/metrics | Prometheus Metrics |

**Default admin credentials:**

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |
| API Key | Value of `ADMIN_API_KEY` in `.env` |

> **Warning:** Change the default password and API key before exposing to the internet.

### From Source

**Prerequisites:** Node.js 22+, PostgreSQL 16+

```bash
git clone https://github.com/Islamawad132/Authme.git
cd Authme

# Install dependencies
npm install
cd admin-ui && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env with your DATABASE_URL

# Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed   # Optional: sample data

# Build & start
npm run build:all
npm run start:prod
```

---

## Client SDK

AuthMe ships with **authme-sdk** — a zero-dependency TypeScript SDK for frontend integration.

```bash
npm install authme-sdk
```

### 5 Lines to Authenticate

```typescript
import { AuthmeClient } from 'authme-sdk';

const authme = new AuthmeClient({
  url: 'http://localhost:3000',
  realm: 'my-realm',
  clientId: 'my-app',
  redirectUri: 'http://localhost:5173/callback',
});

await authme.init();
if (!authme.isAuthenticated()) {
  await authme.login(); // Redirects to AuthMe login page
}
```

### React Integration

```tsx
import { AuthmeClient } from 'authme-sdk';
import { AuthmeProvider, useAuthme, useUser } from 'authme-sdk/react';

const authme = new AuthmeClient({ /* config */ });

function App() {
  return (
    <AuthmeProvider client={authme}>
      <Dashboard />
    </AuthmeProvider>
  );
}

function Dashboard() {
  const { isAuthenticated, login, logout } = useAuthme();
  const user = useUser();

  if (!isAuthenticated) return <button onClick={() => login()}>Sign In</button>;

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}
```

### Works with Any OIDC Library

AuthMe implements standard OpenID Connect, so it works out of the box with `oidc-client-ts`, `react-oidc-context`, `next-auth`, and any other compliant library.

See the full SDK documentation at [`packages/authme-js/README.md`](packages/authme-js/README.md).

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AuthMe Server                       │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Admin API   │  │  OAuth/OIDC  │  │   SAML 2.0   │  │
│  │  (REST)      │  │  Endpoints   │  │  IdP & SP    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│  ┌──────┴─────────────────┴──────────────────┴───────┐  │
│  │              NestJS Service Layer                  │  │
│  │  Auth · Tokens · Users · Clients · Roles · MFA    │  │
│  │  Sessions · Scopes · Groups · Events · Metrics    │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴────────────────────────────┐  │
│  │           Prisma ORM · 27 Models                  │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────┐  ┌────┴─────┐  ┌──────────────────┐  │
│  │  LDAP Sync   │  │PostgreSQL│  │ Email (SMTP)     │  │
│  └──────────────┘  └──────────┘  └──────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Admin Console (React SPA)  →  /console         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │   Login/Account UI (Handlebars SSR + Theming)    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 11, TypeScript 5.7, Node.js 22 |
| **Database** | PostgreSQL 16 with Prisma 7 ORM (27 models, 11 migrations) |
| **Admin UI** | React 19, Vite 7, Tailwind CSS 4, React Query |
| **Auth Pages** | Handlebars SSR with per-realm theming |
| **Security** | Argon2id (passwords), JOSE (JWTs), Helmet (headers) |
| **Protocols** | OAuth 2.0, OpenID Connect, SAML 2.0 |
| **Federation** | LDAP via ldapts, SAML via @node-saml/node-saml |
| **Observability** | Pino (logs), prom-client (metrics), @nestjs/terminus (health) |
| **Container** | Docker multi-stage build, Docker Compose |

---

## Supported Standards

| Standard | Support |
|----------|---------|
| OAuth 2.0 (RFC 6749) | Authorization Code, Client Credentials, Password, Refresh Token |
| PKCE (RFC 7636) | S256 method |
| OpenID Connect Core 1.0 | ID tokens, UserInfo, Discovery, Backchannel Logout |
| Device Authorization (RFC 8628) | Full flow with user code |
| SAML 2.0 | SP-initiated SSO, signed assertions, metadata exchange |
| TOTP (RFC 6238) | MFA with QR provisioning and recovery codes |
| Argon2id (RFC 9106) | Password hashing |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `ADMIN_API_KEY` | — | API key for admin endpoints |
| `ADMIN_USER` | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | `admin` | Initial admin password |
| `THROTTLE_TTL` | `60000` | Rate limit window (ms) |
| `THROTTLE_LIMIT` | `100` | Max requests per window |
| `BASE_URL` | `http://localhost:3000` | Public URL for redirects and emails |

SMTP settings are configured per-realm in the Admin Console (Realm > Email tab).

---

## API Documentation

Interactive Swagger UI is available at `/api` when the server is running.

### Key Endpoints

```
# OpenID Connect Discovery
GET  /realms/{realm}/.well-known/openid-configuration

# Token Endpoint (all grant types)
POST /realms/{realm}/protocol/openid-connect/token

# Authorization Endpoint
GET  /realms/{realm}/protocol/openid-connect/auth

# UserInfo
GET  /realms/{realm}/protocol/openid-connect/userinfo

# JWKS (signing keys)
GET  /realms/{realm}/protocol/openid-connect/certs

# SAML Metadata
GET  /realms/{realm}/protocol/saml/descriptor

# Admin API (requires x-admin-api-key or Bearer token)
GET/POST       /admin/realms
GET/PUT/DELETE /admin/realms/{name}
GET/POST       /admin/realms/{name}/users
GET/POST       /admin/realms/{name}/clients
GET/POST       /admin/realms/{name}/roles
GET/POST       /admin/realms/{name}/groups

# Health & Metrics
GET  /health
GET  /metrics
```

---

## Project Structure

```
Authme/
├── src/                    # NestJS backend (32 modules)
│   ├── auth/               # Core OAuth2 authentication
│   ├── oauth/              # OAuth 2.0 protocol logic
│   ├── saml/               # SAML 2.0 IdP & SP
│   ├── tokens/             # JWT issuance & validation
│   ├── mfa/                # TOTP multi-factor auth
│   ├── login/              # Login flow orchestration
│   ├── consent/            # OAuth consent flow
│   ├── users/              # User management
│   ├── clients/            # OAuth2 client management
│   ├── realms/             # Multi-tenant configuration
│   ├── roles/              # RBAC
│   ├── groups/             # Hierarchical groups
│   ├── sessions/           # Session management
│   ├── broker/             # External IdP brokering
│   ├── user-federation/    # LDAP sync
│   ├── identity-providers/ # Social login config
│   ├── events/             # Audit logging
│   ├── metrics/            # Prometheus metrics
│   ├── health/             # Health checks
│   ├── email/              # SMTP email service
│   ├── verification/       # Email verification
│   ├── password-policy/    # Password rules
│   ├── brute-force/        # Lockout protection
│   ├── crypto/             # Cryptographic utilities
│   ├── scopes/             # OAuth scope definitions
│   ├── client-scopes/      # Client scope assignments
│   ├── device/             # Device authorization grant
│   ├── well-known/         # OIDC discovery
│   ├── account/            # User self-service portal
│   ├── admin-auth/         # Admin API authentication
│   └── common/             # Shared guards, filters, decorators
├── admin-ui/               # React admin console (React 19 + Tailwind)
├── packages/authme-js/     # Client SDK (zero-dependency TypeScript)
├── themes/                 # Login/account page themes (Handlebars)
├── prisma/                 # Database schema & migrations
├── test/                   # E2E tests
├── docker-compose.yml      # Production (pulls from Docker Hub)
├── docker-compose.dev.yml  # Development (builds from source)
├── docker-compose.cluster.yml  # Multi-instance with Nginx LB
└── Dockerfile              # Multi-stage production build
```

---

## Development

```bash
# Start PostgreSQL
docker compose up db -d

# Backend (watch mode)
npm run start:dev

# Admin UI (separate terminal)
npm run admin:dev

# Run tests
npm test           # 689 unit tests
npm run test:e2e   # E2E tests (requires PostgreSQL)
```

### Database Commands

```bash
npm run prisma:generate   # Regenerate Prisma client
npm run prisma:migrate    # Apply pending migrations
npm run prisma:seed       # Seed with test data
npm run db:setup          # Generate + migrate + seed
```

---

## Deployment

### Docker Hub

```bash
docker compose up -d
```

### Build from Source (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Horizontal Scaling

AuthMe is fully stateless — all state is stored in PostgreSQL. Scale horizontally:

```bash
# Using the cluster compose file (2 instances + Nginx LB)
docker compose -f docker-compose.cluster.yml up -d

# Or scale manually
docker compose up -d --scale app=3
```

---

## Comparison

| Feature | AuthMe | Keycloak | Auth0 | Clerk |
|---------|--------|----------|-------|-------|
| Self-hosted | Yes | Yes | No | No |
| Open source | Yes | Yes | No | No |
| Memory usage | ~150MB | ~1GB+ | N/A | N/A |
| Setup time | 30 seconds | Minutes | Minutes | Minutes |
| Language | TypeScript | Java | N/A | N/A |
| OAuth 2.0 + OIDC | Yes | Yes | Yes | Yes |
| SAML 2.0 | Yes | Yes | Yes | No |
| MFA/2FA | Yes | Yes | Yes | Yes |
| LDAP Federation | Yes | Yes | Yes | No |
| Admin Console | Yes | Yes | Yes | Yes |
| Client SDK | Yes | Yes | Yes | Yes |
| Realm Theming | Yes | Yes | No | Yes |

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary. All rights reserved.

---

<p align="center">
  <a href="https://authme.dev">authme.dev</a> &middot;
  Built with NestJS, React, and PostgreSQL
</p>
