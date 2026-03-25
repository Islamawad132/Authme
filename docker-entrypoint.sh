#!/bin/sh
set -e

# ── NODE_ENV ───────────────────────────────────────────────────────────────────
# Default to production when the variable is absent so that the application
# never starts in an unintentionally permissive mode.
if [ -z "$NODE_ENV" ]; then
  echo "WARNING: NODE_ENV is not set — defaulting to 'production'"
  NODE_ENV=production
  export NODE_ENV
fi

# ── Required environment variables ────────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo ""
  echo "============================================"
  echo "  ERROR: DATABASE_URL is not set"
  echo "============================================"
  echo ""
  echo "  AuthMe requires PostgreSQL to run."
  echo "  Use docker compose instead of docker run:"
  echo ""
  echo "  1. Create a docker-compose.yml (see README)"
  echo "  2. Run: docker compose up -d"
  echo ""
  echo "  Or provide DATABASE_URL manually:"
  echo "  docker run -e DATABASE_URL=postgresql://user:pass@host:5432/authme islamawad/authme"
  echo ""
  echo "============================================"
  exit 1
fi

# ── Warn about sensitive variables that should be changed ─────────────────────
if [ -z "$ADMIN_API_KEY" ]; then
  echo ""
  echo "============================================"
  echo "  WARNING: ADMIN_API_KEY is not set"
  echo "============================================"
  echo ""
  echo "  The admin API will be unprotected or use a"
  echo "  default key.  Set ADMIN_API_KEY to a strong,"
  echo "  randomly generated secret before exposing"
  echo "  this instance to a network."
  echo ""
  echo "============================================"
  echo ""
fi

if [ "$ADMIN_API_KEY" = "changeme" ]; then
  echo ""
  echo "============================================"
  echo "  WARNING: ADMIN_API_KEY is set to the"
  echo "  insecure default value 'changeme'"
  echo "============================================"
  echo ""
  echo "  Change ADMIN_API_KEY to a strong, randomly"
  echo "  generated secret before exposing this"
  echo "  instance to a network."
  echo ""
  echo "============================================"
  echo ""
fi

if [ "$ADMIN_PASSWORD" = "admin" ]; then
  echo ""
  echo "============================================"
  echo "  WARNING: ADMIN_PASSWORD is set to the"
  echo "  weak default value 'admin'"
  echo "============================================"
  echo ""
  echo "  Change ADMIN_PASSWORD to a strong password"
  echo "  before exposing this instance to a network."
  echo ""
  echo "============================================"
  echo ""
fi

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting AuthMe..."
exec node dist/main.js
