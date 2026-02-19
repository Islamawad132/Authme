#!/bin/sh
set -e

# Check required environment variables
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

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting AuthMe..."
exec node dist/main.js
