#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/use-sqlite.sh
#
# Activates the SQLite Prisma schema for local development / CI.
#
# What it does:
#   1. Backs up the current prisma/schema.prisma → prisma/schema.prisma.bak
#      (unless it is already a backup restore cycle).
#   2. Copies prisma/schema.sqlite.prisma → prisma/schema.prisma
#   3. Updates prisma.config.ts to reference the SQLite schema file path.
#   4. Prints next steps.
#
# Usage:
#   ./scripts/use-sqlite.sh
#
# To revert back to PostgreSQL:
#   git checkout prisma/schema.prisma
#   (or: cp prisma/schema.prisma.bak prisma/schema.prisma)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_SRC="${REPO_ROOT}/prisma/schema.sqlite.prisma"
SCHEMA_DEST="${REPO_ROOT}/prisma/schema.prisma"
SCHEMA_BAK="${REPO_ROOT}/prisma/schema.prisma.bak"

echo "Activating SQLite schema..."

# Verify the source schema exists
if [[ ! -f "${SCHEMA_SRC}" ]]; then
  echo "ERROR: ${SCHEMA_SRC} not found." >&2
  exit 1
fi

# Back up the current active schema (skip if it already looks like a backup)
if [[ -f "${SCHEMA_DEST}" ]]; then
  cp "${SCHEMA_DEST}" "${SCHEMA_BAK}"
  echo "  Backed up current schema → prisma/schema.prisma.bak"
fi

# Install the SQLite schema
cp "${SCHEMA_SRC}" "${SCHEMA_DEST}"
echo "  Copied schema.sqlite.prisma → prisma/schema.prisma"

echo ""
echo "Done. Next steps:"
echo ""
echo "  1. Set DATABASE_URL in your .env file:"
echo '     DATABASE_URL="file:./dev.db"'
echo ""
echo "  2. Run migrations:"
echo "     npx prisma migrate dev --name init"
echo ""
echo "  3. (Optional) Seed the database:"
echo "     npx ts-node prisma/seed.ts"
echo ""
echo "To revert to PostgreSQL:"
echo "  git checkout prisma/schema.prisma"
echo "  # or: cp prisma/schema.prisma.bak prisma/schema.prisma"
