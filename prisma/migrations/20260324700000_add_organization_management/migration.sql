-- ──────────────────────────────────────────────────────────────────────────
-- Migration: Feature 27 — Organization & Team Management (B2B Multi-Tenancy)
--
-- Changes:
--   1. Create `organizations` table
--   2. Create `organization_members` table
--   3. Create `organization_invitations` table
--   4. Create `organization_sso_connections` table
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Create organizations table
CREATE TABLE "organizations" (
    "id"               TEXT         NOT NULL,
    "realm_id"         TEXT         NOT NULL,
    "name"             TEXT         NOT NULL,
    "slug"             TEXT         NOT NULL,
    "display_name"     TEXT,
    "description"      TEXT,
    "enabled"          BOOLEAN      NOT NULL DEFAULT true,
    "logo_url"         TEXT,
    "primary_color"    TEXT,
    "require_mfa"      BOOLEAN      NOT NULL DEFAULT false,
    "verified_domains" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one slug per realm
CREATE UNIQUE INDEX "organizations_realm_id_slug_key"
    ON "organizations"("realm_id", "slug");

-- FK: organizations.realm_id → realms.id (cascade delete)
ALTER TABLE "organizations"
    ADD CONSTRAINT "organizations_realm_id_fkey"
    FOREIGN KEY ("realm_id")
    REFERENCES "realms"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 2. Create organization_members table
CREATE TABLE "organization_members" (
    "id"              TEXT         NOT NULL,
    "organization_id" TEXT         NOT NULL,
    "user_id"         TEXT         NOT NULL,
    "role"            TEXT         NOT NULL DEFAULT 'member',
    "joined_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one membership row per (org, user)
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key"
    ON "organization_members"("organization_id", "user_id");

-- Index on user_id for reverse lookups
CREATE INDEX "organization_members_user_id_idx"
    ON "organization_members"("user_id");

-- FK: organization_members.organization_id → organizations.id (cascade delete)
ALTER TABLE "organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 3. Create organization_invitations table
CREATE TABLE "organization_invitations" (
    "id"              TEXT         NOT NULL,
    "organization_id" TEXT         NOT NULL,
    "email"           TEXT         NOT NULL,
    "role"            TEXT         NOT NULL DEFAULT 'member',
    "token"           TEXT         NOT NULL,
    "expires_at"      TIMESTAMP(3) NOT NULL,
    "accepted_at"     TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on token (used for lookup without enumeration)
CREATE UNIQUE INDEX "organization_invitations_token_key"
    ON "organization_invitations"("token");

-- FK: organization_invitations.organization_id → organizations.id (cascade delete)
ALTER TABLE "organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 4. Create organization_sso_connections table
CREATE TABLE "organization_sso_connections" (
    "id"              TEXT         NOT NULL,
    "organization_id" TEXT         NOT NULL,
    "type"            TEXT         NOT NULL,
    "name"            TEXT         NOT NULL,
    "enabled"         BOOLEAN      NOT NULL DEFAULT true,
    "config"          JSONB        NOT NULL,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_sso_connections_pkey" PRIMARY KEY ("id")
);

-- FK: organization_sso_connections.organization_id → organizations.id (cascade delete)
ALTER TABLE "organization_sso_connections"
    ADD CONSTRAINT "organization_sso_connections_organization_id_fkey"
    FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
