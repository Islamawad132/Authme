-- Align schema with code references introduced by recent feature merges
-- (theme-builder, NHI, GDPR consent, account deletion, upgrade tooling,
-- continuous verification, service-account rate limits).
-- Idempotent where possible so re-running is safe.

-- Realm: GDPR grace period for account deletion
ALTER TABLE "realms"
  ADD COLUMN IF NOT EXISTS "deletion_grace_period_days" INTEGER NOT NULL DEFAULT 14;

-- Session: realm/client linkage used by continuous verification
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "realm_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "client_id" TEXT;
CREATE INDEX IF NOT EXISTS "sessions_realm_id_idx" ON "sessions"("realm_id");

-- ApiKey: per-key rate limits + IP allow-list
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "rate_limit_per_minute" INTEGER;
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "max_requests_per_day" INTEGER;
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "max_requests_per_month" INTEGER;
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "require_ip_restriction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "allowed_ip_ranges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Theme builder: persisted themes + version history
CREATE TABLE IF NOT EXISTS "themes" (
  "id" TEXT NOT NULL,
  "realm_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "display_name" TEXT,
  "description" TEXT,
  "theme_type" TEXT NOT NULL DEFAULT 'login',
  "version" INTEGER NOT NULL DEFAULT 1,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMP(3),
  "styles" JSONB NOT NULL DEFAULT '{}',
  "components" JSONB NOT NULL DEFAULT '[]',
  "assets" JSONB NOT NULL DEFAULT '{}',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "created_by" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "themes_realm_id_name_key" ON "themes"("realm_id", "name");
CREATE INDEX IF NOT EXISTS "themes_realm_id_idx" ON "themes"("realm_id");
DO $$ BEGIN
  ALTER TABLE "themes" ADD CONSTRAINT "themes_realm_id_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "theme_versions" (
  "id" TEXT NOT NULL,
  "theme_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "changes" TEXT,
  "checksum" TEXT NOT NULL,
  "styles" JSONB NOT NULL DEFAULT '{}',
  "components" JSONB NOT NULL DEFAULT '[]',
  "assets" JSONB NOT NULL DEFAULT '{}',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "theme_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "theme_versions_theme_id_version_key" ON "theme_versions"("theme_id", "version");
CREATE INDEX IF NOT EXISTS "theme_versions_theme_id_idx" ON "theme_versions"("theme_id");
DO $$ BEGIN
  ALTER TABLE "theme_versions" ADD CONSTRAINT "theme_versions_theme_id_fkey"
    FOREIGN KEY ("theme_id") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
