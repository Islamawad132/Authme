-- ──────────────────────────────────────────────────────────────────────────
-- Migration: Feature 20 — Custom Authentication Flow Engine
--
-- Changes:
--   1. Create `authentication_flows` table (AuthenticationFlow model)
--   2. Add `auth_flow_id` FK column to `clients` table
-- ──────────────────────────────────────────────────────────────────────────

-- 1. Create authentication_flows table
CREATE TABLE "authentication_flows" (
    "id"          TEXT        NOT NULL,
    "realm_id"    TEXT        NOT NULL,
    "name"        TEXT        NOT NULL,
    "description" TEXT,
    "is_default"  BOOLEAN     NOT NULL DEFAULT false,
    "steps"       JSONB       NOT NULL,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "authentication_flows_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one flow name per realm
CREATE UNIQUE INDEX "authentication_flows_realm_id_name_key"
    ON "authentication_flows"("realm_id", "name");

-- FK: authentication_flows.realm_id → realms.id
ALTER TABLE "authentication_flows"
    ADD CONSTRAINT "authentication_flows_realm_id_fkey"
    FOREIGN KEY ("realm_id")
    REFERENCES "realms"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- 2. Add auth_flow_id column to clients
ALTER TABLE "clients"
    ADD COLUMN "auth_flow_id" TEXT;

-- FK: clients.auth_flow_id → authentication_flows.id
ALTER TABLE "clients"
    ADD CONSTRAINT "clients_auth_flow_id_fkey"
    FOREIGN KEY ("auth_flow_id")
    REFERENCES "authentication_flows"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
