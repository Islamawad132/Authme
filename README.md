<h1 align="center">AuthMe</h1>

<p align="center">
  <strong>Open-source Identity and Access Management Server</strong>
</p>

<p align="center">
  A self-hosted, enterprise-grade authentication platform built with NestJS, React, and PostgreSQL.
  <br />
  Think Keycloak — but modern, lightweight, and TypeScript-native.
</p>

<p align="center">
  <a href="#features">Features</a> &middot;
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#architecture">Architecture</a> &middot;
  <a href="#configuration">Configuration</a> &middot;
  <a href="#api-documentation">API Docs</a>
</p>

---

## Why AuthMe?

Most identity solutions are either too complex to self-host (Keycloak) or too limited for real-world use (simple JWT libraries). AuthMe fills that gap — a complete IAM server you can deploy with a single `docker compose up`, with an admin console that just works.

---

## Features

### Authentication & Authorization
- **OAuth 2.0 / OpenID Connect** — Authorization Code (with PKCE), Client Credentials, Password, Refresh Token, and Device Authorization grants
- **SAML 2.0** — Act as both Identity Provider (issue assertions) and Service Provider (broker external SAML IdPs)
- **Multi-Factor Authentication** — TOTP-based (Google Authenticator, Authy, etc.) with QR setup and recovery codes
- **Social Login** — Broker external OIDC and SAML identity providers (Google, GitHub, Azure AD, etc.)
- **LDAP User Federation** — Sync users from LDAP/Active Directory with on-demand or scheduled sync
- **Single Sign-On (SSO)** — Browser-based SSO across all clients in a realm

### User Management
- **Multi-Tenancy (Realms)** — Isolated tenants with independent users, clients, roles, and settings
- **Role-Based Access Control** — Realm-level and client-level roles with user and group assignments
- **Groups** — Hierarchical groups with role inheritance
- **Password Policies** — Configurable minimum length, complexity, history, and expiry
- **Brute Force Protection** — Automatic account lockout after failed login attempts
- **Email Verification & Password Reset** — Configurable email flows via SMTP

### Admin Console
- **Modern React Dashboard** — Full-featured admin UI at `/console`
- **Realm Management** — Create, configure, theme, import, and export realms
- **User, Client, Role, Group, Scope CRUD** — Complete management for all entities
- **Session Management** — View and revoke active user sessions
- **Event Audit Logs** — Login events and admin action history
- **Identity Provider Config** — Configure OIDC, SAML, and LDAP from the UI

### Operations
- **Prometheus Metrics** — `/metrics` endpoint for monitoring
- **Health Checks** — `/health` endpoint for load balancers
- **Structured Logging** — JSON logging with Pino
- **Rate Limiting** — Configurable request throttling
- **Clustering Support** — Stateless design — scale horizontally behind a load balancer
- **Realm Theming** — Custom logos, colors, and CSS per realm
- **Realm Import/Export** — Migrate configurations between environments

---

## Quick Start

### Using Docker Compose (Recommended)

```bash
git clone https://github.com/Islamawad132/Authme.git
cd Authme
cp .env.example .env
docker compose up -d
```

AuthMe will be available at:
- **Admin Console:** http://localhost:3000/console
- **Swagger API Docs:** http://localhost:3000/api

Default admin credentials:
| | |
|---|---|
| **Username** | `admin` |
| **Password** | `admin` |
| **API Key** | Value of `ADMIN_API_KEY` in your `.env` |

> Change the default password and API key before exposing to the internet.

### From Source

**Prerequisites:** Node.js 22+, PostgreSQL 16+

```bash
git clone https://github.com/Islamawad132/Authme.git
cd Authme

# Install dependencies
npm install
cd admin-ui && npm install && cd ..

# Configure database
cp .env.example .env
# Edit .env with your DATABASE_URL

# Setup database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed   # Optional: creates test realm with sample data

# Build everything
npm run build:all

# Start
npm run start:prod
```

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
│  │           Prisma ORM (27 Models)                  │  │
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
│  │   Login/Consent UI (Handlebars SSR)              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 11, TypeScript 5.7, Node.js 22 |
| **Database** | PostgreSQL 16 with Prisma 7 ORM |
| **Admin UI** | React 19, Vite 7, Tailwind CSS 4, React Query |
| **Auth Pages** | Handlebars (server-rendered login, consent, account) |
| **Security** | Argon2 (passwords), JOSE (JWTs), Helmet (headers) |
| **Protocols** | OAuth 2.0, OpenID Connect, SAML 2.0 |
| **Federation** | LDAP via ldapts, SAML via @node-saml/node-saml |
| **Observability** | Pino (logs), prom-client (metrics), @nestjs/terminus (health) |
| **Container** | Docker multi-stage build, Docker Compose |

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

SMTP settings are configured per-realm in the admin console (Realm > Email tab).

---

## API Documentation

Interactive API documentation is available via Swagger UI at `/api` when the server is running.

### Key Endpoints

```
# OpenID Connect Discovery
GET /realms/{realm}/.well-known/openid-configuration

# Token Endpoint
POST /realms/{realm}/protocol/openid-connect/token

# Authorization Endpoint
GET /realms/{realm}/protocol/openid-connect/auth

# UserInfo
GET /realms/{realm}/protocol/openid-connect/userinfo

# SAML Metadata
GET /realms/{realm}/protocol/saml/descriptor

# Admin API (requires x-admin-api-key header or Bearer token)
GET/POST   /admin/realms
GET/PUT/DELETE /admin/realms/{name}
GET/POST   /admin/realms/{name}/users
GET/POST   /admin/realms/{name}/clients
GET/POST   /admin/realms/{name}/roles
GET/POST   /admin/realms/{name}/groups
...

# Health & Metrics
GET /health
GET /metrics
```

---

## Project Structure

```
Authme/
├── src/                    # NestJS backend (32 modules)
│   ├── auth/               # Core authentication logic
│   ├── oauth/              # OAuth 2.0 protocol
│   ├── saml/               # SAML 2.0 IdP & SP
│   ├── tokens/             # JWT issuance & validation
│   ├── users/              # User management
│   ├── clients/            # OAuth2 client management
│   ├── realms/             # Multi-tenant realm config
│   ├── roles/              # RBAC
│   ├── groups/             # Hierarchical groups
│   ├── mfa/                # TOTP multi-factor auth
│   ├── login/              # Login flow orchestration
│   ├── consent/            # OAuth consent flow
│   ├── broker/             # External IdP brokering
│   ├── user-federation/    # LDAP sync
│   ├── identity-providers/ # Social login config
│   ├── sessions/           # Session management
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
│   ├── account/            # User self-service
│   ├── admin-auth/         # Admin API auth
│   └── common/             # Shared guards, filters, decorators
├── admin-ui/               # React admin console
│   └── src/
│       ├── pages/          # Page components (11 feature areas)
│       ├── api/            # API client layer
│       ├── components/     # Reusable components
│       ├── hooks/          # Custom hooks
│       └── types/          # TypeScript interfaces
├── views/                  # Handlebars templates (login, consent, account)
├── public/                 # Static assets (CSS, images)
├── prisma/                 # Database schema & migrations
├── docker-compose.yml      # Development & production setup
├── Dockerfile              # Multi-stage production build
└── test/                   # E2E tests
```

---

## Development

```bash
# Start PostgreSQL
docker compose up db -d

# Run backend in watch mode
npm run start:dev

# Run admin UI dev server (in another terminal)
npm run admin:dev

# Run tests
npm run test
npm run test:e2e
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

### Docker (Production)

```bash
# Build and run
docker compose up -d --build

# Scale horizontally
docker compose up -d --scale app=3
```

### Clustering

AuthMe is fully stateless — all session and token state is stored in PostgreSQL. To run multiple instances:

```bash
docker compose -f docker-compose.cluster.yml up -d
```

This starts 2 app instances behind an Nginx load balancer.

---

## Supported Standards

| Standard | Support |
|----------|---------|
| OAuth 2.0 (RFC 6749) | Authorization Code, Client Credentials, Password, Refresh Token |
| PKCE (RFC 7636) | S256 and plain |
| OpenID Connect Core 1.0 | ID tokens, UserInfo, Discovery |
| Device Authorization (RFC 8628) | Full flow with user code |
| SAML 2.0 | SP-initiated SSO, signed assertions, metadata |
| TOTP (RFC 6238) | MFA with QR provisioning |
| Argon2id (RFC 9106) | Password hashing |

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
  Built with NestJS, React, and PostgreSQL
</p>
