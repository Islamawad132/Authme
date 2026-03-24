-- CreateTable: service_accounts — lightweight non-human identity entities
CREATE TABLE "service_accounts" (
    "id" TEXT NOT NULL,
    "realm_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_accounts_realm_id_name_key" ON "service_accounts"("realm_id", "name");

ALTER TABLE "service_accounts"
    ADD CONSTRAINT "service_accounts_realm_id_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: api_keys — hashed API keys scoped to a service account
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "service_account_id" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");
CREATE INDEX "api_keys_service_account_id_idx" ON "api_keys"("service_account_id");

ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_service_account_id_fkey"
    FOREIGN KEY ("service_account_id") REFERENCES "service_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
