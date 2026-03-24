-- CreateTable
CREATE TABLE "policies" (
    "id"                     TEXT NOT NULL,
    "realm_id"               TEXT NOT NULL,
    "name"                   TEXT NOT NULL,
    "description"            TEXT,
    "enabled"                BOOLEAN NOT NULL DEFAULT true,
    "effect"                 TEXT NOT NULL DEFAULT 'ALLOW',
    "priority"               INTEGER NOT NULL DEFAULT 0,
    "subject_conditions"     JSONB,
    "resource_conditions"    JSONB,
    "action_conditions"      JSONB,
    "environment_conditions" JSONB,
    "logic"                  TEXT NOT NULL DEFAULT 'AND',
    "client_id"              TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "policies_realm_id_idx" ON "policies"("realm_id");

-- CreateIndex
CREATE INDEX "policies_realm_id_client_id_idx" ON "policies"("realm_id", "client_id");

-- AddForeignKey
ALTER TABLE "policies" ADD CONSTRAINT "policies_realm_id_fkey"
    FOREIGN KEY ("realm_id") REFERENCES "realms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
